from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.models.migrations import init_db
from core.exceptions import NotFoundError, ValidationError, ConflictError, ExternalServiceError
from core.logging import get_logger
from features.auth.router import router as auth_router
from features.projects.router import router as projects_router
from features.documents.router import router as documents_router
from features.codes.router import router as codes_router
from features.segments.router import router as segments_router
from features.audit.router import router as audit_router
from features.chat.router import router as chat_router
from features.edit_history.router import router as edit_history_router
from features.visualisations.router import router as vis_router
from features.auth.router import router as auth_router
from infrastructure.websocket.manager import ws_manager
from infrastructure.auth.jwt import decode_token
from core.config import settings

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": exc.message or "Not found"})


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.message or "Validation error"})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": exc.message or "Conflict"})


@app.exception_handler(ExternalServiceError)
async def external_service_handler(request: Request, exc: ExternalServiceError) -> JSONResponse:
    logger.error("External service error", extra={"message": exc.message})
    return JSONResponse(status_code=502, content={"detail": exc.message or "External service error"})

app.include_router(auth_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(codes_router)
app.include_router(segments_router)
app.include_router(audit_router)
app.include_router(chat_router)
app.include_router(edit_history_router)
app.include_router(vis_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    from jose import JWTError
    from infrastructure.auth.jwt import decode_token
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except (JWTError, KeyError):
        await websocket.accept()
        await websocket.close(code=4001)
        return
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
