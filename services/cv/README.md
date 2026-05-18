# services/cv — Computer Vision service

Превращает входное видео в поток MQTT-событий: пересечения линий въезда/выезда (`entry`/`exit`) и состав зоны (`midzone`). Зона ответственности — вайбкодер A. Подробное ТЗ и DoD: см. `plan.md` §4.A.

## Стек

`ultralytics` (YOLOv8n) + `supervision` (ByteTrack, аннотации) + `opencv-python` + `paho-mqtt` + `pydantic`. Python 3.11.

## Установка

Требуется [`uv`](https://docs.astral.sh/uv/getting-started/installation/).

```bash
cd services/cv
uv sync
```

`uv` сам подтянет Python 3.11 и поставит зависимости в `.venv/`.

## Запуск

Сейчас здесь только CLI-скелет — реальная логика добавляется по ходу хакатона.

```bash
uv run python -m cv_service --help
```

### Smoke-тест YOLO

Быстрая проверка что модель и окружение собраны (детектор видит машины):

```bash
# на картинках из VisDrone (или любой папки с jpg)
uv run python scripts/smoke_yolo.py --source datasets/VisDrone/VisDrone_Dataset/VisDrone2019-DET-val/images --limit 6

# на одном видео
uv run python scripts/smoke_yolo.py --source videos/your_clip.mp4 --limit 120

# с веб-камеры
uv run python scripts/smoke_yolo.py --source 0
```

Размеченные кадры пишутся в `outputs/smoke/` (в gitignore). При первом запуске
ultralytics сам скачает `yolov8n.pt` в кэш.

Будущий целевой запуск (по плану):

```bash
uv run python -m cv_service --video videos/rush.mp4 --config configs/rush.json --speed 4x
```

## Источники данных

Видео и датасеты в репо НЕ коммитятся (см. корневой `.gitignore`). Складываем локально:

- `services/cv/videos/` — `.mp4` под сценарии `baseline`, `rush_hour`, `stuck_truck`.
- `services/cv/datasets/` — картинки + YOLO-разметка (если делаем дообучение).
- `services/cv/models/` — скачанные веса (`yolov8n.pt` и т.п.).

Ссылки (заполняем по мере скачивания):

- baseline: <TODO>
- rush_hour: <TODO>
- stuck_truck: <TODO>
- (опционально) датасет с разметкой: <TODO>

## Структура

```
src/cv_service/
├── main.py             # CLI entrypoint
├── tracker.py          # YOLO + ByteTrack
├── zones.py            # геометрия линий въезда/выезда
├── publisher.py        # paho-mqtt publish
└── stuck_detector.py   # stuck >30s по средней точке
configs/
└── zone_picker.py      # утилита разметки зон по кадру
```

## DoD (из plan.md §4.A)

- На каждом из 3 видео отображается окно с bbox + линиями + счётчиками (для отладки).
- В `mosquitto_sub -t 'traffic/sensor/#' -v` видны корректные события.
- За 60 секунд `rush_hour` события `entry_A` и `exit_A` совпадают по числу с реальностью ±2 машины.
