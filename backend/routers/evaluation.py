"""Evaluation endpoints — will host Consistency Dashboard data in future."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

# All legacy visualisation endpoints removed.
# Future consistency dashboard endpoints (facet drift, forecaster, etc.) will live here.
