"""Synthetic command-path regressions; no broker, database or signal hardware."""
from __future__ import annotations

import asyncio
import json
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from control.fsm import Phase, TrafficFSM
from control.main import Controller
from control.mqtt_bridge import MqttBridge


@pytest.fixture
def clock():
    now = [1000.0]
    with patch("time.time", side_effect=lambda: now[0]):
        yield now


@pytest.fixture
async def controller(clock):
    instance = Controller()
    instance.storage = MagicMock(log_phase=AsyncMock(), log_event=AsyncMock())
    instance.gateway = MagicMock(broadcast=AsyncMock())
    instance.mqtt._client = MagicMock()
    yield instance
    await asyncio.sleep(0)


def set_phase(controller: Controller, phase: Phase) -> None:
    if phase == Phase.ALL_RED_A_to_B:
        return
    controller.fsm.request_transition(Phase.EMERGENCY, "setup")
    if phase == Phase.EMERGENCY:
        return
    if phase == Phase.MANUAL:
        controller.fsm.request_transition(phase, "setup")
        return
    target = Phase.GREEN_A if phase in (Phase.GREEN_A, Phase.ALL_RED_B_to_A) else Phase.GREEN_B
    controller.fsm.release_override(target, "setup")
    if phase in (Phase.GREEN_A, Phase.GREEN_B):
        controller.fsm.request_transition(phase, "setup")


def message(topic: str, data: object) -> SimpleNamespace:
    return SimpleNamespace(topic=topic, payload=json.dumps(data).encode())


@pytest.mark.parametrize("initial", list(Phase))
@pytest.mark.parametrize("target", [Phase.GREEN_A, Phase.GREEN_B])
async def test_force_either_direction_from_every_phase_observes_clearance(controller, clock, initial, target):
    set_phase(controller, initial)
    controller.safety.on_midzone([], [])
    controller._handle_override(f"FORCE_{target.value}", "operator")
    if initial == target:
        assert controller.fsm.phase == target
        return

    expected = Phase.ALL_RED_B_to_A if target == Phase.GREEN_A else Phase.ALL_RED_A_to_B
    assert controller.fsm.phase == expected
    assert controller.fsm.phase_will_end_at == clock[0] + 5.0
    clock[0] += 4.99
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == expected
    clock[0] += 0.01
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == target


@pytest.mark.parametrize("action", ["FORCE_GREEN_A", "FORCE_GREEN_B"])
async def test_all_red_cancels_pending_force_and_remains_latched(controller, clock, action):
    controller._handle_override(action, "operator")
    controller._handle_override("ALL_RED", "operator")
    clock[0] += 100.0
    controller.safety.on_midzone([], [])
    controller._advance_phase(clock[0])
    await asyncio.sleep(0)
    assert controller.fsm.phase == Phase.EMERGENCY
    assert controller.fsm.phase_will_end_at is None


async def test_later_force_replaces_direction_and_restarts_full_clearance(controller, clock):
    controller._handle_override("FORCE_GREEN_A", "first")
    clock[0] += 4.0
    controller._handle_override("FORCE_GREEN_B", "second")
    assert controller.fsm.phase == Phase.ALL_RED_A_to_B
    assert controller.fsm.phase_will_end_at == clock[0] + 5.0
    clock[0] += 1.0
    controller.safety.on_midzone([], [])
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.ALL_RED_A_to_B
    clock[0] += 4.0
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.GREEN_B


@pytest.mark.parametrize("blocker", ["occupied", "stuck", "entry_a", "entry_b", "stale", "missing"])
async def test_expired_clearance_waits_for_confirmed_empty_corridor(controller, clock, blocker):
    controller._handle_override("FORCE_GREEN_A", "operator")
    if blocker != "missing":
        controller.safety.on_midzone([], [])
    clock[0] += 6.0
    if blocker == "occupied":
        controller.safety.on_midzone(["car"], [])
    elif blocker == "stuck":
        controller.safety.on_midzone([], ["truck"])
    elif blocker in ("entry_a", "entry_b"):
        side = "A" if blocker == "entry_a" else "B"
        controller.safety.on_entry(side, "car")
        controller.safety.on_midzone([], [])
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.ALL_RED_B_to_A

    if blocker in ("entry_a", "entry_b"):
        controller.safety.on_exit("B" if blocker == "entry_a" else "A", "car")
    controller.safety.on_midzone([], [])
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.GREEN_A


async def test_initial_clearance_also_requires_sensor_evidence(controller, clock):
    clock[0] += 20.0
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.ALL_RED_A_to_B
    controller.safety.on_midzone([], [])
    controller._advance_phase(clock[0])
    assert controller.fsm.phase == Phase.GREEN_B


@pytest.mark.parametrize("topic,data,callback,args", [
    ("traffic/sensor/A/entry", {"vehicle_id": "car", "vehicle_class": "car", "confidence": .9, "ts": 1},
     "on_entry", ("A", "car", "car", .9, 1.0)),
    ("traffic/sensor/B/exit", {"vehicle_id": "car", "vehicle_class": "car", "confidence": .9, "ts": 2},
     "on_exit", ("B", "car", "car", .9, 2.0)),
    ("traffic/sensor/midzone", {"vehicles_in_zone": ["car"], "stuck_ids": [], "ts": 3},
     "on_midzone", (["car"], [], 3.0)),
    ("traffic/cmd/override", {"action": "FORCE_GREEN_A", "operator": "test"},
     "on_override", ("FORCE_GREEN_A", "test")),
    ("traffic/cmd/scenario", {"scenario_id": "rush_hour", "mode": "adaptive"},
     "on_scenario", ("rush_hour", "adaptive")),
])
async def test_worker_thread_dispatches_callbacks_on_application_loop(topic, data, callback, args):
    main_thread = threading.get_ident()
    received = asyncio.get_running_loop().create_future()

    def handle(*values):
        received.set_result((threading.get_ident(), values))

    bridge = MqttBridge(**{callback: handle})
    bridge._client = MagicMock()
    bridge.start()
    try:
        await asyncio.to_thread(bridge._handle_message, None, None, message(topic, data))
        thread_id, values = await asyncio.wait_for(received, timeout=1)
        assert thread_id == main_thread
        assert values == args
    finally:
        bridge.stop()


async def test_actual_override_from_mqtt_worker_publishes_state_and_log(controller, clock):
    controller.mqtt.start()
    try:
        await asyncio.to_thread(controller.mqtt._handle_message, None, None, message(
            "traffic/cmd/override", {"action": "FORCE_GREEN_A", "operator": "synthetic"}
        ))
        await asyncio.sleep(0)
        assert controller.fsm.phase == Phase.ALL_RED_B_to_A
        broadcasts = controller.gateway.broadcast.await_args_list
        assert any(call.args[0] == "traffic/state/phase" for call in broadcasts)
        assert any(call.args[0] == "traffic/event/log" and call.args[1]["code"] == "OVERRIDE"
                   for call in broadcasts)
    finally:
        controller.mqtt.stop()


@pytest.mark.parametrize("restart", [False, True])
async def test_stop_discards_already_queued_messages(restart):
    received = []
    bridge = MqttBridge(on_override=lambda *args: received.append(args))
    bridge._client = MagicMock()
    bridge.start()
    bridge._dispatch_override({"action": "FORCE_GREEN_A", "operator": "test"})
    bridge.stop()
    if restart:
        bridge.start()
    await asyncio.sleep(0)
    assert received == []
    if restart:
        bridge.stop()


@pytest.mark.parametrize("data", [[], None, "invalid"])
async def test_non_object_json_is_ignored(data):
    received = MagicMock()
    bridge = MqttBridge(on_override=received)
    bridge._client = MagicMock()
    bridge.start()
    try:
        await asyncio.to_thread(bridge._handle_message, None, None, message("traffic/cmd/override", data))
        await asyncio.sleep(0)
        received.assert_not_called()
    finally:
        bridge.stop()


def test_fsm_green_gate_only_blocks_opening_green(clock):
    fsm = TrafficFSM()
    clock[0] += 6.0
    assert not fsm.tick(allow_green=False)
    assert fsm.phase == Phase.ALL_RED_A_to_B
    assert fsm.tick(allow_green=True)
    fsm.set_green_end_time(clock[0])
    assert fsm.tick(allow_green=False)
    assert fsm.phase == Phase.ALL_RED_B_to_A


def test_directional_release_does_not_allow_green_directly():
    fsm = TrafficFSM()
    assert not fsm.release_override(Phase.GREEN_A, "not in override")
    fsm.request_transition(Phase.EMERGENCY, "operator")
    assert fsm.release_override(Phase.GREEN_A, "resume")
    assert fsm.phase == Phase.ALL_RED_B_to_A
    with pytest.raises(ValueError, match="green phase"):
        fsm.release_override(Phase.EMERGENCY, "invalid")
