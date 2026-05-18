"""Interactive zone picker: click points on the first frame to define zones.

Usage:
    uv run python configs/zone_picker.py --video ../videos/rush_hour.mp4 --output rush_hour.json

Instructions:
    1. Click 2 points for entry_A line (blue)
    2. Click 2 points for exit_A line (cyan)
    3. Click 2 points for entry_B line (green)
    4. Click 2 points for exit_B line (yellow)
    5. Click N points for midzone polygon (red), press ENTER when done
    6. Config saved to --output path
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def main() -> int:
    parser = argparse.ArgumentParser(description="Zone picker: define entry/exit lines and midzone polygon")
    parser.add_argument("--video", type=str, required=True, help="Path to video file")
    parser.add_argument("--output", type=str, required=True, help="Output JSON config path")
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print(f"Cannot open video: {args.video}", file=sys.stderr)
        return 1

    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("Cannot read first frame", file=sys.stderr)
        return 1

    points: list[tuple[int, int]] = []
    display = frame.copy()

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            points.append((x, y))
            cv2.circle(display, (x, y), 5, (0, 0, 255), -1)
            if len(points) > 1:
                cv2.line(display, points[-2], points[-1], (0, 255, 0), 2)
            cv2.imshow("Zone Picker", display)

    cv2.namedWindow("Zone Picker", cv2.WINDOW_NORMAL)
    cv2.setMouseCallback("Zone Picker", on_mouse)

    lines_config: dict[str, list] = {}
    line_names = ["entry_A", "exit_A", "entry_B", "exit_B"]

    for name in line_names:
        points.clear()
        print(f"Click 2 points for {name} line, then press any key...")
        cv2.setWindowTitle("Zone Picker", f"Zone Picker - {name} (click 2 points)")
        cv2.imshow("Zone Picker", display)

        while len(points) < 2:
            key = cv2.waitKey(50)
            if key == 27:
                cv2.destroyAllWindows()
                return 1

        lines_config[name] = [list(points[0]), list(points[1])]
        pt1, pt2 = points[0], points[1]
        colors = {"entry_A": (255, 0, 0), "exit_A": (255, 255, 0), "entry_B": (0, 255, 0), "exit_B": (0, 255, 255)}
        cv2.line(display, pt1, pt2, colors.get(name, (255, 255, 255)), 2)
        cv2.putText(display, name, pt1, cv2.FONT_HERSHEY_SIMPLEX, 0.6, colors.get(name, (255, 255, 255)), 2)
        cv2.imshow("Zone Picker", display)
        cv2.waitKey(300)

    points.clear()
    print("Click points for midzone polygon, press ENTER when done...")
    cv2.setWindowTitle("Zone Picker", "Zone Picker - midzone polygon (ENTER to finish)")
    cv2.imshow("Zone Picker", display)

    while True:
        key = cv2.waitKey(50)
        if key == 13:  # ENTER
            break
        if key == 27:  # ESC
            cv2.destroyAllWindows()
            return 1

    if len(points) < 3:
        print("Need at least 3 points for polygon", file=sys.stderr)
        cv2.destroyAllWindows()
        return 1

    midzone = [list(p) for p in points]
    poly_pts = np.array(midzone, dtype=np.int32)
    cv2.polylines(display, [poly_pts], isClosed=True, color=(0, 0, 255), thickness=2)
    cv2.imshow("Zone Picker", display)
    cv2.waitKey(1000)
    cv2.destroyAllWindows()

    config = {**lines_config, "midzone": midzone}
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(config, indent=2))
    print(f"Saved config to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
