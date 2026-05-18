from __future__ import annotations

import json
import os
from typing import Any, Callable, Optional

import paho.mqtt.client as mqtt

MQTT_HOST: str = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT: int = int(os.environ.get("MQTT_PORT", "1883"))

OnEntry = Callable[[str, str, str, float, float], None]
OnExit = Callable[[str, str, str, float, float], None]
OnMidzone = Callable[[list[str], list[str], float], None]
OnOverride = Callable[[str, str], None]
OnScenario = Callable[[str, str], None]


class MqttBridge:
    def __init__(
        self,
        host: str = MQTT_HOST,
        port: int = MQTT_PORT,
        on_entry: Optional[OnEntry] = None,
        on_exit: Optional[OnExit] = None,
        on_midzone: Optional[OnMidzone] = None,
        on_override: Optional[OnOverride] = None,
        on_scenario: Optional[OnScenario] = None,
    ) -> None:
        self._host = host
        self._port = port
        self._on_entry = on_entry
        self._on_exit = on_exit
        self._on_midzone = on_midzone
        self._on_override = on_override
        self._on_scenario = on_scenario

        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.on_connect = self._handle_connect
        self._client.on_disconnect = self._handle_disconnect
        self._client.on_message = self._handle_message

    def start(self) -> None:
        self._client.connect(self._host, self._port, keepalive=60)
        self._client.loop_start()

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def publish_phase(self, phase_state: dict[str, Any]) -> None:
        self._publish("traffic/state/phase", phase_state)

    def publish_queues(self, queues: dict[str, Any]) -> None:
        self._publish("traffic/state/queues", queues)

    def publish_metrics(self, metrics: dict[str, Any]) -> None:
        self._publish("traffic/state/metrics", metrics)

    def publish_event(self, event: dict[str, Any]) -> None:
        self._publish("traffic/event/log", event)

    def _publish(self, topic: str, payload: dict[str, Any]) -> None:
        self._client.publish(topic, json.dumps(payload))

    def _handle_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        connect_flags: mqtt.ConnectFlags,
        reason_code: mqtt.ReasonCode,
        properties: Any,
    ) -> None:
        if reason_code.is_failure:
            return
        client.subscribe("traffic/sensor/+/entry")
        client.subscribe("traffic/sensor/+/exit")
        client.subscribe("traffic/sensor/midzone")
        client.subscribe("traffic/cmd/override")
        client.subscribe("traffic/cmd/scenario")

    def _handle_disconnect(
        self,
        client: mqtt.Client,
        userdata: Any,
        disconnect_flags: mqtt.DisconnectFlags,
        reason_code: mqtt.ReasonCode,
        properties: Any,
    ) -> None:
        if reason_code.is_failure:
            client.reconnect()

    def _handle_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        message: mqtt.MQTTMessage,
    ) -> None:
        topic: str = message.topic
        try:
            payload: dict[str, Any] = json.loads(message.payload)
        except (json.JSONDecodeError, ValueError):
            return

        parts = topic.split("/")

        if len(parts) == 4 and parts[0] == "traffic" and parts[1] == "sensor" and parts[3] == "entry":
            self._dispatch_entry(parts[2], payload)
        elif len(parts) == 4 and parts[0] == "traffic" and parts[1] == "sensor" and parts[3] == "exit":
            self._dispatch_exit(parts[2], payload)
        elif topic == "traffic/sensor/midzone":
            self._dispatch_midzone(payload)
        elif topic == "traffic/cmd/override":
            self._dispatch_override(payload)
        elif topic == "traffic/cmd/scenario":
            self._dispatch_scenario(payload)

    def _dispatch_entry(self, side: str, payload: dict[str, Any]) -> None:
        if self._on_entry is None:
            return
        self._on_entry(
            side,
            payload.get("vehicle_id", ""),
            payload.get("vehicle_class", ""),
            float(payload.get("confidence", 0.0)),
            float(payload.get("ts", 0.0)),
        )

    def _dispatch_exit(self, side: str, payload: dict[str, Any]) -> None:
        if self._on_exit is None:
            return
        self._on_exit(
            side,
            payload.get("vehicle_id", ""),
            payload.get("vehicle_class", ""),
            float(payload.get("confidence", 0.0)),
            float(payload.get("ts", 0.0)),
        )

    def _dispatch_midzone(self, payload: dict[str, Any]) -> None:
        if self._on_midzone is None:
            return
        self._on_midzone(
            list(payload.get("vehicles_in_zone", [])),
            list(payload.get("stuck_ids", [])),
            float(payload.get("ts", 0.0)),
        )

    def _dispatch_override(self, payload: dict[str, Any]) -> None:
        if self._on_override is None:
            return
        self._on_override(
            payload.get("action", ""),
            payload.get("operator", ""),
        )

    def _dispatch_scenario(self, payload: dict[str, Any]) -> None:
        if self._on_scenario is None:
            return
        self._on_scenario(
            payload.get("scenario_id", ""),
            payload.get("mode", ""),
        )
