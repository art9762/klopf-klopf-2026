"""CLI entrypoint for the CV service.

Usage examples (target, not yet implemented):
    uv run python -m cv_service --video videos/rush.mp4 --config configs/rush.json --speed 4x
    uv run python -m cv_service --scenario rush_hour
"""

from __future__ import annotations

import argparse
import sys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cv_service",
        description="CV pipeline: video -> MQTT events (entry/exit/midzone).",
    )
    parser.add_argument(
        "--video",
        type=str,
        default=None,
        help="Path to input video file (e.g. videos/rush.mp4).",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to zones config JSON (e.g. configs/rush.json).",
    )
    parser.add_argument(
        "--speed",
        type=str,
        default="1x",
        help="Playback speed multiplier (e.g. 0.5x, 1x, 4x).",
    )
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["baseline", "rush_hour", "stuck_truck", "emergency", "comm_loss"],
        default=None,
        help="Pre-baked scenario id (overrides --video/--config).",
    )
    parser.add_argument(
        "--mqtt-host",
        type=str,
        default="localhost",
        help="MQTT broker host.",
    )
    parser.add_argument(
        "--mqtt-port",
        type=int,
        default=1883,
        help="MQTT broker port.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    print(
        f"[cv_service] not implemented yet. args={vars(args)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
