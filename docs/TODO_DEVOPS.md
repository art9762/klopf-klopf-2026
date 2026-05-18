# Задачи: DevOps / Backend — СРОЧНО

## Критические баги (блокируют демо)

### 1. Кнопки Override не дают видимого эффекта
**Проблема:** Фронт отправляет POST /override и POST /scenario/start — бэк отвечает `{"accepted": true}`, но видимого эффекта на дашборде нет. Фаза не меняется или меняется с большой задержкой.

**Причина:** В `main.py` обработчик `_handle_override` для FORCE_GREEN_A/B сначала переходит в MANUAL, потом через `call_later(5.0)` переходит в GREEN. Но:
- 5 секунд задержки — пользователь думает что ничего не произошло
- Если FSM уже в ALL_RED, переход в MANUAL может не сработать (can_transition проверяет)
- Нет broadcast события "override accepted" в WS

**Что сделать:**
- [ ] Уменьшить задержку MANUAL → GREEN до 1-2 сек
- [ ] Добавить broadcast event_log при получении override: `{"level":"info","code":"OVERRIDE","msg":"FORCE_GREEN_A by demo"}`
- [ ] Проверить что can_transition(MANUAL) работает из ALL_RED_A_to_B/ALL_RED_B_to_A
- [ ] Добавить прямой переход FORCE_GREEN без промежуточного MANUAL для демо

### 2. Scenario Start не генерирует трафик
**Проблема:** POST /scenario/start принимается, но без CV-сервиса нет входящих событий entry/exit. Дашборд показывает 0 машин.

**Что сделать:**
- [ ] Встроить replay.py логику прямо в control service как fallback
- [ ] При получении `traffic/cmd/scenario` если нет CV — запустить внутренний генератор событий
- [ ] Генератор должен эмулировать: entry/exit каждые 2-5 сек, midzone каждую секунду, stuck через 30 сек в stuck_truck сценарии
- [ ] Это позволит демонстрировать систему без CV

### 3. Метрики всегда 0
**Проблема:** throughput_per_hour всегда 0, avg_delay = 0 потому что нет реальных событий.

**Что сделать:**
- [ ] Считать throughput по count_out_a + count_out_b за последние 60 сек × 60
- [ ] Считать avg_delay как среднее wait_A_sec и wait_B_sec
- [ ] Обновлять метрики в _update_metrics() на основе реальных счётчиков

---

## Приоритет 1 (до следующего чекпоинта)

### 4. Docker Compose — единая команда запуска
- [ ] Раскомментировать web сервис (multi-stage: npm build → nginx)
- [ ] Healthcheck для каждого сервиса
- [ ] `docker compose up` поднимает всё

### 5. Makefile
```makefile
demo:     docker compose up -d && open http://localhost:3000
test:     cd services/control && uv run pytest && cd ../../web && npm test
replay:   cd services/control && uv run python scripts/replay.py
logs:     docker compose logs -f control
clean:    docker compose down -v
```

### 6. Встроенный replay в control
- [ ] При старте сценария без CV — автоматически генерировать MQTT-события
- [ ] Поддержать все 5 сценариев с разными паттернами трафика
- [ ] Флаг `DEMO_MODE=true` в env для включения

---

## Приоритет 2

### 7. CI (GitHub Actions)
- [ ] pytest + vitest на каждый push
- [ ] docker compose build

### 8. Логирование
- [ ] Structured JSON logging в control
- [ ] Уровни: INFO для фаз, WARN для comm_loss, ERROR для stuck
