from __future__ import annotations

import time
from unittest.mock import patch

from control.fsm import Phase, PhaseState, TrafficFSM


class TestFSMInitialization:
    def test_starts_in_all_red(self):
        fsm = TrafficFSM()
        assert fsm.phase == Phase.ALL_RED_A_to_B

    def test_initial_reason_is_init(self):
        fsm = TrafficFSM()
        assert fsm.reason == "init"

    def test_initial_end_time_is_set(self):
        fsm = TrafficFSM(all_red_duration=5.0)
        assert fsm.phase_will_end_at is not None
        assert fsm.phase_will_end_at > fsm.phase_started_at


class TestNormalTransitions:
    def test_all_red_to_green_b(self):
        fsm = TrafficFSM()
        assert fsm.can_transition(Phase.GREEN_B)
        assert fsm.request_transition(Phase.GREEN_B, "test")
        assert fsm.phase == Phase.GREEN_B

    def test_green_b_to_all_red_b_to_a(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.GREEN_B, "test")
        assert fsm.can_transition(Phase.ALL_RED_B_to_A)
        assert fsm.request_transition(Phase.ALL_RED_B_to_A, "queue_pressure")
        assert fsm.phase == Phase.ALL_RED_B_to_A

    def test_full_cycle(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.GREEN_B, "test")
        fsm.request_transition(Phase.ALL_RED_B_to_A, "test")
        fsm.request_transition(Phase.GREEN_A, "test")
        fsm.request_transition(Phase.ALL_RED_A_to_B, "test")
        fsm.request_transition(Phase.GREEN_B, "test")
        assert fsm.phase == Phase.GREEN_B

    def test_cannot_skip_phases(self):
        fsm = TrafficFSM()
        assert not fsm.can_transition(Phase.GREEN_A)
        assert not fsm.request_transition(Phase.GREEN_A, "test")
        assert fsm.phase == Phase.ALL_RED_A_to_B

    def test_cannot_transition_to_same_phase(self):
        fsm = TrafficFSM()
        assert not fsm.can_transition(Phase.ALL_RED_A_to_B)


class TestOverridePhases:
    def test_emergency_from_green(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.GREEN_B, "test")
        assert fsm.can_transition(Phase.EMERGENCY)
        fsm.request_transition(Phase.EMERGENCY, "ambulance")
        assert fsm.phase == Phase.EMERGENCY

    def test_manual_from_any_state(self):
        fsm = TrafficFSM()
        assert fsm.can_transition(Phase.MANUAL)
        fsm.request_transition(Phase.MANUAL, "operator")
        assert fsm.phase == Phase.MANUAL

    def test_release_override_goes_to_all_red(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.GREEN_B, "test")
        fsm.request_transition(Phase.EMERGENCY, "test")
        assert fsm.can_transition(Phase.ALL_RED_A_to_B)
        fsm.request_transition(Phase.ALL_RED_A_to_B, "release")
        assert fsm.phase == Phase.ALL_RED_A_to_B

    def test_cannot_go_directly_to_green_from_override(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.EMERGENCY, "test")
        assert not fsm.can_transition(Phase.GREEN_A)
        assert not fsm.can_transition(Phase.GREEN_B)

    def test_override_has_no_end_time(self):
        fsm = TrafficFSM()
        fsm.request_transition(Phase.EMERGENCY, "test")
        assert fsm.phase_will_end_at is None


class TestTick:
    def test_tick_advances_all_red_to_green(self):
        fsm = TrafficFSM(all_red_duration=0.01)
        with patch("time.time", return_value=time.time() + 1.0):
            assert fsm.tick()
        assert fsm.phase == Phase.GREEN_B

    def test_tick_does_not_advance_before_end_time(self):
        fsm = TrafficFSM(all_red_duration=100.0)
        assert not fsm.tick()
        assert fsm.phase == Phase.ALL_RED_A_to_B

    def test_tick_does_not_advance_override(self):
        fsm = TrafficFSM(all_red_duration=0.01)
        fsm.request_transition(Phase.EMERGENCY, "test")
        with patch("time.time", return_value=time.time() + 100.0):
            assert not fsm.tick()
        assert fsm.phase == Phase.EMERGENCY

    def test_tick_does_not_advance_green_without_end_time(self):
        fsm = TrafficFSM(all_red_duration=0.01)
        with patch("time.time", return_value=time.time() + 1.0):
            fsm.tick()
        assert fsm.phase == Phase.GREEN_B
        assert fsm.phase_will_end_at is None
        with patch("time.time", return_value=time.time() + 1000.0):
            assert not fsm.tick()


class TestSetGreenEndTime:
    def test_set_end_time_on_green_phase(self):
        fsm = TrafficFSM(all_red_duration=0.01)
        with patch("time.time", return_value=time.time() + 1.0):
            fsm.tick()
        assert fsm.phase == Phase.GREEN_B
        end = time.time() + 60.0
        fsm.set_green_end_time(end)
        assert fsm.phase_will_end_at == end

    def test_set_end_time_on_non_green_raises(self):
        fsm = TrafficFSM()
        try:
            fsm.set_green_end_time(time.time() + 10.0)
            assert False, "Should have raised"
        except ValueError:
            pass


class TestCallback:
    def test_callback_called_on_transition(self):
        states: list[PhaseState] = []
        fsm = TrafficFSM(on_phase_change=states.append)
        fsm.request_transition(Phase.GREEN_B, "test_reason")
        assert len(states) == 1
        assert states[0].phase == Phase.GREEN_B
        assert states[0].reason == "test_reason"

    def test_callback_called_on_tick(self):
        states: list[PhaseState] = []
        fsm = TrafficFSM(all_red_duration=0.01, on_phase_change=states.append)
        with patch("time.time", return_value=time.time() + 1.0):
            fsm.tick()
        assert len(states) == 1
        assert states[0].phase == Phase.GREEN_B


class TestStateSnapshot:
    def test_snapshot_returns_current_state(self):
        fsm = TrafficFSM()
        snap = fsm.state_snapshot()
        assert snap.phase == Phase.ALL_RED_A_to_B
        assert snap.reason == "init"
        assert isinstance(snap.ts, float)
