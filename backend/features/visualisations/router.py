"""Visualisations router: overview, facets, consistency."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Project, Facet, Code
from features.visualisations.schemas import RelabelFacetBody
from features.visualisations.service import get_overview, get_facets, get_consistency, get_code_overlap, explain_facet
from features.facets.service import suggest_facet_labels

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


@router.get("/overview")
def get_vis_overview(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_overview(db, project_id)


@router.get("/facets")
def get_vis_facets(
    project_id: str,
    code_id: str | None = None,
    db: Session = Depends(get_db),
):
    return get_facets(db, project_id, code_id)


@router.get("/consistency")
def get_vis_consistency(
    project_id: str,
    code_id: str | None = None,
    db: Session = Depends(get_db),
):
    return get_consistency(db, project_id, code_id)


@router.get("/overlap")
def get_vis_overlap(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_code_overlap(db, project_id, user_id="default")


@router.patch("/facets/{facet_id}/label")
def relabel_facet(
    project_id: str,
    facet_id: str,
    body: RelabelFacetBody,
    db: Session = Depends(get_db),
):
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
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
):
    """Re-run AI label suggestion for all active facets of a code."""
    facets = (
        db.query(Facet)
        .filter(Facet.project_id == project_id, Facet.code_id == code_id, Facet.is_active == True)
        .all()
    )
    if not facets:
        raise HTTPException(status_code=404, detail="No active facets for this code")
    suggest_facet_labels(db, code_id, facets)
    return get_facets(db, project_id, code_id)


@router.post("/facets/{facet_id}/explain")
def explain_facet_endpoint(
    project_id: str,
    facet_id: str,
    db: Session = Depends(get_db),
):
    """Return an AI-generated plain-English explanation of a facet sub-theme."""
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")
    code = db.query(Code).filter(Code.id == facet.code_id).first()
    return explain_facet(db, facet, code)
