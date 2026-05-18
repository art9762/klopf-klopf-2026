# Klopf-Klopf: Адаптивный реверсивный коридор

Система адаптивного управления реверсивным светофором на ремонтном участке дороги. Заменяет фиксированный таймер (3+3 мин) на интеллектуальную систему, которая видит каждую машину камерой, гарантирует пустую зону перед сменой фазы и распределяет зелёное по реальному спросу.

## Архитектура

```
[Камера] → [CV Service] ──MQTT──→ [Control Service] ──WS──→ [Web Dashboard]
                                         │
                                   [InfluxDB + SQLite]
```

Три микросервиса общаются через MQTT (Mosquitto). Контракты зафиксированы в `contracts/`.

## Quick Start

```bash
# 1. Поднять инфраструктуру
cp .env.example .env
docker compose up -d mosquitto influxdb

# 2. Поднять контроллер
cd services/control && uv sync && uv run uvicorn control.main:app --port 8000

# 3. Тест без CV (фейковые события)
cd services/control && uv run python scripts/replay.py --speed 10

# 4. Поднять CV (отдельный терминал)
cd services/cv && uv sync && uv run python -m cv_service --scenario rush_hour

# 5. Поднять фронт (отдельный терминал)
cd web && npm i && npm run dev
```

## Сервисы

| Сервис | Порт | Стек | Статус |
|---|---|---|---|
| Control | 8000 | Python, FastAPI, paho-mqtt | Готов |
| CV | — | Python, YOLOv8n, ByteTrack | В разработке |
| Web | 3000 | React, Vite, TypeScript, Tailwind | В разработке |

## Контракты

Все контракты в `contracts/`:
- `mqtt_topics.md` — топики MQTT, форматы, частоты
- `events.schema.json` — JSON Schema всех сообщений
- `scenarios.md` — 5 демо-сценариев

Изменение контрактов — только через PR с апрувом всех трёх разработчиков.

## Разработка

### Ветки
- `control/*` — бэкенд (Вайбкодер B)
- `cv/*` — компьютерное зрение (Вайбкодер A)
- `web/*` — дашборд (Вайбкодер C)

### Правила
- Каждый работает в своей папке
- `contracts/` меняется только через PR
- `docker-compose.yml` — добавлять свой сервис, не трогать чужие секции
- Перед merge в main — убедиться что свой сервис стартует с `docker compose up`

## Демо-сценарии

| ID | Что демонстрирует |
|---|---|
| baseline | Фиксированные фазы 3+3 мин (для сравнения) |
| rush_hour | Адаптив сокращает зелёное на пустой стороне |
| stuck_truck | Контроллер ждёт очистки зоны |
| emergency | Ручной override для скорой |
| comm_loss | Резервный таймер при потере связи |

## Полный запуск через Docker

```bash
docker compose up --build
```
