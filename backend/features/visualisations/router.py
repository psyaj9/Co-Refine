"""Visualisations router: overview, facets, consistency."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Project, Facet
from features.visualisations.schemas import RelabelFacetBody
from features.visualisations.service import get_overview, get_facets, get_consistency

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
    db.commit()
    return {"id": facet.id, "label": facet.label}
