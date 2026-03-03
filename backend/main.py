from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import documents, codes, segments, projects, chat, edit_history, evaluation, vis
from services.ws_manager import ws_manager
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Store the running event loop so background threads can send WebSocket
    # messages safely via run_coroutine_threadsafe (avoids RuntimeError).
    ws_manager.set_loop(asyncio.get_event_loop())
    yield


app = FastAPI(title=settings.app_title, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(codes.router)
app.include_router(segments.router)
app.include_router(chat.router)
app.include_router(edit_history.router)
app.include_router(evaluation.router)
app.include_router(vis.router)


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "title": settings.app_title}


@app.get("/api/settings")
def get_settings():
    return {
        "has_api_key": bool(settings.azure_api_key),
        "fast_model": settings.fast_model,
        "reasoning_model": settings.reasoning_model,
        "embedding_model": settings.embedding_model,
    }
