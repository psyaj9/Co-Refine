"""
ICR router: Endpoints for inter-coder reliability analysis and disagreement resolution.

ICR computes statistical agreement metrics (Fleiss' kappa, Krippendorff's alpha,
Gwet's AC1) across all coders in a project. 

Also finds individual disagreements for review and allows team leads to record resolution decisions.

"""
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
    """Raises 403 if the user not a project member.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to check membership for.
        user_id: User making the request.

    Raises:
        HTTPException: 403 if the user not a member.
    """
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


def _get_project_or_404(db: Session, project_id: str):
    """Fetch a project by ID or raise 404.

    Args:
        db: Active SQLAlchemy session.
        project_id: UUID of the project to look up.

    Returns:
        Project ORM object.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
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
    """Return ICR summary.

    Computes agreement metrics across all project members. 
    Returns empty metrics if the project has less than two coders.

    Args:
        project_id: Project to compute ICR for.
        db: DB session.
        current_user: Must be a project member.

    Returns:
        ICROverviewOut with coder list, counts, and all metric scores.
    """
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_icr_overview(db, project_id)


@router.get("/per-code", response_model=list[PerCodeMetricOut])
def get_per_code(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return Krippendorff's alpha per code, sorted best to worst.

    Useful for identifying which specific codes coders disagree on most.
    Empty if fewer than two coders or no codes.

    Args:
        project_id: Project to analyse.
        db: DB session.
        current_user: Must be a project member.

    Returns:
        List of PerCodeMetricOut sorted by alpha score descending.
    """
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.get_per_code_metrics(db, project_id)


@router.get("/agreement-matrix", response_model=AgreementMatrixOut)
def get_agreement_matrix(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the confusion matrix showing which codes coders swap with each other.

    Each cell [i][j] counts how often code i was applied where code j was expected
    (or vice versa). High off-diagonal values flag codes that are easily confused.

    Args:
        project_id: Project to compute the matrix for.
        db: Injected DB session.
        current_user: Must be a project member.

    Returns:
        AgreementMatrixOut with code_labels, code_ids, and dense n×n matrix.
    """
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
    """Return a paginated list of disagreements between coders.

    Filters resolved disagreements from the list by default.
    Supports filtering by document, code, and disagreement type.

    Args:
        project_id: Project to analyse.
        document_id: Optional filter to one document's disagreements.
        code_id: Optional filter to disagreements involving a specific code.
        disagreement_type: e.g. "code_mismatch", "boundary", "coverage_gap".
        offset: Pagination offset.
        limit: Max items per page (default 20).
        db: Injected DB session.
        current_user: Must be a project member.

    Returns:
        DisagreementListOut with paginated items and total count.
    """
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
    """Ask the LLM to explain a disagreement and suggest a resolution strategy.

    This is an on-demand LLM call — not triggered automatically, only when the
    user explicitly requests analysis for a specific disagreement unit.

    Args:
        project_id: Project context.
        body: unit_id and document_id identifying the disagreement.
        db: Injected DB session.
        current_user: Must be a project member.

    Returns:
        Dict with "analysis" text and "unit_id".

    Raises:
        404 if the unit_id doesn't correspond to a known disagreement.
    """
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
    """Record a new resolution decision for a disagreement.

    The resolution starts as "unresolved" and can be updated to "resolved" or
    "deferred" later via the PATCH endpoint.

    Args:
        project_id: Project context.
        body: Resolution details including span coords and optional note.
        db: Injected DB session.
        current_user: Who is recording the resolution.

    Returns:
        ICRResolutionOut with the newly created resolution.
    """
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
    """Update a resolution's status, chosen segment, or note.

    Setting status="resolved" will stamp resolved_at with the current time.

    Args:
        project_id: Project context (for ownership check).
        resolution_id: UUID of the resolution to update.
        body: Fields to update (all optional).
        db: Injected DB session.
        current_user: Must be a project member.

    Returns:
        ICRResolutionOut with the updated resolution.

    Raises:
        404 if the resolution doesn't exist or doesn't belong to this project.
    """
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
    """List all resolutions for a project, optionally filtered by document or status.

    Args:
        project_id: Project to list resolutions for.
        document_id: Optional filter to one document's resolutions.
        status: Optional filter (unresolved/resolved/deferred).
        db: Injected DB session.
        current_user: Must be a project member.

    Returns:
        List of ICRResolutionOut, newest first.
    """
    _get_project_or_404(db, project_id)
    _require_member(db, project_id, current_user.id)
    return service.list_resolutions(db, project_id, document_id=document_id, status=status)
