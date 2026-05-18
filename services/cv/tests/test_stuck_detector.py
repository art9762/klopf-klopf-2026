"""Tests for stuck_detector.py."""

import pytest

from cv_service.stuck_detector import StuckDetector


class TestStuckDetector:
    def test_not_stuck_initially(self):
        sd = StuckDetector(stuck_seconds=5.0)
        sd.update("trk_1", (100, 100), now=0.0)
        assert sd.is_stuck("trk_1", now=0.0) is False

    def test_stuck_after_threshold(self):
        sd = StuckDetector(stuck_seconds=5.0, move_threshold_px=10.0)
        sd.update("trk_1", (100, 100), now=0.0)
        sd.update("trk_1", (101, 100), now=3.0)  # moved <threshold
        sd.update("trk_1", (102, 100), now=6.0)  # still <threshold from last real move
        assert sd.is_stuck("trk_1", now=6.0) is True

    def test_not_stuck_if_moving(self):
        sd = StuckDetector(stuck_seconds=5.0, move_threshold_px=10.0)
        sd.update("trk_1", (100, 100), now=0.0)
        sd.update("trk_1", (200, 100), now=6.0)  # big move
        assert sd.is_stuck("trk_1", now=6.0) is False

    def test_get_stuck_ids(self):
        sd = StuckDetector(stuck_seconds=5.0, move_threshold_px=10.0)
        sd.update("trk_1", (100, 100), now=0.0)
        sd.update("trk_2", (200, 200), now=0.0)
        sd.update("trk_1", (101, 100), now=6.0)
        sd.update("trk_2", (300, 200), now=6.0)  # moved
        stuck = sd.get_stuck_ids(["trk_1", "trk_2"], now=6.0)
        assert "trk_1" in stuck
        assert "trk_2" not in stuck

    def test_remove(self):
        sd = StuckDetector(stuck_seconds=5.0)
        sd.update("trk_1", (100, 100), now=0.0)
        sd.remove("trk_1")
        assert sd.is_stuck("trk_1", now=10.0) is False

    def test_cleanup(self):
        sd = StuckDetector(stuck_seconds=5.0)
        sd.update("trk_1", (100, 100), now=0.0)
        sd.update("trk_2", (200, 200), now=0.0)
        sd.cleanup({"trk_1"})
        assert sd.is_stuck("trk_2", now=10.0) is False  # removed by cleanup

    def test_unknown_id(self):
        sd = StuckDetector(stuck_seconds=5.0)
        assert sd.is_stuck("nonexistent", now=100.0) is False
