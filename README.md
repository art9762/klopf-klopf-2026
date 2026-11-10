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

# 4. Поднять фронт (отдельный терминал)
cd web && npm i && npm run dev
# Открыть http://localhost:5173

# 5. Поднять CV (отдельный терминал, опционально)
cd services/cv && uv sync && uv run python -m cv_service --scenario rush_hour
```

## Сервисы

| Сервис | Порт | Стек | Статус |
|---|---|---|---|
| Control | 8000 | Python 3.11, FastAPI, paho-mqtt, aiosqlite | Готов |
| Web | 5173 (dev) | React 18, Vite, TypeScript, Tailwind v4, Recharts, Zustand | Готов |
| CV | — | Python, YOLOv8n, ByteTrack, supervision | В разработке |

## Web Dashboard

Один экран с real-time визуализацией:

- **RoadCanvas** — схема дороги с машинами, светофорами, очередями (HTML Canvas)
- **PhaseTimeline** — горизонтальная лента фаз за последние 5 минут
- **QueueGauges** — бары очередей сторон A и B с временем ожидания
- **MetricsPanel** — 4 KPI-карточки (avg delay, max queue, throughput, unsafe switches) с дельтой fixed vs adaptive + bar chart
- **EventLog** — последние 50 событий с цветовой кодировкой по уровню
- **ManualOverride** — селектор сценария, тумблер fixed/adaptive, кнопки Force Green A/B, All Red

Горячие клавиши:
- `F` — презентационный режим (скрывает панель управления)

Подробнее: [web/README.md](web/README.md)

## Ручное управление и подтверждение очистки

Команды `Force A` / `Force B` выбирают соответствующую фазу через полный
пятисекундный интервал красного. Следующая Force-команда заменяет направление
и начинает интервал заново. `All Red` удерживает состояние `EMERGENCY` до новой
Force-команды; старые отложенные переключения больше не снимают этот режим.

Окончание таймера само по себе не открывает зелёный. Контроллер ожидает свежее
сообщение midzone (не старше 5 секунд), пустой список машин и застрявших ТС,
а также совпадение счётчиков въезда/выезда обоих направлений. Это относится
и к начальному запуску: без входных событий фаза остаётся красной.
MQTT-события передаются из фонового потока paho в основной asyncio-цикл,
чтобы команды, WebSocket-уведомления и запись событий выполнялись в нём.

Проверка без брокера, базы данных и оборудования:

```bash
cd services/control
uv sync --frozen --extra dev
uv run --frozen pytest -q
```

Регрессии используют искусственные события и часы, включая последовательности
Force → All Red, повторный Force, потерю данных и занятый коридор.
Работа с реальными камерами и светофорами в этих тестах не проверяется.

## Контракты

Все контракты в `contracts/`:
- `mqtt_topics.md` — топики MQTT, форматы, частоты
- `events.schema.json` — JSON Schema всех сообщений
- `scenarios.md` — 5 демо-сценариев

Изменение контрактов — только через PR с апрувом всех трёх разработчиков.

## Интеграция фронт ↔ бэкенд

| Канал | Описание |
|---|---|
| WebSocket `/ws` | Бэкенд бродкастит `{topic, data}` — фронт нормализует в `{topic, payload}` |
| `POST /scenario/start` | Запуск сценария `{scenario_id, mode}` |
| `POST /override` | Ручное управление `{action, operator}` |
| `GET /metrics/compare` | Сравнение метрик fixed vs adaptive |
| `GET /health` | Healthcheck |

В dev-режиме Vite проксирует все API-запросы на `localhost:8000`. В production — CORS middleware на FastAPI.

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
