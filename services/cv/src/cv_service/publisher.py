"""MQTT publisher for CV events.

Publishes to topics defined in contracts/mqtt_topics.md:
- traffic/sensor/{side}/entry
- traffic/sensor/{side}/exit
- traffic/sensor/midzone
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

import paho.mqtt.client as mqtt
from pydantic import BaseModel


class SensorEntry(BaseModel):
    ts: float
    side: str
    vehicle_id: str
    vehicle_class: str
    confidence: float


class SensorExit(BaseModel):
    ts: float
    side: str
    vehicle_id: str
    vehicle_class: str
    confidence: float


class SensorMidzone(BaseModel):
    ts: float
    vehicles_in_zone: list[str]
    stuck_ids: list[str]


COCO_TO_CONTRACT = {
    "car": "car",
    "truck": "truck",
    "bus": "bus",
    "motorcycle": "car",
}


def map_vehicle_class(coco_class: str) -> str:
    return COCO_TO_CONTRACT.get(coco_class, "car")


@dataclass
class MQTTPublisher:
    host: str = "localhost"
    port: int = 1883
    client_id: str = "cv_service"
    _client: mqtt.Client = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._client = mqtt.Client(
            client_id=self.client_id,
            protocol=mqtt.MQTTv5,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )

    def connect(self) -> None:
        self._client.connect(self.host, self.port)
        self._client.loop_start()

    def disconnect(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def _publish(self, topic: str, payload: BaseModel) -> None:
        self._client.publish(topic, payload.model_dump_json(), qos=0)

    def publish_entry(self, side: str, vehicle_id: str, vehicle_class: str, confidence: float) -> None:
        msg = SensorEntry(
            ts=time.time(),
            side=side,
            vehicle_id=vehicle_id,
            vehicle_class=map_vehicle_class(vehicle_class),
            confidence=round(confidence, 3),
        )
        self._publish(f"traffic/sensor/{side}/entry", msg)

    def publish_exit(self, side: str, vehicle_id: str, vehicle_class: str, confidence: float) -> None:
        msg = SensorExit(
            ts=time.time(),
            side=side,
            vehicle_id=vehicle_id,
            vehicle_class=map_vehicle_class(vehicle_class),
            confidence=round(confidence, 3),
        )
        self._publish(f"traffic/sensor/{side}/exit", msg)

    def publish_midzone(self, vehicles_in_zone: list[str], stuck_ids: list[str]) -> None:
        msg = SensorMidzone(
            ts=time.time(),
            vehicles_in_zone=vehicles_in_zone,
            stuck_ids=stuck_ids,
        )
        self._publish("traffic/sensor/midzone", msg)
