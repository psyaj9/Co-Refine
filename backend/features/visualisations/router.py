"""
Visualisations router — data endpoints for the three-tab Visualisations panel.

Each endpoint corresponds to one tab in the UI:
  - /overview    → summary stats + multi-metric time-series
  - /facets      → scatter plot data per discovered sub-theme
  - /consistency → box plots + timeline by code
  - /overlap     → pairwise cosine similarity matrix between code centroids
  - /code-cooccurrence → which codes are applied to the same spans

Facet management endpoints (relabel, suggest-labels, explain) are also here
because they're tightly coupled to the visualisation layer, even though the
underlying logic lives in features/facets/service.py.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Project, Facet, Code, User
from features.visualisations.schemas import RelabelFacetBody, CodeCooccurrenceOut
from features.visualisations.service import get_overview, get_facets, get_consistency, get_code_overlap, explain_facet, compute_cooccurrence
from features.facets.service import suggest_facet_labels
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


@router.get("/overview")
def get_vis_overview(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return summary stats and multi-metric time-series for the Overview tab.

    Args:
        project_id: Project to summarise.
        db: Injected DB session.
        current_user: Authenticated user — results are scoped to their coding.

    Returns:
        Dict with total counts, avg scores, and time-series arrays.

    Raises:
        404 if the project doesn't exist.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_overview(db, project_id, user_id=current_user.id)


@router.get("/facets")
def get_vis_facets(
    project_id: str,
    code_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return facet scatter plot data for the Facet Explorer tab.

    Optionally filter to a single code via ?code_id=... — useful when the
    user selects a code in the codebook to inspect its sub-themes.

    Args:
        project_id: Project to query.
        code_id: Optional filter — if provided, only return facets for this code.
        db: Injected DB session.
        current_user: Results are scoped to this user's segments.

    Returns:
        Dict with list of facets, each containing segments array with tsne_x/y coords.
    """
    return get_facets(db, project_id, user_id=current_user.id, code_id=code_id)


@router.get("/consistency")
def get_vis_consistency(
    project_id: str,
    code_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return consistency scores for the Consistency tab box plots.

    Args:
        project_id: Project to query.
        code_id: Optional filter to a single code's timeline.
        db: Injected DB session.
        current_user: Results are scoped to this user's scoring history.

    Returns:
        Dict with scores_by_code (for box plots) and timeline (for scatter).
    """
    return get_consistency(db, project_id, user_id=current_user.id, code_id=code_id)


@router.get("/overlap")
def get_vis_overlap(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return pairwise cosine similarity between code embedding centroids.

    High similarity between two codes (> 0.85) is a signal that they may be
    redundant or insufficiently differentiated in the codebook.

    Args:
        project_id: Project to compute overlap for.
        db: Injected DB session.
        current_user: Authenticated user.

    Returns:
        Dict with matrix, code_labels, and a threshold value.

    Raises:
        404 if the project doesn't exist.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_code_overlap(db, project_id, user_id=current_user.id)


@router.get("/code-cooccurrence", response_model=CodeCooccurrenceOut)
def get_vis_code_cooccurrence(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return a symmetric co-occurrence matrix counting how often each pair of codes
    has been applied to the exact same text span within the project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return compute_cooccurrence(db, project_id, user_id=current_user.id)


@router.patch("/facets/{facet_id}/label")
def relabel_facet(
    project_id: str,
    facet_id: str,
    body: RelabelFacetBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually override a facet's label (user-provided label beats AI suggestion).

    Sets label_source="user" so the UI can show an icon indicating the label
    was manually set rather than AI-generated.

    Args:
        project_id: Project owning the facet (for ownership check).
        facet_id: UUID of the facet to relabel.
        body: New label text.
        db: Injected DB session.
        current_user: Only the facet's owner can relabel it.

    Returns:
        Dict with updated id, label, and label_source.

    Raises:
        404 if the facet doesn't exist or doesn't belong to this user + project.
    """
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id, Facet.user_id == current_user.id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")
    facet.label = body.label
    facet.label_source = "user"
    db.commit()
    return {"id": facet.id, "label": facet.label, "label_source": facet.label_source}


@router.post("/facets/suggest-labels")
def suggest_labels(
    project_id: str,
    code_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run AI label suggestion for all active facets of a code.

    Useful after the user has added more segments — the AI may produce better
    labels with more context. Also available as a manual override if the
    automatic labels weren't triggered correctly.

    Args:
        project_id: Project context for the ownership check.
        code_id: The code whose facets should be relabelled.
        db: Injected DB session.
        current_user: Only acts on the user's own facets.

    Returns:
        Updated facets response (same format as GET /facets).

    Raises:
        404 if no active facets exist for this code/user/project combo.
    """
    facets = (
        db.query(Facet)
        .filter(Facet.project_id == project_id, Facet.code_id == code_id, Facet.user_id == current_user.id, Facet.is_active == True)
        .all()
    )
    if not facets:
        raise HTTPException(status_code=404, detail="No active facets for this code")
    suggest_facet_labels(db, code_id, facets)
    return get_facets(db, project_id, user_id=current_user.id, code_id=code_id)


@router.post("/facets/{facet_id}/explain")
def explain_facet_endpoint(
    project_id: str,
    facet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return an AI-generated plain-English explanation of a facet sub-theme.

    Args:
        project_id: Project context for the ownership check.
        facet_id: UUID of the facet to explain.
        db: Injected DB session.
        current_user: Ownership check — only explains the user's own facets.

    Returns:
        Dict with explanation text, facet_label, and code_name.

    Raises:
        404 if the facet doesn't belong to this user + project.
    """
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id, Facet.user_id == current_user.id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")
    code = db.query(Code).filter(Code.id == facet.code_id).first()
    return explain_facet(db, facet, code)
