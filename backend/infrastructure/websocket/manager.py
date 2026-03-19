"""WebSocket connection manager.

Maintains a registry of active connections keyed by user_id, and provides
both async and thread-safe sending paths.

Background audit threads run outside the asyncio event loop, so they can't
``await`` directly. ``send_alert_threadsafe`` bridges the gap by scheduling
the coroutine onto the main event loop from a worker thread.

The loop reference is set once at startup (see ``main.py`` lifespan) so the
manager knows which loop to submit work to.
"""

import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Registry of active WebSocket connections, keyed by user_id.

    Supports multiple simultaneous connections per user (e.g. two browser tabs)
    by storing a set of WebSocket objects per user_id.

    Attributes:
        _connections: Maps user_id to the set of currently open WebSocket connections.
        _loop:        The running asyncio event loop. Set via ``set_loop`` at startup.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        # Populated in main.py lifespan so background threads can schedule
        # coroutines onto it.
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Store a reference to the running event loop.

        Called once during app startup so that ``send_alert_threadsafe`` has
        a loop to submit coroutines to.

        Args:
            loop: The asyncio event loop running in the main thread.
        """
        self._loop = loop

    def send_alert_threadsafe(self, user_id: str, payload: dict[str, Any]) -> None:
        """Schedule a JSON send from a background (non-async) thread.

        Background audit workers run in ThreadPoolExecutor threads, which have
        no event loop. This method submits the send coroutine to the main loop
        so it runs on the right thread.

        Args:
            user_id: Recipient user's connection set.
            payload: JSON-serialisable dict to send.
        """
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.send_alert(user_id, payload), self._loop
            )
        # If the loop isn't running (e.g. during tests or shutdown) we silently
        # drop the message — the audit result will still be persisted to the DB.

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        """Accept a new WebSocket connection and register it.

        Args:
            websocket: The incoming WebSocket connection.
            user_id:   The user this connection belongs to.
        """
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        """Remove a closed connection from the registry.

        Cleans up the user's entry entirely if they have no remaining
        connections (avoids accumulating empty sets).

        Args:
            websocket: The connection that closed.
            user_id:   Owner of the connection.
        """
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(websocket)
            # Remove the empty set so we don't iterate over ghost entries
            # in broadcast().
            if not conns:
                del self._connections[user_id]

    async def send_alert(self, user_id: str, alert: dict[str, Any]) -> None:
        """Send a JSON payload to all active connections for a user.

        Silently drops dead connections (browser closed mid-audit) rather
        than letting a single broken socket crash the whole send.

        Args:
            user_id: Target user.
            alert:   JSON-serialisable payload to send.
        """
        conns = self._connections.get(user_id, set())
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(alert)
            except Exception:
                # Mark as dead — can't remove from a set we're iterating over.
                dead.append(ws)
        # Clean up stale connections after the loop.
        for ws in dead:
            conns.discard(ws)

    async def broadcast(self, alert: dict[str, Any]) -> None:
        """Send a JSON payload to all connected users.

        Mostly used in development/debugging — production code should target
        specific users via ``send_alert``.

        Args:
            alert: JSON-serialisable payload to send to everyone.
        """
        # Snapshot the keys so we don't iterate over a dict that could be
        # modified by disconnect() during the loop.
        for user_id in list(self._connections.keys()):
            await self.send_alert(user_id, alert)


# Single global instance — imported and used directly by routers and
# background tasks throughout the app.
ws_manager = ConnectionManager()
