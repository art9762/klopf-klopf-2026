from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_mqtt_bridge: Any = None
_storage: Any = None


def set_dependencies(mqtt_bridge: Any, storage: Any) -> None:
    global _mqtt_bridge, _storage
    _mqtt_bridge = mqtt_bridge
    _storage = storage


class ScenarioStartRequest(BaseModel):
    scenario_id: str
    mode: str


class OverrideRequest(BaseModel):
    action: str
    operator: str


class HealthResponse(BaseModel):
    status: str


@router.post("/scenario/start")
async def start_scenario(body: ScenarioStartRequest) -> dict[str, Any]:
    if _mqtt_bridge is not None:
        await _mqtt_bridge.publish(
            "traffic/cmd/scenario",
            {"scenario_id": body.scenario_id, "mode": body.mode},
        )
    return {"scenario_id": body.scenario_id, "mode": body.mode, "accepted": True}


@router.post("/override")
async def override(body: OverrideRequest) -> dict[str, Any]:
    if _mqtt_bridge is not None:
        await _mqtt_bridge.publish(
            "traffic/cmd/override",
            {"action": body.action, "operator": body.operator},
        )
    return {"action": body.action, "operator": body.operator, "accepted": True}


@router.get("/metrics/compare")
async def compare_metrics(scenario_id: Optional[str] = None) -> dict[str, Any]:
    if _storage is None:
        return {"data": [], "scenario_id": scenario_id}
    data = await _storage.get_comparison(scenario_id)
    return {"data": data, "scenario_id": scenario_id}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")
