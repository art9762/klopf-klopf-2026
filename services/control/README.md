# Control Service

Мозг проекта. Получает события от CV, управляет фазами светофора, гарантирует безопасность, отдаёт состояние в Web через WebSocket.

## Quick Start

```bash
# Убедитесь что Mosquitto и InfluxDB запущены (из корня проекта):
docker compose up -d mosquitto influxdb

# Установить зависимости и запустить:
uv sync
uv run uvicorn control.main:app --port 8000
```

## Конфигурация

| Переменная | По умолчанию | Описание |
|---|---|---|
| MQTT_HOST | localhost | Адрес MQTT брокера |
| MQTT_PORT | 1883 | Порт MQTT |
| INFLUX_URL | http://localhost:8086 | URL InfluxDB |
| INFLUX_TOKEN | (пусто) | Токен доступа InfluxDB |
| INFLUX_ORG | klopf | Организация InfluxDB |
| INFLUX_BUCKET | traffic | Бакет InfluxDB |
| DB_PATH | control.db | Путь к SQLite базе |

## API

### REST

| Метод | Путь | Описание |
|---|---|---|
| POST | /scenario/start | Запуск сценария: `{scenario_id, mode}` |
| POST | /override | Ручное управление: `{action, operator}` |
| GET | /metrics/compare?scenario_id=X | Сравнение fixed vs adaptive |
| GET | /health | Проверка здоровья |

### WebSocket

`ws://localhost:8000/ws` — поток событий в формате `{topic, data}`.

Топики: `traffic/state/phase`, `traffic/state/queues`, `traffic/state/metrics`, `traffic/event/log`.

## Тесты

```bash
uv sync --extra dev
uv run pytest tests/ -v
```

64 теста: FSM (22), safety (23), policy (19).

## Replay Script

Генерирует фейковые MQTT-события для тестирования без CV:

```bash
uv run python scripts/replay.py --host localhost --iterations 1000 --scenario rush_hour --speed 10
```

Проверяет что контроллер не делает unsafe-переключений.

## Архитектура

```
main.py          — FastAPI app, control loop, связывает все модули
fsm.py           — Конечный автомат фаз (GREEN_A/B, ALL_RED, EMERGENCY, MANUAL)
safety.py        — Проверка безопасности (count_in == count_out, zone clear)
policy.py        — Адаптивная политика (fixed 3+3 мин / adaptive по приоритету)
mqtt_bridge.py   — MQTT подписка/публикация (paho v2)
ws_gateway.py    — WebSocket мост для браузера
api.py           — REST API
storage.py       — SQLite + InfluxDB
```

## Docker

```bash
# Из корня проекта:
docker compose up --build control
```
