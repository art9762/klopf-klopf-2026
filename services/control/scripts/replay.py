"""Replay script: generates fake MQTT events to test the control service.

Usage:
    python scripts/replay.py [--host localhost] [--iterations 1000] [--scenario rush_hour]

Verifies that the controller never makes an unsafe phase switch
(switching while vehicles are still in the zone).
"""
from __future__ import annotations

import argparse
import json
import random
import time

import paho.mqtt.client as mqtt


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay fake traffic events")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=1883)
    parser.add_argument("--iterations", type=int, default=1000)
    parser.add_argument("--scenario", default="rush_hour")
    parser.add_argument("--speed", type=float, default=10.0)
    args = parser.parse_args()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(args.host, args.port)
    client.loop_start()

    unsafe_switches = 0
    vehicles_in_zone: set[str] = set()
    current_phase = "ALL_RED_A_to_B"
    vehicle_counter = 0

    def on_message(c: mqtt.Client, ud: object, msg: mqtt.MQTTMessage) -> None:
        nonlocal current_phase, unsafe_switches
        if msg.topic == "traffic/state/phase":
            payload = json.loads(msg.payload)
            new_phase = payload["phase"]
            if current_phase.startswith("GREEN") and new_phase.startswith("ALL_RED"):
                if vehicles_in_zone:
                    unsafe_switches += 1
                    print(f"UNSAFE SWITCH: {current_phase} -> {new_phase}, vehicles in zone: {vehicles_in_zone}")
            current_phase = new_phase

    client.subscribe("traffic/state/phase")
    client.on_message = on_message

    client.publish("traffic/cmd/scenario", json.dumps({
        "scenario_id": args.scenario, "mode": "adaptive"
    }))
    time.sleep(0.5)

    delay = 1.0 / args.speed

    for i in range(args.iterations):
        side = random.choice(["A", "B"])
        vehicle_counter += 1
        vid = f"v_{vehicle_counter}"

        client.publish(f"traffic/sensor/{side}/entry", json.dumps({
            "ts": time.time(),
            "side": side,
            "vehicle_id": vid,
            "vehicle_class": random.choice(["car", "truck", "bus"]),
            "confidence": round(random.uniform(0.8, 0.99), 2),
        }))
        vehicles_in_zone.add(vid)

        time.sleep(delay)

        client.publish("traffic/sensor/midzone", json.dumps({
            "ts": time.time(),
            "vehicles_in_zone": list(vehicles_in_zone),
            "stuck_ids": [],
        }))

        if random.random() < 0.7:
            exit_vid = random.choice(list(vehicles_in_zone)) if vehicles_in_zone else None
            if exit_vid:
                exit_side = "B" if side == "A" else "A"
                client.publish(f"traffic/sensor/{exit_side}/exit", json.dumps({
                    "ts": time.time(),
                    "side": exit_side,
                    "vehicle_id": exit_vid,
                    "vehicle_class": "car",
                    "confidence": 0.95,
                }))
                vehicles_in_zone.discard(exit_vid)

        time.sleep(delay)

        if i % 10 == 0:
            client.publish("traffic/sensor/midzone", json.dumps({
                "ts": time.time(),
                "vehicles_in_zone": list(vehicles_in_zone),
                "stuck_ids": [],
            }))

        if i % 100 == 0:
            print(f"Iteration {i}/{args.iterations}, unsafe switches: {unsafe_switches}, in zone: {len(vehicles_in_zone)}")

    time.sleep(2.0)
    client.loop_stop()
    client.disconnect()

    print(f"\n{'='*50}")
    print(f"RESULT: {args.iterations} iterations completed")
    print(f"Unsafe switches: {unsafe_switches}")
    if unsafe_switches == 0:
        print("PASS: No unsafe phase switches detected")
    else:
        print("FAIL: Unsafe phase switches occurred!")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
