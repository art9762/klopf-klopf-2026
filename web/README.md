# Web Dashboard — Klopf-Klopf

Real-time дашборд для системы адаптивного управления реверсивным коридором.

## Стек

- React 18 + TypeScript
- Vite (dev server + build)
- Tailwind CSS v4 (тёмная тема)
- Recharts (графики)
- Zustand (state management)
- Lucide React (иконки)

## Запуск

```bash
npm install
npm run dev
# http://localhost:5173
```

Требует работающий бэкенд на `localhost:8000` (или `replay.py` для тестирования без CV).

## Структура

```
src/
├── App.tsx                     # Точка входа
├── pages/
│   └── Dashboard.tsx           # Главная страница — собирает все компоненты
├── components/
│   ├── RoadCanvas.tsx          # Canvas: дорога, светофоры, машины, очереди
│   ├── PhaseTimeline.tsx       # Горизонтальная лента фаз (5 мин)
│   ├── QueueGauges.tsx         # Бары очередей A/B
│   ├── MetricsPanel.tsx        # KPI-карточки fixed vs adaptive + bar chart
│   ├── EventLog.tsx            # Последние 50 событий
│   └── ManualOverride.tsx      # Управление: сценарий, режим, override
├── hooks/
│   └── useWebSocket.ts         # WebSocket с авто-реконнектом
├── store/
│   └── trafficStore.ts         # Zustand — глобальный стейт из WS
└── lib/
    └── contracts.ts            # TypeScript-типы по MQTT-контракту
```

## Компоненты

### RoadCanvas
HTML Canvas с визуализацией:
- Двухполосная дорога с ремонтной зоной посередине
- Светофоры на концах (цвет по текущей фазе)
- Очередь машин на въезде (прямоугольники)
- Машины внутри зоны (зелёные), застрявшие (красные)

### PhaseTimeline
Горизонтальная лента за последние 5 минут:
- GREEN_A = зелёный, GREEN_B = синий, ALL_RED = красный, EMERGENCY = жёлтый
- Текущая фаза растягивается до "сейчас"

### MetricsPanel
4 KPI-карточки с дельтой:
- Average Delay (среднее A+B)
- Max Queue (максимум из A/B)
- Throughput (машин/час)
- Unsafe Switches (небезопасные переключения)

Каждая карточка показывает значение adaptive, значение fixed, и процент улучшения.
Под карточками — bar chart (Recharts) для наглядного сравнения.

### QueueGauges
Прогресс-бары для очередей A и B. Показывают количество машин и время ожидания.

### EventLog
Скроллируемый список последних 50 событий. Цвет по уровню: info (синий), warn (жёлтый), error (красный).

### ManualOverride
- Селектор сценария: baseline, rush_hour, stuck_truck, emergency, comm_loss
- Тумблер режима: fixed / adaptive
- Кнопка Start — `POST /scenario/start`
- Кнопки Force Green A, Force Green B, All Red — `POST /override`

## Подключение к бэкенду

В dev-режиме Vite проксирует:
- `/ws` → `ws://localhost:8000/ws` (WebSocket)
- `/scenario/*`, `/override`, `/metrics/*`, `/health` → `http://localhost:8000`

Фронт не знает о порте бэкенда — всё через свой origin.

### Формат WS-сообщений

Бэкенд отправляет:
```json
{"topic": "traffic/state/phase", "data": {"ts": ..., "phase": "GREEN_A", ...}}
```

Фронт нормализует `data` → `payload` в `useWebSocket.ts`.

## Горячие клавиши

| Клавиша | Действие |
|---|---|
| `F` | Презентационный режим (скрыть панель управления) |

## Сборка для production

```bash
npm run build
# Результат в dist/
```

## Тестирование без бэкенда

Запустить `replay.py` из `services/control/scripts/`:
```bash
cd services/control && uv run python scripts/replay.py --speed 10
```

Он генерирует фейковые MQTT-события, контроллер их обрабатывает и бродкастит в WS.
