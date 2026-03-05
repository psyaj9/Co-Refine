"""Visualisations router: overview, facets, consistency."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Project, Facet, CodedSegment, FacetAssignment
from features.visualisations.schemas import RelabelFacetBody
from features.visualisations.service import get_overview, get_facets, get_consistency, get_codes_overview
from features.facets.service import suggest_facet_labels
from infrastructure.llm.client import call_llm
from prompts.facet_explain_prompt import build_facet_explain_prompt

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


@router.get("/overview")
def get_vis_overview(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_overview(db, project_id)


@router.get("/codes-overview")
def get_vis_codes_overview(project_id: str, db: Session = Depends(get_db)):
    """Overview scatter: all positioned segments grouped by code with per-code centroids."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_codes_overview(db, project_id)


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
def explain_facet(
    project_id: str,
    facet_id: str,
    db: Session = Depends(get_db),
):
    """Ask the LLM to explain what unifies the segments in a facet."""
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")

    # Collect up to 8 segment texts via facet assignments
    assignments = (
        db.query(FacetAssignment)
        .filter(FacetAssignment.facet_id == facet_id)
        .order_by(FacetAssignment.similarity_score.desc())
        .limit(8)
        .all()
    )
    seg_ids = [a.segment_id for a in assignments]
    segs = db.query(CodedSegment).filter(CodedSegment.id.in_(seg_ids)).all()
    segment_texts = [s.text for s in segs if s.text]

    if not segment_texts:
        return {"explanation": "No segment texts found for this facet."}

    # Get code name for context
    from core.models import Code
    code = db.query(Code).filter(Code.id == facet.code_id).first()
    code_name = code.label if code else "Unknown code"

    messages = build_facet_explain_prompt(facet.label, code_name, segment_texts)
    result = call_llm(messages)
    explanation = result.get("explanation", "Unable to generate explanation.")
    return {"explanation": explanation}
