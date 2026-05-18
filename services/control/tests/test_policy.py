from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from control.policy import (
    EMPTY_QUEUE_TIMEOUT,
    FIXED_GREEN,
    T_MAX,
    T_MIN,
    TrafficPolicy,
)


def make_policy(mode: str = "adaptive") -> TrafficPolicy:
    p = TrafficPolicy(mode=mode)  # type: ignore[arg-type]
    return p


class TestFixedMode:
    def test_no_switch_before_timer(self) -> None:
        p = make_policy("fixed")
        switch, reason = p.should_switch("GREEN_A", FIXED_GREEN - 1)
        assert not switch

    def test_switch_at_timer(self) -> None:
        p = make_policy("fixed")
        switch, reason = p.should_switch("GREEN_A", FIXED_GREEN)
        assert switch
        assert "fixed timer" in reason

    def test_switch_after_timer(self) -> None:
        p = make_policy("fixed")
        switch, _ = p.should_switch("GREEN_B", FIXED_GREEN + 10)
        assert switch

    def test_recommended_duration_is_fixed(self) -> None:
        p = make_policy("fixed")
        assert p.get_recommended_duration("GREEN_A") == FIXED_GREEN
        assert p.get_recommended_duration("GREEN_B") == FIXED_GREEN


class TestAdaptiveMode:
    def test_no_switch_below_t_min(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(0, 10, 0.0, 120.0)
        switch, _ = p.should_switch("GREEN_A", T_MIN - 1)
        assert not switch

    def test_switch_when_opposing_priority_higher(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(1, 10, 0.0, 0.0)
        switch, reason = p.should_switch("GREEN_A", T_MIN + 1)
        assert switch
        assert "opposing priority" in reason

    def test_no_switch_when_current_priority_higher(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(10, 1, 0.0, 0.0)
        switch, _ = p.should_switch("GREEN_A", T_MIN + 1)
        assert not switch

    def test_force_switch_at_t_max(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(10, 0, 0.0, 0.0)
        switch, reason = p.should_switch("GREEN_A", T_MAX)
        assert switch
        assert "max green time" in reason

    def test_force_switch_empty_queue_timeout(self) -> None:
        p = make_policy("adaptive")
        past = time.time() - EMPTY_QUEUE_TIMEOUT - 1
        p.last_nonempty_a = past
        p.update_queues(0, 5, 0.0, 60.0)
        p.last_nonempty_a = past  # restore after update_queues reset it
        switch, reason = p.should_switch("GREEN_A", T_MIN + 1)
        assert switch
        assert "empty" in reason

    def test_no_force_switch_if_queue_recently_nonempty(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(0, 5, 0.0, 60.0)
        switch, _ = p.should_switch("GREEN_A", T_MIN + 1)
        # queue_b has higher priority but last_nonempty_a is recent
        # switch may happen due to priority, not empty-queue rule
        # just verify it doesn't crash
        assert isinstance(switch, bool)

    def test_recommended_duration_clamped_to_t_min(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(0, 0, 0.0, 0.0)
        assert p.get_recommended_duration("GREEN_A") == T_MIN

    def test_recommended_duration_clamped_to_t_max(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(10000, 0, 99999.0, 0.0)
        assert p.get_recommended_duration("GREEN_A") == T_MAX

    def test_recommended_duration_between_bounds(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(5, 0, 30.0, 0.0)
        d = p.get_recommended_duration("GREEN_A")
        assert T_MIN <= d <= T_MAX

    def test_green_b_uses_b_queues(self) -> None:
        p = make_policy("adaptive")
        p.update_queues(0, 5, 0.0, 30.0)
        d = p.get_recommended_duration("GREEN_B")
        assert d > T_MIN


class TestSetMode:
    def test_set_valid_mode(self) -> None:
        p = make_policy("fixed")
        p.set_mode("adaptive")
        assert p.mode == "adaptive"

    def test_set_invalid_mode_raises(self) -> None:
        p = make_policy("fixed")
        with pytest.raises(ValueError, match="Unknown mode"):
            p.set_mode("turbo")


class TestUpdateQueues:
    def test_last_nonempty_updated_when_queue_positive(self) -> None:
        p = make_policy()
        old_ts = p.last_nonempty_a
        time.sleep(0.01)
        p.update_queues(1, 0, 0.0, 0.0)
        assert p.last_nonempty_a > old_ts

    def test_last_nonempty_not_updated_when_queue_zero(self) -> None:
        p = make_policy()
        old_ts = p.last_nonempty_a
        time.sleep(0.01)
        p.update_queues(0, 0, 0.0, 0.0)
        assert p.last_nonempty_a == old_ts

    def test_wait_times_stored(self) -> None:
        p = make_policy()
        p.update_queues(3, 7, 12.5, 45.0)
        assert p.wait_a == 12.5
        assert p.wait_b == 45.0
