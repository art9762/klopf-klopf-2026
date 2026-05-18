# Задачи: DevOps

## Приоритет 1 (до следующего чекпоинта)

### 1. Собрать единый docker-compose для всех сервисов
- Раскомментировать и настроить `web` сервис в docker-compose.yml
- Добавить multi-stage build для web (npm build → nginx)
- Проверить что `docker compose up` поднимает всё одной командой

### 2. Добавить CV-сервис в docker-compose
- Создать Dockerfile для services/cv/ (Python + ultralytics + opencv)
- Прокинуть volume для видеофайлов
- Настроить depends_on: mosquitto

### 3. Health checks
- Добавить healthcheck в docker-compose для каждого сервиса:
  - mosquitto: `mosquitto_pub -t test -m ok`
  - influxdb: `curl -f http://localhost:8086/health`
  - control: `curl -f http://localhost:8000/health`
  - web: `curl -f http://localhost:3000/`
- Настроить depends_on с condition: service_healthy

### 4. Makefile / скрипты для демо
- `make demo` — поднять всё + открыть браузер
- `make test` — запустить тесты бэка и фронта
- `make replay` — запустить replay.py для генерации трафика без CV
- `make clean` — остановить и удалить volumes

## Приоритет 2 (если останется время)

### 5. CI (GitHub Actions)
- Lint + type-check фронта
- pytest бэка
- docker compose build (проверка что образы собираются)

### 6. Мониторинг
- Добавить Prometheus endpoint в control (/metrics в формате prometheus)
- Опционально: простой Grafana dashboard для отладки (не для демо)

### 7. Логирование
- Настроить structured logging (JSON) в control service
- docker compose logs --follow с фильтрацией по сервису

---

## Заметки
- Видеофайлы НЕ коммитить — добавить в .gitignore, хранить локально или на shared drive
- .env файл с секретами НЕ коммитить — только .env.example
- Для демо на чужой машине: подготовить `docker compose pull` с pre-built images или docker save/load
