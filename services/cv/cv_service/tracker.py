"""YOLOv8n + ByteTrack vehicle tracker via ultralytics + supervision.

Yields per-frame tracking results: list of (track_id, bbox_xyxy, class_name, confidence).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Generator

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

VEHICLE_COCO_IDS = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


@dataclass
class TrackedVehicle:
    track_id: str
    bbox: tuple[float, float, float, float]
    class_name: str
    confidence: float


@dataclass
class FrameResult:
    frame_idx: int
    frame: np.ndarray
    vehicles: list[TrackedVehicle]
    fps: float = 0.0


@dataclass
class VehicleTracker:
    model_path: str = "yolov8n.pt"
    confidence: float = 0.35
    iou_threshold: float = 0.5
    _model: YOLO = field(init=False, repr=False)
    _tracker: sv.ByteTrack = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._model = YOLO(self.model_path)
        self._tracker = sv.ByteTrack(
            track_activation_threshold=self.confidence,
            minimum_matching_threshold=self.iou_threshold,
            frame_rate=30,
        )

    def process_video(
        self,
        video_path: str | Path,
        speed: float = 1.0,
        max_frames: int | None = None,
    ) -> Generator[FrameResult, None, None]:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_skip = max(1, int(speed)) if speed > 1 else 1
        frame_idx = 0
        yielded = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if frame_skip > 1 and (frame_idx % frame_skip != 0):
                continue

            vehicles = self._detect_and_track(frame)
            yielded += 1
            yield FrameResult(
                frame_idx=frame_idx,
                frame=frame,
                vehicles=vehicles,
                fps=fps,
            )
            if max_frames and yielded >= max_frames:
                break

        cap.release()

    def process_frame(self, frame: np.ndarray, frame_idx: int = 0) -> FrameResult:
        vehicles = self._detect_and_track(frame)
        return FrameResult(frame_idx=frame_idx, frame=frame, vehicles=vehicles)

    def _detect_and_track(self, frame: np.ndarray) -> list[TrackedVehicle]:
        results = self._model.predict(
            frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            classes=list(VEHICLE_COCO_IDS.keys()),
            verbose=False,
        )
        result = results[0]
        if result.boxes is None or len(result.boxes) == 0:
            return []

        detections = sv.Detections.from_ultralytics(result)
        detections = self._tracker.update_with_detections(detections)

        vehicles: list[TrackedVehicle] = []
        for i in range(len(detections)):
            tracker_id = detections.tracker_id[i] if detections.tracker_id is not None else i
            class_id = int(detections.class_id[i]) if detections.class_id is not None else 2
            bbox = tuple(detections.xyxy[i].tolist())
            vehicles.append(TrackedVehicle(
                track_id=f"trk_{tracker_id}",
                bbox=bbox,
                class_name=VEHICLE_COCO_IDS.get(class_id, "car"),
                confidence=float(detections.confidence[i]) if detections.confidence is not None else 0.5,
            ))
        return vehicles
