from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class WebSocketGateway:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def broadcast(self, topic: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"topic": topic, "data": payload})
        dead: set[WebSocket] = set()
        for client in self._clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.add(client)
        self._clients -= dead

    async def handle_client(self, websocket: WebSocket) -> None:
        await self.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            await self.disconnect(websocket)


gateway = WebSocketGateway()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await gateway.handle_client(websocket)
