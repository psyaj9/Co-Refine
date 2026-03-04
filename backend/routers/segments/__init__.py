"""Segments router package.

Assembles sub-routers for segment CRUD, alerts, analysis, and challenge-reflection
into a single router mounted at /api/segments.
"""

from fastapi import APIRouter

from .crud import router as crud_router
from .alerts import router as alerts_router
from .analysis import router as analysis_router
from .challenge import router as challenge_router

router = APIRouter(prefix="/api/segments", tags=["segments"])

router.include_router(crud_router)
router.include_router(alerts_router)
router.include_router(analysis_router)
router.include_router(challenge_router)
