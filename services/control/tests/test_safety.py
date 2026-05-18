from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from control.safety import PHASE_GREEN_A, PHASE_GREEN_B, SafetyChecker


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _checker() -> SafetyChecker:
    return SafetyChecker(estimated_traverse_time=120.0)


# ---------------------------------------------------------------------------
# on_entry / on_exit counter tests
# ---------------------------------------------------------------------------

class TestCounters:
    def test_entry_a_increments_count_in_a(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        assert sc.count_in_a == 1
        assert sc.count_in_b == 0

    def test_entry_b_increments_count_in_b(self) -> None:
        sc = _checker()
        sc.on_entry("B", "v1")
        assert sc.count_in_b == 1

    def test_exit_b_increments_count_out_b(self) -> None:
        sc = _checker()
        sc.on_exit("B", "v1")
        assert sc.count_out_b == 1
        assert sc.count_out_a == 0

    def test_exit_a_increments_count_out_a(self) -> None:
        sc = _checker()
        sc.on_exit("A", "v1")
        assert sc.count_out_a == 1

    def test_invalid_side_entry_raises(self) -> None:
        sc = _checker()
        with pytest.raises(ValueError):
            sc.on_entry("C", "v1")

    def test_invalid_side_exit_raises(self) -> None:
        sc = _checker()
        with pytest.raises(ValueError):
            sc.on_exit("C", "v1")

    def test_reset_clears_all_counters(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        sc.on_exit("B", "v1")
        sc.reset_counters()
        assert sc.count_in_a == 0
        assert sc.count_out_b == 0
        assert sc.vehicles_in_zone == set()
        assert sc.last_midzone_ts is None


# ---------------------------------------------------------------------------
# is_zone_clear tests
# ---------------------------------------------------------------------------

class TestIsZoneClear:
    def test_green_a_clear_when_counts_match_and_zone_empty(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        sc.on_exit("B", "v1")
        sc.on_midzone([], [])
        assert sc.is_zone_clear(PHASE_GREEN_A) is True

    def test_green_a_not_clear_when_counts_mismatch(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        sc.on_midzone([], [])
        assert sc.is_zone_clear(PHASE_GREEN_A) is False

    def test_green_a_not_clear_when_zone_occupied(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        sc.on_exit("B", "v1")
        sc.on_midzone(["v2"], [])
        assert sc.is_zone_clear(PHASE_GREEN_A) is False

    def test_green_b_clear_when_counts_match_and_zone_empty(self) -> None:
        sc = _checker()
        sc.on_entry("B", "v1")
        sc.on_exit("A", "v1")
        sc.on_midzone([], [])
        assert sc.is_zone_clear(PHASE_GREEN_B) is True

    def test_green_b_not_clear_when_counts_mismatch(self) -> None:
        sc = _checker()
        sc.on_entry("B", "v1")
        sc.on_midzone([], [])
        assert sc.is_zone_clear(PHASE_GREEN_B) is False

    def test_unknown_phase_returns_false(self) -> None:
        sc = _checker()
        sc.on_midzone([], [])
        assert sc.is_zone_clear("YELLOW") is False

    def test_both_zero_counts_green_a_is_clear(self) -> None:
        sc = _checker()
        sc.on_midzone([], [])
        assert sc.is_zone_clear(PHASE_GREEN_A) is True


# ---------------------------------------------------------------------------
# on_midzone / stuck_ids tests
# ---------------------------------------------------------------------------

class TestMidzone:
    def test_on_midzone_updates_vehicles_in_zone(self) -> None:
        sc = _checker()
        sc.on_midzone(["v1", "v2"], [])
        assert sc.vehicles_in_zone == {"v1", "v2"}

    def test_on_midzone_updates_stuck_ids(self) -> None:
        sc = _checker()
        sc.on_midzone(["v1"], ["v1"])
        assert sc.get_stuck_vehicles() == ["v1"]

    def test_on_midzone_updates_timestamp(self) -> None:
        sc = _checker()
        before = time.time()
        sc.on_midzone([], [])
        assert sc.last_midzone_ts is not None
        assert sc.last_midzone_ts >= before


# ---------------------------------------------------------------------------
# is_comm_healthy tests
# ---------------------------------------------------------------------------

class TestCommHealthy:
    def test_healthy_when_recent_message(self) -> None:
        sc = _checker()
        sc.on_midzone([], [])
        assert sc.is_comm_healthy(timeout=5.0) is True

    def test_unhealthy_when_no_message_received(self) -> None:
        sc = _checker()
        assert sc.is_comm_healthy(timeout=5.0) is False

    def test_unhealthy_when_message_too_old(self) -> None:
        sc = _checker()
        sc.last_midzone_ts = time.time() - 10.0
        assert sc.is_comm_healthy(timeout=5.0) is False


# ---------------------------------------------------------------------------
# Hard timeout / STUCK_VEHICLE tests
# ---------------------------------------------------------------------------

class TestHardTimeout:
    def test_vehicle_flagged_stuck_after_threshold(self) -> None:
        sc = SafetyChecker(estimated_traverse_time=120.0)
        sc.on_entry("A", "v_slow")
        # Simulate that the vehicle entered 181+ seconds ago
        sc._zone_entries["v_slow"] = time.time() - 181.0
        sc.on_midzone(["v_slow"], [])
        assert "v_slow" in sc.stuck_ids

    def test_vehicle_not_flagged_before_threshold(self) -> None:
        sc = SafetyChecker(estimated_traverse_time=120.0)
        sc.on_entry("A", "v_ok")
        sc._zone_entries["v_ok"] = time.time() - 100.0
        sc.on_midzone(["v_ok"], [])
        assert "v_ok" not in sc.stuck_ids

    def test_reset_clears_stuck_ids(self) -> None:
        sc = _checker()
        sc.on_entry("A", "v1")
        sc._zone_entries["v1"] = time.time() - 200.0
        sc.on_midzone(["v1"], [])
        sc.reset_counters()
        assert sc.get_stuck_vehicles() == []
