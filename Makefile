.PHONY: demo test replay clean up down logs

demo: up
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Opening dashboard at http://localhost:3000"
	@start http://localhost:3000 2>/dev/null || open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true

up:
	docker compose up -d --build

down:
	docker compose down

test:
	cd services/control && uv run pytest tests/ -v
	cd web && npm run test

replay:
	cd services/control && uv run python scripts/replay.py --host localhost --iterations 500 --speed 10

clean:
	docker compose down -v
	rm -f services/control/control.db

logs:
	docker compose logs -f

health:
	@echo "=== Mosquitto ==="
	@docker compose exec mosquitto mosquitto_pub -t test -m ok && echo "OK" || echo "FAIL"
	@echo "=== InfluxDB ==="
	@curl -sf http://localhost:8086/health | head -1 && echo "" || echo "FAIL"
	@echo "=== Control ==="
	@curl -sf http://localhost:8000/health && echo "" || echo "FAIL"
	@echo "=== Web ==="
	@curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
