# MQTT Contract

## Broker

- Address: `mosquitto:1883` (inside docker-compose network)
- Authentication: none
- Transport: TCP

## Conventions

- All payloads are UTF-8 encoded JSON objects
- Timestamps are Unix seconds as float (e.g. `1716000000.123`)
- `{side}` is either `"A"` or `"B"`

## Topic Table

| Topic | Publisher | Subscriber | Frequency | QoS | Retain |
|---|---|---|---|---|---|
| `traffic/sensor/{side}/entry` | CV | Control | per event | 0 | no |
| `traffic/sensor/{side}/exit` | CV | Control | per event | 0 | no |
| `traffic/sensor/midzone` | CV | Control | every 1s | 0 | no |
| `traffic/state/phase` | Control | Web, CV | on change + 1s | 0 | yes |
| `traffic/state/queues` | Control | Web | every 500ms | 0 | no |
| `traffic/state/metrics` | Control | Web | every 1s | 0 | no |
| `traffic/event/log` | Control | Web | per event | 0 | no |
| `traffic/cmd/override` | Web | Control | on button press | 0 | no |
| `traffic/cmd/scenario` | Web | Control, CV | on scenario start | 0 | no |

## Payload Schemas

All message schemas are defined in `events.schema.json` using JSON Schema draft-07.

## Change Policy

Any change to this contract requires:

1. A pull request targeting the `contracts/` directory
2. Explicit approval from all 3 developers on the team
3. A 5-minute synchronous chat sync before merging

No topic name, payload field, or QoS value may be changed unilaterally. Breaking changes must be versioned.
