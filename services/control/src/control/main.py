from __future__ import annotations

import asyncio
import os
import random
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from control.api import router as api_router, set_dependencies
from control.fsm import Phase, PhaseState, TrafficFSM
from control.mqtt_bridge import MqttBridge
from control.policy import TrafficPolicy
from control.safety import SafetyChecker
from control.storage import StorageManager, SqliteStorage, InfluxStorage
from control.ws_gateway import gateway, router as ws_router

DEMO_MODE = os.environ.get("DEMO_MODE", "true").lower() in ("1", "true", "yes")


class TrafficGenerator:
    """Built-in traffic event generator for demo without CV service."""

    def __init__(self, controller: Controller) -> None:
        self._controller = controller
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._vehicle_counter = 0
        self._scenario_id = "baseline"

    def start(self, scenario_id: str) -> None:
        self.stop()
        self._scenario_id = scenario_id
        self._running = True
        self._task = asyncio.create_task(self._generate_loop())

    def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            self._task = None

    async def _generate_loop(self) -> None:
        while self._running:
            try:
                await self._tick()
                await asyncio.sleep(self._get_interval())
            except asyncio.CancelledError:
                break

    def _get_interval(self) -> float:
        if self._scenario_id == "rush_hour":
            return random.uniform(1.0, 3.0)
        elif self._scenario_id == "stuck_truck":
            return random.uniform(3.0, 6.0)
        return random.uniform(2.0, 5.0)

    async def _tick(self) -> None:
        c = self._controller
        now = time.time()

        if self._scenario_id == "rush_hour":
            side = "A" if random.random() < 0.75 else "B"
        elif self._scenario_id == "stuck_truck":
            side = "A"
        else:
            side = random.choice(["A", "B"])

        self._vehicle_counter += 1
        vid = f"gen_{self._vehicle_counter}"
        vclass = "truck" if self._scenario_id == "stuck_truck" and self._vehicle_counter % 5 == 0 else "car"

        c._handle_entry(side, vid, vclass, 0.95, now)
        c.mqtt.publish("traffic/sensor/{}/entry".format(side), {
            "ts": now, "side": side, "vehicle_id": vid,
            "vehicle_class": vclass, "confidence": 0.95,
        })

        vehicles_in = list(c.safety.vehicles_in_zone)
        stuck = list(c.safety.stuck_ids)
        c._handle_midzone(vehicles_in, stuck, now)
        c.mqtt.publish("traffic/sensor/midzone", {
            "ts": now, "vehicles_in_zone": vehicles_in, "stuck_ids": stuck,
        })

        if random.random() < 0.6 and vehicles_in:
            exit_vid = random.choice(vehicles_in)
            exit_side = "B" if side == "A" else "A"
            c._handle_exit(exit_side, exit_vid, "car", 0.95, now)
            c.mqtt.publish("traffic/sensor/{}/exit".format(exit_side), {
                "ts": now, "side": exit_side, "vehicle_id": exit_vid,
                "vehicle_class": "car", "confidence": 0.95,
            })


class Controller:
    def __init__(self) -> None:
        self.safety = SafetyChecker()
        self.policy = TrafficPolicy(mode="adaptive")
        self.fsm = TrafficFSM(all_red_duration=5.0, on_phase_change=self._on_phase_change)
        self.storage = StorageManager()
        self.gateway = gateway

        self.mqtt = MqttBridge(
            on_entry=self._handle_entry,
            on_exit=self._handle_exit,
            on_midzone=self._handle_midzone,
            on_override=self._handle_override,
            on_scenario=self._handle_scenario,
        )

        self._current_session_id: int | None = None
        self._metrics = _empty_metrics()
        self._loop_task: asyncio.Task[None] | None = None
        self._exit_count: int = 0
        self._exit_count_last_reset: float = time.time()
        self._generator: TrafficGenerator | None = None
        self._cv_connected = False

    async def start(self) -> None:
        await self.storage.init()
        self.mqtt.start()
        self._loop_task = asyncio.create_task(self._control_loop())
        if DEMO_MODE:
            self._generator = TrafficGenerator(self)
            # Auto-start baseline scenario so dashboard shows data immediately
            asyncio.get_running_loop().call_later(2.0, lambda: self._handle_scenario("baseline", "adaptive"))

    async def stop(self) -> None:
        if self._generator is not None:
            self._generator.stop()
        if self._loop_task is not None:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        self.mqtt.stop()
        await self.storage.close()

    async def _control_loop(self) -> None:
        while True:
            now = time.time()

            if not self.safety.is_comm_healthy() and self.fsm.phase not in (
                Phase.EMERGENCY, Phase.MANUAL
            ):
                if self._cv_connected:
                    await self._emit_event("warn", "COMM_LOSS", "midzone messages lost >5s")
                    self._cv_connected = False
                if self.fsm.phase in (Phase.GREEN_A, Phase.GREEN_B):
                    self.fsm.set_green_end_time(now + 240.0)
            elif self.safety.is_comm_healthy():
                self._cv_connected = True

            if self.fsm.phase in (Phase.GREEN_A, Phase.GREEN_B):
                phase_duration = now - self.fsm.phase_started_at
                should_switch, reason = self.policy.should_switch(
                    self.fsm.phase.value, phase_duration
                )
                if should_switch and self.safety.is_zone_clear(self.fsm.phase.value):
                    self.fsm.request_transition(
                        Phase.ALL_RED_A_to_B if self.fsm.phase == Phase.GREEN_A else Phase.ALL_RED_B_to_A,
                        reason,
                    )

            self.fsm.tick()

            self._update_metrics(now)
            queues_msg = {
                "ts": now,
                "queue_A": self.policy.queue_a,
                "queue_B": self.policy.queue_b,
                "wait_A_sec": self.policy.wait_a,
                "wait_B_sec": self.policy.wait_b,
            }
            self.mqtt.publish_queues(queues_msg)
            self.mqtt.publish_metrics(self._metrics)

            await self.gateway.broadcast("traffic/state/queues", queues_msg)
            await self.gateway.broadcast("traffic/state/metrics", self._metrics)
            await self.gateway.broadcast("traffic/state/phase", self.fsm.state_snapshot().model_dump())

            await asyncio.sleep(0.5)

    def _on_phase_change(self, state: PhaseState) -> None:
        self.mqtt.publish_phase(state.model_dump())
        asyncio.create_task(self.gateway.broadcast("traffic/state/phase", state.model_dump()))
        asyncio.create_task(
            self.storage.log_phase(state.ts, state.phase.value, state.reason, 0.0)
        )

    def _handle_entry(self, side: str, vehicle_id: str, vehicle_class: str, confidence: float, ts: float) -> None:
        self.safety.on_entry(side, vehicle_id)
        if side == "A":
            self.policy.update_queues(
                self.policy.queue_a + 1, self.policy.queue_b,
                self.policy.wait_a, self.policy.wait_b,
            )
        else:
            self.policy.update_queues(
                self.policy.queue_a, self.policy.queue_b + 1,
                self.policy.wait_a, self.policy.wait_b,
            )

    def _handle_exit(self, side: str, vehicle_id: str, vehicle_class: str, confidence: float, ts: float) -> None:
        self.safety.on_exit(side, vehicle_id)
        self._exit_count += 1
        if side == "A":
            self.policy.update_queues(
                max(0, self.policy.queue_a - 1), self.policy.queue_b,
                self.policy.wait_a, self.policy.wait_b,
            )
        else:
            self.policy.update_queues(
                self.policy.queue_a, max(0, self.policy.queue_b - 1),
                self.policy.wait_a, self.policy.wait_b,
            )

    def _handle_midzone(self, vehicles_in_zone: list[str], stuck_ids: list[str], ts: float) -> None:
        self.safety.on_midzone(vehicles_in_zone, stuck_ids)
        if stuck_ids:
            for vid in stuck_ids:
                asyncio.create_task(
                    self._emit_event("warn", "STUCK_VEHICLE", f"{vid} inside >30s")
                )

    def _handle_override(self, action: str, operator: str) -> None:
        asyncio.create_task(
            self._emit_event("info", "OVERRIDE", f"{action} by {operator}")
        )

        if action == "ALL_RED":
            self.fsm.request_transition(Phase.EMERGENCY, f"operator:{operator}")
            return

        if action == "FORCE_GREEN_A":
            target_green = Phase.GREEN_A
            target_all_red = Phase.ALL_RED_B_to_A
        elif action == "FORCE_GREEN_B":
            target_green = Phase.GREEN_B
            target_all_red = Phase.ALL_RED_A_to_B
        else:
            return

        if self.fsm.phase == target_green:
            return

        self.fsm.request_transition(Phase.EMERGENCY, f"override:{operator}")
        asyncio.get_running_loop().call_later(
            1.0, lambda: self._complete_override(target_all_red, target_green, operator)
        )

    def _complete_override(self, all_red: Phase, target_green: Phase, operator: str) -> None:
        self.fsm.request_transition(all_red, f"override_clearance:{operator}")
        asyncio.get_running_loop().call_later(
            1.5, lambda: self._force_green(target_green, operator)
        )

    def _force_green(self, target: Phase, operator: str) -> None:
        self.fsm.request_transition(target, f"forced_by:{operator}")

    def _handle_scenario(self, scenario_id: str, mode: str) -> None:
        self.policy.set_mode(mode)
        self.safety.reset_counters()
        self._exit_count = 0
        self._exit_count_last_reset = time.time()
        asyncio.create_task(self._start_new_session(scenario_id, mode))

        if DEMO_MODE and self._generator is not None:
            self._generator.start(scenario_id)

    async def _start_new_session(self, scenario_id: str, mode: str) -> None:
        if self._current_session_id is not None:
            await self.storage.end_session(self._current_session_id, self._metrics)
        self._current_session_id = await self.storage.start_session(scenario_id, mode)
        self._metrics = _empty_metrics()
        self._metrics["mode"] = mode
        await self._emit_event("info", "SCENARIO_START", f"{scenario_id} mode={mode}")

    async def _emit_event(self, level: str, code: str, msg: str) -> None:
        ts = time.time()
        event = {"ts": ts, "level": level, "code": code, "msg": msg, "data": {}}
        self.mqtt.publish_event(event)
        await self.gateway.broadcast("traffic/event/log", event)
        await self.storage.log_event(ts, level, code, msg, {})

    def _update_metrics(self, now: float) -> None:
        elapsed = now - self._exit_count_last_reset
        if elapsed > 0:
            throughput = int(self._exit_count / elapsed * 3600)
        else:
            throughput = 0

        self._metrics["ts"] = now
        self._metrics["avg_delay_A"] = self.policy.wait_a
        self._metrics["avg_delay_B"] = self.policy.wait_b
        self._metrics["max_queue_A"] = max(
            self._metrics.get("max_queue_A", 0), self.policy.queue_a
        )
        self._metrics["max_queue_B"] = max(
            self._metrics.get("max_queue_B", 0), self.policy.queue_b
        )
        self._metrics["throughput_per_hour"] = throughput
        self._metrics["unsafe_switches"] = 0
        self._metrics["mode"] = self.policy.mode


def _empty_metrics() -> dict[str, Any]:
    return {
        "ts": time.time(),
        "avg_delay_A": 0.0,
        "avg_delay_B": 0.0,
        "max_queue_A": 0,
        "max_queue_B": 0,
        "throughput_per_hour": 0,
        "unsafe_switches": 0,
        "mode": "adaptive",
    }


controller = Controller()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await controller.start()
    set_dependencies(controller.mqtt, controller.storage)
    yield
    await controller.stop()


app = FastAPI(title="Traffic Control Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ws_router)
app.include_router(api_router)
