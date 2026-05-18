# Дизайн: Web Dashboard «Умный реверсивный коридор»

**Дата:** 2026-05-18
**Ветка:** `web/dashboard`
**Связанный план:** `plan.md` §4 (вайбкодер C — Web)

## Контекст

Web-часть монорепо хакатона ЦЭТ-2026. Один экран, на котором демонстрируется адаптивное управление реверсивным светофором: схема дороги, фазы, очереди, метрики «до/после», журнал событий, ручное управление. Источник данных — WebSocket-мост контроллера на FastAPI, который форвардит MQTT-топики `traffic/state/#` и `traffic/event/#`. Команды отправляются REST-ом (`POST /scenario/start`, `POST /override`).

Контракты payload'ов зафиксированы в `plan.md` §2.

## Принятые решения

| Тема | Решение |
|---|---|
| Источник данных при разработке | Мок-эмулятор внутри `web/` (`VITE_MOCK=1`), боевой режим — WS к Control |
| Объём MVP | Полный по plan.md §4 + вишенки (compare-вид, бипы, питч-слайд) |
| Сравнение fixed/adaptive | Один основной экран + отдельная страница `/compare` (split-view) |
| Эстетика | «Control room»: тёмный фон, янтарные/зелёные/красные акценты |
| Визуализация дороги | 3D low-poly (react-three-fiber) с вращаемой камерой |
| Стейт-менеджмент | zustand + единый Transport-интерфейс (Mock/Ws за одним API) |
| Compare-моделирование в моке | Мок имитирует и fixed, и adaptive параллельно над одним потоком прибытий |

## Архитектура

### Структура каталогов

```
web/
├── src/
│   ├── main.tsx, App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx           # главный экран
│   │   ├── Compare.tsx             # split-view fixed | adaptive
│   │   └── About.tsx               # питч-слайд
│   ├── components/
│   │   ├── road3d/                 # RoadCanvas3D, Car, TrafficLight, Cones
│   │   ├── PhaseTimeline.tsx
│   │   ├── QueueGauges.tsx
│   │   ├── MetricsPanel.tsx        # 4 KPI-карточки + Recharts
│   │   ├── EventLog.tsx
│   │   ├── ManualOverride.tsx
│   │   ├── ScenarioSelector.tsx
│   │   └── ModeToggle.tsx          # fixed/adaptive
│   ├── store/
│   │   ├── trafficStore.ts         # zustand: phase, queues, metrics, cars, events
│   │   └── uiStore.ts              # presentation mode, mute, route helpers
│   ├── transport/
│   │   ├── types.ts                # Transport интерфейс
│   │   ├── wsTransport.ts          # боевой
│   │   ├── mockTransport.ts        # in-browser эмулятор
│   │   └── scenarios/              # rush_hour.ts, stuck_truck.ts, emergency.ts, baseline.ts
│   ├── lib/
│   │   ├── contracts.ts            # типы из plan.md §2
│   │   ├── api.ts                  # POST /override, /scenario/start
│   │   └── audio.ts                # бип на смене фазы
│   └── styles/
│       └── theme.css               # control-room палитра
├── index.html, vite.config.ts
├── tsconfig.json, tailwind.config.ts, postcss.config.js
└── package.json
```

### Поток данных

1. `App` создаёт `Transport` по `import.meta.env.VITE_MOCK` (`MockTransport` либо `WsTransport`).
2. `Transport` эмитит `Envelope`-ы по топикам, `trafficStore.ingest` редьюсит их в нормализованное состояние.
3. Компоненты — чистые подписчики через селекторы zustand (точечные подписки, без перерисовок всего дерева).
4. Команды (override, scenario) идут через `lib/api.ts`: в WS-режиме — `fetch` REST-ом, в моке — `mockTransport.handleCommand`.

## Transport

### Интерфейс

```ts
type Topic = 'phase' | 'queues' | 'metrics' | 'event' | 'midzone' | 'sensor';
type Mode = 'fixed' | 'adaptive';
type Envelope = { topic: Topic; side?: 'A'|'B'; mode: Mode; payload: unknown };

interface Transport {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(handler: (e: Envelope) => void): () => void;
  send(cmd: 'override' | 'scenario', body: unknown): Promise<void>;
  status: 'connecting' | 'open' | 'closed';
  onStatus(cb: (s: Transport['status']) => void): () => void;
}
```

### WsTransport

- `new WebSocket('/ws')` (Vite proxy → `localhost:8000`).
- Ожидаемый формат фрейма: `{topic, side, mode, payload}`. Этот формат не зафиксирован в `plan.md` §2 — фиксируем при первом контакте с Control. Если контроллер шлёт «голый» MQTT-топик без оборачивания — добавим адаптер в одном месте (`wsTransport`), UI не меняется.
- В live-режиме контроллер шлёт только текущий режим. `fixed` slice store наполняется снапшотом из `GET /metrics/compare?scenario=...` при старте сценария.
- Команды: `fetch('POST /scenario/start')`, `fetch('POST /override')`.

### MockTransport

- Все таймеры в одном `setInterval` 100 мс, события батчатся.
- Каждый сценарий — функция `(t: number) => Envelope[]`, генерирующая прибытия машин по контракту `traffic/sensor/{side}/entry`.
- Над одним и тем же потоком прибытий мок параллельно крутит **две независимые симуляции FSM** (`fixed` 3+3 минуты, `adaptive` — упрощённая копия логики из plan.md §4 Control: приоритет = `w1·очередь + w2·время_ожидания`).
- На выходе оба потока эмитят `Envelope` с разным `mode`, что даёт честный compare-вид без бэкенда.
- Сценарии: `baseline`, `rush_hour`, `stuck_truck`, `emergency`, `comm_loss`.
- Команды (`override`, `scenario`) обрабатываются in-place: меняют состояние FSM мока.

## Store

### TrafficStore (zustand)

```ts
interface ModeSlice {
  phase: PhaseEvent | null;
  queues: QueuesEvent | null;
  metrics: MetricsEvent | null;
  cars: Map<string, Car>;        // активные ТС
  events: LogEvent[];            // ring buffer 50
  history: { ts: number; queue_A: number; queue_B: number; throughput: number }[];
  phaseHistory: PhaseEvent[];    // последние 5 минут для timeline
}

interface TrafficStore {
  fixed: ModeSlice;
  adaptive: ModeSlice;
  active: Mode;                   // что показывает главный экран
  scenario: ScenarioId;
  connection: 'connecting' | 'open' | 'closed';
  ingest(env: Envelope): void;
  setActive(m: Mode): void;
  startScenario(id: ScenarioId): void;
  override(action: 'FORCE_GREEN_A' | 'FORCE_GREEN_B' | 'ALL_RED'): void;
}
```

- `cars` — `Map`, чтобы O(1) обновления по `vehicle_id`.
- Селекторы рядом со стором: `selectActiveQueues`, `selectActiveMetrics`, `selectKpiPair` (возвращает `{fixed, adaptive}` для KPI-карточек).
- Ring-buffer-ы фиксированной длины: `events` (50), `phaseHistory` (~50), `history` (5 минут × 2 события/с = 600 точек).

### UiStore

- `presenting: boolean` (F-режим), `muted: boolean` (бипы), `cameraLocked: boolean` (фоллбэк OrbitControls).

## UI-композиция

### Layout (Dashboard)

Сетка 12 колонок, тёмный фон `#0a0e14`, акценты янтарь `#f5b301` / зелёный `#22c55e` / красный `#ef4444`, моноширинные цифры на KPI.

```
┌──────────────────────────────────────────────────────────────┐
│ Header: лого, статус соединения, ScenarioSelector, ModeToggle│
├──────────────────────────────────────┬───────────────────────┤
│        RoadCanvas3D (8 col)          │  KPI 4 шт. (2×2):     │
│        — изометрия, машины,          │  avg_delay,           │
│          светофоры, очереди,         │  max_queue,           │
│          конусы зоны                 │  throughput,          │
│                                      │  unsafe_switches      │
│                                      │  (каждая: now / base) │
├──────────────────────────────────────┤  QueueGauges          │
│ PhaseTimeline (8 col)                │  (бары A/B)           │
├──────────────────────────────────────┼───────────────────────┤
│ Recharts: throughput + queue chart   │  EventLog             │
│   (2 линии: fixed vs adaptive)       │  (последние 50)       │
├──────────────────────────────────────┴───────────────────────┤
│ ManualOverride: Force Green A | Force Green B | ALL_RED | E. │
└──────────────────────────────────────────────────────────────┘
```

### 3D-сцена (react-three-fiber)

- Изометрическая `PerspectiveCamera`, `OrbitControls` с зажатыми пределами (`maxPolarAngle ≈ 60°`, `minDistance/maxDistance`).
- Дорога — длинный `BoxGeometry` с двумя полосами, ремонтная зона размечена оранжевыми `ConeGeometry`.
- Машины — параметризованные low-poly бруски (легковая / грузовик / автобус по `vehicle_class`). Emergency — мигающий красно-синий emissive.
- Светофоры — стойка + три сферы, активная — `emissiveIntensity 1.5`.
- Движение — линейная интерполяция вдоль дорожной кривой по `entry`/`exit` событиям.
- Застрявшие из `stuck_ids` — желтый пульс через `useFrame`.
- Очередь на въезде — стопка машинок длиной = `queue_A/B`.
- `frameloop="demand"`, перерисовка только при изменении стора (через подписку с `invalidate()`).

### Презентационный режим

Клавиша `F` → `requestFullscreen()` + `uiStore.setPresenting(true)`. Скрывается Header (кроме статуса) и ManualOverride, KPI растягиваются.

### Бипы (вишенка)

- WebAudio API, короткий `OscillatorNode` 880 Hz / 120 ms на `phase_started_at` events.
- Тумблер «mute» в Header, по умолчанию выключен (для разработки).

### About-страница

Отдельный route `/about`. Заголовок, ключевая метрика «−30–50% средняя задержка», диаграмма «до/после». Кнопка в Header.

### Compare-страница

`/compare`, две колонки с одинаковыми компонентами Dashboard, привязанные к `fixed` и `adaptive` слайсам через `<ModeProvider mode>`. Кнопка возврата.

## Тестирование

- Vitest + @testing-library/react.
- 3–4 теста на стор-редьюсеры (`ingest` корректно мутирует phase/queues/metrics для нужного слайса, ring buffer обрезается).
- 1 тест на `MockTransport`: сценарий `rush_hour` за 60 виртуальных секунд даёт ожидаемое число `entry`/`exit` событий.
- 3D и сложные компоненты не покрываются юнит-тестами (per plan.md §8).
- Ручная верификация: `npm run dev` с `VITE_MOCK=1`, прокликать все сценарии, проверить бипы, fullscreen, compare, about.

## Верификация перед claim'ом «готово»

- `npm run typecheck` — TS без ошибок.
- `npm run build` — Vite build проходит, бандл < 2 MB gzipped.
- `npm run lint` — eslint чистый.
- `npm run test` — vitest зелёный.
- Dev-сервер запущен, главный экран + compare + about + презентационный режим проверены в браузере.

## Риски и митигации

1. **Three.js на слабой машине** — `frameloop="demand"`, обновление по подписке стора. Фоллбэк: `cameraLocked` через `uiStore` (без OrbitControls).
2. **Десинхронизация мока** — все таймеры в одном тике, `ingest` идемпотентен.
3. **Контракт WS-фрейма не зафиксирован** — адаптер в `wsTransport`, UI-код не меняется при правке.
4. **Бандл three.js** — точечный импорт `@react-three/drei` без `drei/all`. Если всё равно жирно — 2D-fallback за `<Suspense>`.
5. **Утечки памяти** — ring buffer'ы фиксированной длины во всех временных рядах.

## Out of scope

- Аутентификация, mobile-вёрстка (per plan.md §8).
- Тесты на компоненты, кроме smoke (per plan.md §8).
- OCR, multi-camera (вне зоны Web).
- i18n — UI на русском, тексты в коде.
- Реальный CI.

## Стек

`react@18`, `react-dom`, `vite`, `typescript`, `tailwindcss`, `recharts`, `zustand`, `lucide-react`, `three`, `@react-three/fiber`, `@react-three/drei`.

Dev: `vitest`, `@testing-library/react`, `@types/three`, `eslint`, `prettier`.
