from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from control.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthEndpoint:
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestScenarioEndpoint:
    async def test_start_scenario_accepted(self, client: AsyncClient) -> None:
        resp = await client.post("/scenario/start", json={
            "scenario_id": "rush_hour",
            "mode": "adaptive",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["accepted"] is True
        assert data["scenario_id"] == "rush_hour"
        assert data["mode"] == "adaptive"

    async def test_start_scenario_fixed_mode(self, client: AsyncClient) -> None:
        resp = await client.post("/scenario/start", json={
            "scenario_id": "baseline",
            "mode": "fixed",
        })
        assert resp.status_code == 200
        assert resp.json()["mode"] == "fixed"

    async def test_start_scenario_missing_fields(self, client: AsyncClient) -> None:
        resp = await client.post("/scenario/start", json={"scenario_id": "rush_hour"})
        assert resp.status_code == 422


class TestOverrideEndpoint:
    async def test_override_force_green_a(self, client: AsyncClient) -> None:
        resp = await client.post("/override", json={
            "action": "FORCE_GREEN_A",
            "operator": "test_user",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["accepted"] is True
        assert data["action"] == "FORCE_GREEN_A"

    async def test_override_all_red(self, client: AsyncClient) -> None:
        resp = await client.post("/override", json={
            "action": "ALL_RED",
            "operator": "test_user",
        })
        assert resp.status_code == 200
        assert resp.json()["action"] == "ALL_RED"

    async def test_override_missing_fields(self, client: AsyncClient) -> None:
        resp = await client.post("/override", json={"action": "ALL_RED"})
        assert resp.status_code == 422


class TestMetricsEndpoint:
    async def test_compare_metrics_empty(self, client: AsyncClient) -> None:
        resp = await client.get("/metrics/compare")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data or "scenario_id" in data
