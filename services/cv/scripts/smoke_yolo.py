"""Smoke test for YOLO detection on images or video.

Quickest way to confirm the model and our env work end to end:
    uv run python scripts/smoke_yolo.py --source datasets/VisDrone/VisDrone_Dataset/VisDrone2019-DET-val/images --limit 6
    uv run python scripts/smoke_yolo.py --source videos/your_clip.mp4 --limit 120
    uv run python scripts/smoke_yolo.py --source 0  # webcam

Outputs annotated frames to outputs/smoke/ and prints per-frame detection counts.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YOLO smoke test")
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Path to image / image-dir / video file, or '0' for webcam.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n.pt",
        help="YOLO weights. Defaults to yolov8n.pt (auto-downloaded by ultralytics).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=12,
        help="Max frames/images to process.",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.35,
        help="Confidence threshold.",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="outputs/smoke",
        help="Directory for annotated frames.",
    )
    parser.add_argument(
        "--show-all-classes",
        action="store_true",
        help="Keep non-vehicle COCO detections in the output too.",
    )
    return parser.parse_args()


def collect_image_paths(src: Path, limit: int) -> list[Path]:
    if src.is_file():
        return [src]
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    paths = sorted(p for p in src.rglob("*") if p.suffix.lower() in exts)
    return paths[:limit]


def is_video(src: str) -> bool:
    if src == "0" or src.isdigit():
        return True
    return Path(src).suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def main() -> int:
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print(
            "ultralytics not installed. Run `uv sync` in services/cv/ first.",
            file=sys.stderr,
        )
        return 2

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[smoke] loading {args.model} (will download on first run)")
    t0 = time.perf_counter()
    model = YOLO(args.model)
    print(f"[smoke] model ready in {time.perf_counter() - t0:.1f}s")

    target_classes = None if args.show_all_classes else list(VEHICLE_CLASSES.keys())

    if is_video(args.source):
        source = int(args.source) if args.source.isdigit() else args.source
        print(f"[smoke] running stream mode on {source!r}, limit={args.limit}")
        results = model.predict(
            source=source,
            stream=True,
            conf=args.conf,
            classes=target_classes,
            verbose=False,
        )
        frame_idx = 0
        for r in results:
            frame_idx += 1
            n = 0 if r.boxes is None else len(r.boxes)
            print(f"  frame {frame_idx:04d}: {n} detections")
            annotated = r.plot()
            try:
                import cv2

                cv2.imwrite(str(out_dir / f"frame_{frame_idx:04d}.jpg"), annotated)
            except Exception as e:
                print(f"  (warning: could not save frame: {e})")
            if frame_idx >= args.limit:
                break
    else:
        src = Path(args.source)
        if not src.exists():
            print(f"source not found: {src}", file=sys.stderr)
            return 1
        paths = collect_image_paths(src, args.limit)
        if not paths:
            print(f"no images found under {src}", file=sys.stderr)
            return 1
        print(f"[smoke] {len(paths)} images, conf={args.conf}")
        results = model.predict(
            source=[str(p) for p in paths],
            conf=args.conf,
            classes=target_classes,
            verbose=False,
        )
        for path, r in zip(paths, results):
            n = 0 if r.boxes is None else len(r.boxes)
            class_summary = {}
            if r.boxes is not None and n:
                for cls_id in r.boxes.cls.tolist():
                    cls_id = int(cls_id)
                    name = VEHICLE_CLASSES.get(cls_id, model.names.get(cls_id, str(cls_id)))
                    class_summary[name] = class_summary.get(name, 0) + 1
            print(f"  {path.name}: {n} detections {class_summary}")
            annotated = r.plot()
            try:
                import cv2

                cv2.imwrite(str(out_dir / path.name), annotated)
            except Exception as e:
                print(f"  (warning: could not save {path.name}: {e})")

    print(f"[smoke] done. annotated outputs -> {out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
