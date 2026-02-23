from fastapi import WebSocket
from typing import Any
import asyncio


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Register the main event loop so background threads can send safely."""
        self._loop = loop

    def send_alert_threadsafe(self, user_id: str, payload: dict[str, Any]) -> None:
        """Send from a background thread without asyncio.run() conflicts."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.send_alert(user_id, payload), self._loop
            )

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

    async def broadcast(self, alert: dict[str, Any]) -> None:
        for user_id in list(self._connections.keys()):
            await self.send_alert(user_id, alert)


ws_manager = ConnectionManager()
