"""Stuck-vehicle detector.

Tracks centroid positions per vehicle over time. If a vehicle's centroid
hasn't moved beyond a threshold distance for longer than `stuck_seconds`,
it is flagged as stuck.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from cv_service.zones import Point


@dataclass
class _TrackState:
    last_center: Point
    last_move_time: float
    first_seen: float


@dataclass
class StuckDetector:
    stuck_seconds: float = 30.0
    move_threshold_px: float = 15.0
    _tracks: dict[str, _TrackState] = field(default_factory=dict, init=False)

    def update(self, vehicle_id: str, center: Point, now: float | None = None) -> None:
        now = time.time() if now is None else now
        if vehicle_id not in self._tracks:
            self._tracks[vehicle_id] = _TrackState(
                last_center=center,
                last_move_time=now,
                first_seen=now,
            )
            return
        state = self._tracks[vehicle_id]
        dx = center[0] - state.last_center[0]
        dy = center[1] - state.last_center[1]
        dist = (dx * dx + dy * dy) ** 0.5
        if dist > self.move_threshold_px:
            state.last_center = center
            state.last_move_time = now

    def is_stuck(self, vehicle_id: str, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        state = self._tracks.get(vehicle_id)
        if state is None:
            return False
        return (now - state.last_move_time) >= self.stuck_seconds

    def get_stuck_ids(self, active_ids: list[str], now: float | None = None) -> list[str]:
        now = time.time() if now is None else now
        return [vid for vid in active_ids if self.is_stuck(vid, now)]

    def remove(self, vehicle_id: str) -> None:
        self._tracks.pop(vehicle_id, None)

    def cleanup(self, active_ids: set[str]) -> None:
        gone = [k for k in self._tracks if k not in active_ids]
        for k in gone:
            del self._tracks[k]
