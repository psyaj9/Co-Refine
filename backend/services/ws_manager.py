from fastapi import WebSocket
from typing import Any
import json
import asyncio


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self._connections[user_id]

    async def send_alert(self, user_id: str, alert: dict[str, Any]) -> None:
        conns = self._connections.get(user_id, set())
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(alert)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)

    async def send_stream_token(self, user_id: str, token: str, stream_id: str) -> None:
        await self.send_alert(user_id, {
            "type": "ghost_thinking",
            "stream_id": stream_id,
            "token": token,
        })

    async def send_stream_end(self, user_id: str, stream_id: str) -> None:
        await self.send_alert(user_id, {
            "type": "ghost_thinking_done",
            "stream_id": stream_id,
        })

    async def broadcast(self, alert: dict[str, Any]) -> None:
        for user_id in list(self._connections.keys()):
            await self.send_alert(user_id, alert)


ws_manager = ConnectionManager()
