# Сценарии демонстрации

Эти сценарии используются для демонстрационного сравнения фиксированного и адаптивного режимов управления светофором. Каждый сценарий запускается через MQTT и воспроизводится на реальном или записанном видеопотоке.

## Таблица сценариев

| ID | Описание | Вход CV | Поведение Control | Ключевая метрика |
|---|---|---|---|---|
| `baseline` | Фиксированные фазы 3+3 мин | Любое видео | Без адаптации, чистый таймер | Базовые значения для сравнения |
| `rush_hour` | Асимметричный поток (сторона A доминирует) | Видео с плотным потоком | Адаптив удлиняет GREEN_A, сокращает GREEN_B | avg_delay падает на 30-50% |
| `stuck_truck` | Фура медленно проезжает зону | Видео с медленным ТС | Держит фазу до очистки зоны, событие STUCK_VEHICLE | Ноль unsafe switches |
| `emergency` | Скорая на стороне B | Любое видео + ручной override | FORCE_GREEN_B через override | Время реакции <2с |
| `comm_loss` | Обрыв связи с CV | Прекращение midzone на 5с | Переход на безопасный таймер, событие COMM_LOSS | Graceful degradation |

## Запуск сценария

Для запуска сценария опубликуйте сообщение в топик `traffic/cmd/scenario` с полями `scenario_id` и `mode`.

Пример команды через mosquitto_pub:

```bash
mosquitto_pub -h localhost -p 1883 \
  -t traffic/cmd/scenario \
  -m '{"scenario_id": "rush_hour", "mode": "adaptive"}'
```

Пример payload:

```json
{"scenario_id": "rush_hour", "mode": "adaptive"}
```

Допустимые значения `mode`: `fixed`, `adaptive`.

Допустимые значения `scenario_id`: `baseline`, `rush_hour`, `stuck_truck`, `emergency`, `comm_loss`.

Полная схема сообщения описана в `events.schema.json` под ключом `CmdScenario`.
