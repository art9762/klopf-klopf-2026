"""YOLOv8n + ByteTrack vehicle tracker.

TODO: load YOLO model, run inference per frame, attach ByteTrack IDs,
yield (track_id, bbox, class, confidence) tuples downstream.
"""

from __future__ import annotations
