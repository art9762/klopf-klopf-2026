"""CV service main pipeline.

Reads video, runs YOLO+ByteTrack, detects line crossings (entry/exit),
monitors midzone occupancy, publishes MQTT events per contracts.

Usage:
    uv run python -m cv_service --video videos/rush.mp4 --config configs/rush.json --speed 4x
    uv run python -m cv_service --scenario rush_hour
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from pathlib import Path

import cv2
import paho.mqtt.client as mqtt

from cv_service.publisher import MQTTPublisher
from cv_service.stuck_detector import StuckDetector
from cv_service.tracker import VehicleTracker
from cv_service.zones import ZoneConfig, bbox_center, crossed_line, point_in_polygon

SCENARIOS_DIR = Path(__file__).resolve().parents[2] / "videos"
CONFIGS_DIR = Path(__file__).resolve().parents[2] / "configs"

SCENARIO_VIDEO_MAP: dict[str, str] = {
    "baseline": "baseline.mp4",
    "rush_hour": "rush_hour.mp4",
    "stuck_truck": "stuck_truck.mp4",
    "emergency": "baseline.mp4",
    "comm_loss": "baseline.mp4",
}

SCENARIO_CONFIG_MAP: dict[str, str] = {
    "baseline": "baseline.json",
    "rush_hour": "rush_hour.json",
    "stuck_truck": "stuck_truck.json",
    "emergency": "baseline.json",
    "comm_loss": "baseline.json",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cv_service",
        description="CV pipeline: video -> MQTT events (entry/exit/midzone).",
    )
    parser.add_argument("--video", type=str, default=None, help="Path to input video file.")
    parser.add_argument("--config", type=str, default=None, help="Path to zones config JSON.")
    parser.add_argument("--speed", type=str, default="1x", help="Playback speed (e.g. 0.5x, 1x, 4x).")
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["baseline", "rush_hour", "stuck_truck", "emergency", "comm_loss"],
        default=None,
        help="Pre-baked scenario id (overrides --video/--config).",
    )
    parser.add_argument("--mqtt-host", type=str, default="localhost", help="MQTT broker host.")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port.")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="YOLO model weights.")
    parser.add_argument("--conf", type=float, default=0.35, help="Detection confidence threshold.")
    parser.add_argument("--show", action="store_true", help="Show annotated video window (debug).")
    parser.add_argument("--stuck-seconds", type=float, default=30.0, help="Seconds before flagging stuck.")
    return parser


def parse_speed(speed_str: str) -> float:
    return float(speed_str.lower().replace("x", ""))


class CVPipeline:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.speed = parse_speed(args.speed)
        self._resolve_paths()

        self.tracker = VehicleTracker(model_path=args.model, confidence=args.conf)
        self.zones = ZoneConfig.from_json(self.config_path)
        self.stuck = StuckDetector(stuck_seconds=args.stuck_seconds)
        self.publisher = MQTTPublisher(host=args.mqtt_host, port=args.mqtt_port)

        self._prev_centers: dict[str, tuple[float, float]] = {}
        self._in_midzone: set[str] = set()
        self._last_midzone_publish: float = 0.0
        self._running = True
        self._scenario_event = threading.Event()

    def _resolve_paths(self) -> None:
        if self.args.scenario:
            self.video_path = SCENARIOS_DIR / SCENARIO_VIDEO_MAP[self.args.scenario]
            self.config_path = CONFIGS_DIR / SCENARIO_CONFIG_MAP[self.args.scenario]
        else:
            if not self.args.video or not self.args.config:
                print("Error: --video and --config required when not using --scenario", file=sys.stderr)
                sys.exit(1)
            self.video_path = Path(self.args.video)
            self.config_path = Path(self.args.config)

        if not self.video_path.exists():
            print(f"Error: video not found: {self.video_path}", file=sys.stderr)
            sys.exit(1)
        if not self.config_path.exists():
            print(f"Error: config not found: {self.config_path}", file=sys.stderr)
            sys.exit(1)

    def _setup_scenario_listener(self) -> None:
        def on_message(client, userdata, msg):
            try:
                payload = json.loads(msg.payload)
                scenario_id = payload.get("scenario_id")
                if scenario_id and scenario_id in SCENARIO_VIDEO_MAP:
                    self.args.scenario = scenario_id
                    self._resolve_paths()
                    self._scenario_event.set()
            except Exception:
                pass

        sub_client = mqtt.Client(
            client_id="cv_service_sub",
            protocol=mqtt.MQTTv5,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        sub_client.on_message = on_message
        sub_client.connect(self.args.mqtt_host, self.args.mqtt_port)
        sub_client.subscribe("traffic/cmd/scenario", qos=0)
        sub_client.loop_start()

    def run(self) -> int:
        self.publisher.connect()
        self._setup_scenario_listener()
        print(f"[cv] starting pipeline: video={self.video_path.name} speed={self.speed}x")

        while self._running:
            self._scenario_event.clear()
            self._run_video()
            if not self._scenario_event.wait(timeout=1.0):
                break

        self.publisher.disconnect()
        return 0

    def _run_video(self) -> None:
        self._prev_centers.clear()
        self._in_midzone.clear()
        self.stuck = StuckDetector(stuck_seconds=self.args.stuck_seconds)

        for frame_result in self.tracker.process_video(self.video_path, speed=self.speed):
            if self._scenario_event.is_set():
                return

            now = time.time()
            current_ids: set[str] = set()

            for v in frame_result.vehicles:
                center = bbox_center(v.bbox)
                vid = v.track_id
                current_ids.add(vid)

                prev = self._prev_centers.get(vid)
                if prev is not None:
                    self._check_crossings(vid, prev, center, v.class_name, v.confidence)

                in_zone = point_in_polygon(center, self.zones.midzone)
                if in_zone:
                    self._in_midzone.add(vid)
                    self.stuck.update(vid, center, now)
                else:
                    self._in_midzone.discard(vid)
                    self.stuck.remove(vid)

                self._prev_centers[vid] = center

            gone = set(self._prev_centers.keys()) - current_ids
            for vid in gone:
                del self._prev_centers[vid]
                self._in_midzone.discard(vid)
                self.stuck.remove(vid)

            self.stuck.cleanup(current_ids)

            if now - self._last_midzone_publish >= 1.0:
                zone_list = sorted(self._in_midzone)
                stuck_list = self.stuck.get_stuck_ids(zone_list, now)
                self.publisher.publish_midzone(zone_list, stuck_list)
                self._last_midzone_publish = now

            if self.args.show:
                self._show_debug(frame_result)

            if self.speed < 1.0 and frame_result.fps > 0:
                time.sleep((1.0 / frame_result.fps) * (1.0 / self.speed - 1.0))

        if self.args.show:
            cv2.destroyAllWindows()

    def _check_crossings(
        self, vid: str, prev: tuple[float, float], cur: tuple[float, float],
        class_name: str, confidence: float,
    ) -> None:
        for side in ("A", "B"):
            entry_line = self.zones.get_line(side, "entry")
            if crossed_line(prev, cur, entry_line):
                self.publisher.publish_entry(side, vid, class_name, confidence)

            exit_line = self.zones.get_line(side, "exit")
            if crossed_line(prev, cur, exit_line):
                self.publisher.publish_exit(side, vid, class_name, confidence)

    def _show_debug(self, frame_result) -> None:
        frame = frame_result.frame.copy()
        for v in frame_result.vehicles:
            x1, y1, x2, y2 = [int(c) for c in v.bbox]
            color = (0, 0, 255) if v.track_id in self._in_midzone else (0, 255, 0)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{v.track_id} {v.class_name}"
            cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        for side in ("A", "B"):
            for event, clr in [("entry", (255, 0, 0)), ("exit", (0, 255, 255))]:
                line = self.zones.get_line(side, event)
                pt1 = (int(line[0][0]), int(line[0][1]))
                pt2 = (int(line[1][0]), int(line[1][1]))
                cv2.line(frame, pt1, pt2, clr, 2)
                cv2.putText(frame, f"{event}_{side}", pt1, cv2.FONT_HERSHEY_SIMPLEX, 0.4, clr, 1)

        cv2.imshow("CV Service Debug", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            self._running = False


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    pipeline = CVPipeline(args)
    return pipeline.run()


if __name__ == "__main__":
    raise SystemExit(main())
