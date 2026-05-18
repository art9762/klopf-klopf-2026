"""Zone geometry: entry/exit lines for sides A and B + midzone polygon.

Loads a JSON config with line coordinates and polygon vertices.
Provides helpers to detect line crossings and point-in-polygon membership.

Config JSON format:
{
  "entry_A": [[x1,y1], [x2,y2]],
  "exit_A":  [[x1,y1], [x2,y2]],
  "entry_B": [[x1,y1], [x2,y2]],
  "exit_B":  [[x1,y1], [x2,y2]],
  "midzone": [[x1,y1], [x2,y2], [x3,y3], ...]
}
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

Point = tuple[float, float]
Segment = tuple[Point, Point]


@dataclass(frozen=True)
class ZoneConfig:
    entry_A: Segment
    exit_A: Segment
    entry_B: Segment
    exit_B: Segment
    midzone: list[Point]

    @classmethod
    def from_json(cls, path: str | Path) -> "ZoneConfig":
        data = json.loads(Path(path).read_text())
        return cls(
            entry_A=tuple(tuple(p) for p in data["entry_A"]),
            exit_A=tuple(tuple(p) for p in data["exit_A"]),
            entry_B=tuple(tuple(p) for p in data["entry_B"]),
            exit_B=tuple(tuple(p) for p in data["exit_B"]),
            midzone=[tuple(p) for p in data["midzone"]],
        )

    def get_line(self, side: str, event: str) -> Segment:
        return getattr(self, f"{event}_{side}")


def _cross(o: Point, a: Point, b: Point) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    """Return True if segment p1-p2 crosses segment p3-p4."""
    d1 = _cross(p3, p4, p1)
    d2 = _cross(p3, p4, p2)
    d3 = _cross(p1, p2, p3)
    d4 = _cross(p1, p2, p4)
    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False


def crossed_line(prev_center: Point, cur_center: Point, line: Segment) -> bool:
    """Check if movement from prev_center to cur_center crosses the given line segment."""
    return segments_intersect(prev_center, cur_center, line[0], line[1])


def point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    """Ray-casting algorithm for point-in-polygon test."""
    x, y = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def bbox_center(bbox: tuple[float, float, float, float]) -> Point:
    """Get center point from (x1, y1, x2, y2) bbox."""
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2, (y1 + y2) / 2)
