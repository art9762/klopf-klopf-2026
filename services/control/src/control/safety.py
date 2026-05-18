from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Final

PHASE_GREEN_A: Final = "GREEN_A"
PHASE_GREEN_B: Final = "GREEN_B"

DEFAULT_TRAVERSE_TIME: Final[float] = 120.0  # seconds (2 km @ ~60 km/h)
STUCK_GRACE: Final[float] = 60.0             # extra seconds before STUCK flag


@dataclass
class _ZoneVehicle:
    vehicle_id: str
    entered_at: float


class SafetyChecker:
    def __init__(self, estimated_traverse_time: float = DEFAULT_TRAVERSE_TIME) -> None:
        self._traverse_time = estimated_traverse_time
        self._stuck_threshold = estimated_traverse_time + STUCK_GRACE

        self.count_in_a: int = 0
        self.count_out_b: int = 0
        self.count_in_b: int = 0
        self.count_out_a: int = 0

        self.vehicles_in_zone: set[str] = set()
        self.stuck_ids: set[str] = set()

        self._zone_entries: dict[str, float] = {}
        self.last_midzone_ts: float | None = None

    # ------------------------------------------------------------------
    # Event handlers
    # ------------------------------------------------------------------

    def on_entry(self, side: str, vehicle_id: str) -> None:
        if side == "A":
            self.count_in_a += 1
        elif side == "B":
            self.count_in_b += 1
        else:
            raise ValueError(f"Unknown side: {side!r}")
        self._zone_entries[vehicle_id] = time.time()

    def on_exit(self, side: str, vehicle_id: str) -> None:
        if side == "B":
            self.count_out_b += 1
        elif side == "A":
            self.count_out_a += 1
        else:
            raise ValueError(f"Unknown side: {side!r}")
        self._zone_entries.pop(vehicle_id, None)

    def on_midzone(self, vehicles_in_zone: list[str], stuck_ids: list[str]) -> None:
        self.last_midzone_ts = time.time()
        self.vehicles_in_zone = set(vehicles_in_zone)
        self.stuck_ids = set(stuck_ids)
        self._check_hard_timeout()

    # ------------------------------------------------------------------
    # Safety queries
    # ------------------------------------------------------------------

    def is_zone_clear(self, current_phase: str) -> bool:
        if self.vehicles_in_zone:
            return False
        if current_phase == PHASE_GREEN_A:
            return self.count_in_a == self.count_out_b
        if current_phase == PHASE_GREEN_B:
            return self.count_in_b == self.count_out_a
        return False

    def is_comm_healthy(self, timeout: float = 5.0) -> bool:
        if self.last_midzone_ts is None:
            return False
        return (time.time() - self.last_midzone_ts) <= timeout

    def get_stuck_vehicles(self) -> list[str]:
        return list(self.stuck_ids)

    def reset_counters(self) -> None:
        self.count_in_a = 0
        self.count_out_b = 0
        self.count_in_b = 0
        self.count_out_a = 0
        self.vehicles_in_zone = set()
        self.stuck_ids = set()
        self._zone_entries.clear()
        self.last_midzone_ts = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _check_hard_timeout(self) -> None:
        now = time.time()
        for vid, entered_at in self._zone_entries.items():
            if (now - entered_at) > self._stuck_threshold:
                self.stuck_ids.add(vid)
