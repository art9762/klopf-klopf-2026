from __future__ import annotations

import asyncio
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


class Controller:
    def __init__(self) -> None:
        self.safety = SafetyChecker()
        self.policy = TrafficPolicy(mode="adaptive")
        self.fsm = TrafficFSM(all_red_duration=3.0, on_phase_change=self._on_phase_change)
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

    async def start(self) -> None:
        await self.storage.init()
        self.mqtt.start()
        self._loop_task = asyncio.create_task(self._control_loop())

    async def stop(self) -> None:
        if self._loop_task is not None:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        self.mqtt.stop()
        await self.storage.close()

    async def _control_loop(self) -> None:
        last_comm_warn = 0.0
        while True:
            now = time.time()

            if not self.safety.is_comm_healthy() and self.fsm.phase not in (
                Phase.EMERGENCY, Phase.MANUAL
            ):
                if now - last_comm_warn > 10.0:
                    await self._emit_event("warn", "COMM_LOSS", "midzone messages lost >5s")
                    last_comm_warn = now
                if self.fsm.phase in (Phase.GREEN_A, Phase.GREEN_B):
                    self.fsm.set_green_end_time(now + 60.0)

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

            # Broadcast current state every tick
            phase_state = self.fsm.state_snapshot().model_dump()
            phase_state['phase'] = phase_state['phase'].value if hasattr(phase_state['phase'], 'value') else phase_state['phase']
            await self.gateway.broadcast("traffic/state/phase", phase_state)

            self._update_metrics()
            self.mqtt.publish_queues({
                "ts": now,
                "queue_A": self.policy.queue_a,
                "queue_B": self.policy.queue_b,
                "wait_A_sec": self.policy.wait_a,
                "wait_B_sec": self.policy.wait_b,
            })
            self.mqtt.publish_metrics(self._metrics)

            await self.gateway.broadcast("traffic/state/queues", {
                "ts": now,
                "queue_A": self.policy.queue_a,
                "queue_B": self.policy.queue_b,
                "wait_A_sec": self.policy.wait_a,
                "wait_B_sec": self.policy.wait_b,
            })
            await self.gateway.broadcast("traffic/state/metrics", self._metrics)

            await asyncio.sleep(0.5)

    def _on_phase_change(self, state: PhaseState) -> None:
        self.mqtt.publish_phase(state.model_dump())
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.gateway.broadcast("traffic/state/phase", state.model_dump()))
            loop.create_task(
                self._emit_event("info", "PHASE_CHANGE", f"phase → {state.phase.value} ({state.reason})")
            )
            loop.create_task(
                self.storage.log_phase(state.ts, state.phase.value, state.reason, 0.0)
            )
        except RuntimeError:
            pass

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
                asyncio.ensure_future(
                    self._emit_event("warn", "STUCK_VEHICLE", f"{vid} inside >30s")
                )

    def _handle_override(self, action: str, operator: str) -> None:
        if action == "FORCE_GREEN_A":
            self.fsm.force_phase(Phase.GREEN_A, f"forced by {operator}")
            self.fsm.set_green_end_time(time.time() + 60.0)
        elif action == "FORCE_GREEN_B":
            self.fsm.force_phase(Phase.GREEN_B, f"forced by {operator}")
            self.fsm.set_green_end_time(time.time() + 60.0)
        elif action == "ALL_RED":
            self.fsm.force_phase(Phase.ALL_RED_A_to_B, f"emergency by {operator}")
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._emit_event("info", "OVERRIDE", f"{action} by {operator}"))
        except RuntimeError:
            pass

    def _handle_scenario(self, scenario_id: str, mode: str) -> None:
        self.policy.set_mode(mode)
        self.safety.reset_counters()
        asyncio.ensure_future(self._start_new_session(scenario_id, mode))

    async def _start_new_session(self, scenario_id: str, mode: str) -> None:
        if self._current_session_id is not None:
            await self.storage.end_session(self._current_session_id, self._metrics)
        self._current_session_id = await self.storage.start_session(scenario_id, mode)
        self._metrics = _empty_metrics()
        self._metrics["mode"] = mode

    async def _emit_event(self, level: str, code: str, msg: str) -> None:
        ts = time.time()
        event = {"ts": ts, "level": level, "code": code, "msg": msg, "data": {}}
        self.mqtt.publish_event(event)
        await self.gateway.broadcast("traffic/event/log", event)
        await self.storage.log_event(ts, level, code, msg, {})

    def _update_metrics(self) -> None:
        self._metrics["ts"] = time.time()
        self._metrics["avg_delay_A"] = self.policy.wait_a
        self._metrics["avg_delay_B"] = self.policy.wait_b
        self._metrics["max_queue_A"] = max(
            self._metrics.get("max_queue_A", 0), self.policy.queue_a
        )
        self._metrics["max_queue_B"] = max(
            self._metrics.get("max_queue_B", 0), self.policy.queue_b
        )
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
