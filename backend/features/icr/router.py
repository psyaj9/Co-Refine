from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.logging import get_logger
from core.models import User
from features.icr.schemas import (
    ICROverviewOut,
    AgreementMatrixOut,
    DisagreementListOut,
    PerCodeMetricOut,
    ICRResolutionCreate,
    ICRResolutionUpdate,
    ICRResolutionOut,
    AnalyzeDisagreementRequest,
)
from features.icr import service
from features.projects.repository import get_project_by_id, get_membership
from infrastructure.auth.dependencies import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/icr", tags=["icr"])


def _require_member(db: Session, project_id: str, user_id: str) -> None:
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


def _get_project_or_404(db: Session, project_id: str):
    p = get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.get("/overview", response_model=ICROverviewOut)
def get_overview(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_icr_overview(db, project_id)


@router.get("/per-code", response_model=list[PerCodeMetricOut])
def get_per_code(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_per_code_metrics(db, project_id)


@router.get("/agreement-matrix", response_model=AgreementMatrixOut)
def get_agreement_matrix(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_agreement_matrix(db, project_id)


@router.get("/disagreements", response_model=DisagreementListOut)
def get_disagreements(
    project_id: str,
    document_id: Optional[str] = None,
    code_id: Optional[str] = None,
    disagreement_type: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_disagreements(
        db, project_id,
        document_id=document_id,
        code_id=code_id,
        disagreement_type=disagreement_type,
        offset=offset,
        limit=limit,
    )


@router.post("/analyze-disagreement")
def analyze_disagreement(
    project_id: str,
    body: AnalyzeDisagreementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)

    result = service.analyze_disagreement_llm(
        db, project_id, body.unit_id, body.document_id
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/resolutions", response_model=ICRResolutionOut, status_code=201)
def create_resolution(
    project_id: str,
    body: ICRResolutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.create_resolution(db, project_id, body, current_user.id)


@router.patch("/resolutions/{resolution_id}", response_model=ICRResolutionOut)
def update_resolution(
    project_id: str,
    resolution_id: str,
    body: ICRResolutionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.update_resolution(db, project_id, resolution_id, body, current_user.id)


@router.get("/resolutions", response_model=list[ICRResolutionOut])
def list_resolutions(
    project_id: str,
    document_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.list_resolutions(db, project_id, document_id=document_id, status=status)
