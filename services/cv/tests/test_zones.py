"""Tests for zones.py geometry helpers."""

import pytest

from cv_service.zones import (
    ZoneConfig,
    bbox_center,
    crossed_line,
    point_in_polygon,
    segments_intersect,
)


class TestSegmentsIntersect:
    def test_crossing(self):
        assert segments_intersect((0, 0), (10, 10), (0, 10), (10, 0)) is True

    def test_parallel(self):
        assert segments_intersect((0, 0), (10, 0), (0, 1), (10, 1)) is False

    def test_no_crossing(self):
        assert segments_intersect((0, 0), (5, 5), (6, 0), (10, 0)) is False

    def test_perpendicular_crossing(self):
        assert segments_intersect((5, 0), (5, 10), (0, 5), (10, 5)) is True

    def test_perpendicular_no_reach(self):
        assert segments_intersect((5, 0), (5, 4), (0, 5), (10, 5)) is False


class TestCrossedLine:
    def test_crosses(self):
        line = ((0, 5), (10, 5))
        assert crossed_line((5, 3), (5, 7), line) is True

    def test_no_cross(self):
        line = ((0, 5), (10, 5))
        assert crossed_line((5, 3), (5, 4), line) is False

    def test_parallel_movement(self):
        line = ((0, 5), (10, 5))
        assert crossed_line((0, 3), (10, 3), line) is False


class TestPointInPolygon:
    @pytest.fixture
    def square(self):
        return [(0, 0), (10, 0), (10, 10), (0, 10)]

    def test_inside(self, square):
        assert point_in_polygon((5, 5), square) is True

    def test_outside(self, square):
        assert point_in_polygon((15, 5), square) is False

    def test_outside_above(self, square):
        assert point_in_polygon((5, -1), square) is False

    def test_complex_polygon(self):
        poly = [(0, 0), (5, 0), (5, 5), (10, 5), (10, 10), (0, 10)]
        assert point_in_polygon((2, 2), poly) is True
        assert point_in_polygon((7, 2), poly) is False
        assert point_in_polygon((7, 7), poly) is True


class TestBboxCenter:
    def test_basic(self):
        assert bbox_center((0, 0, 10, 10)) == (5.0, 5.0)

    def test_offset(self):
        assert bbox_center((100, 200, 150, 250)) == (125.0, 225.0)
