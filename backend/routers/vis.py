import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.database import get_db
from core.models import Project, CodedSegment, Code, ConsistencyScore, Facet, FacetAssignment

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


class RelabelFacetBody(BaseModel):
    label: str


@router.get("/overview")
def get_vis_overview(project_id: str, db: Session = Depends(get_db)):
    """Tab 1: Project-level summary stats + score-over-time series."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    total_segments = (
        db.query(func.count(CodedSegment.id))
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(Code.project_id == project_id)
        .scalar()
    ) or 0

    total_codes = db.query(func.count(Code.id)).filter(
        Code.project_id == project_id
    ).scalar() or 0

    # Fetch all consistency scores for this project
    scores = (
        db.query(ConsistencyScore)
        .filter(ConsistencyScore.project_id == project_id)
        .order_by(ConsistencyScore.created_at)
        .all()
    )

    scored = [s for s in scores if s.llm_consistency_score is not None]
    avg_score = (
        sum(s.llm_consistency_score for s in scored) / len(scored) if scored else 0.0
    )

    # Group scores by date for trend line
    score_over_time: dict[str, list[float]] = {}
    for s in scored:
        date_str = s.created_at.strftime("%Y-%m-%d")
        score_over_time.setdefault(date_str, []).append(s.llm_consistency_score)
    score_trend = [
        {"date": d, "avg_score": round(sum(v) / len(v), 3)}
        for d, v in sorted(score_over_time.items())
    ]

    # Top drifting codes (population std dev of scores as proxy for drift)
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    # Build a lookup for fast grouping instead of scanning all scores per code
    scores_by_code: dict[str, list[float]] = {}
    for s in scored:
        scores_by_code.setdefault(s.code_id, []).append(s.llm_consistency_score)
    top_drifting = []
    for code in codes:
        code_scores = scores_by_code.get(code.id, [])
        if len(code_scores) >= 2:
            mean = sum(code_scores) / len(code_scores)
            std = math.sqrt(sum((x - mean) ** 2 for x in code_scores) / len(code_scores))
            top_drifting.append({
                "code_name": code.label,
                "drift_score": round(std, 4),
            })
    top_drifting.sort(key=lambda x: x["drift_score"], reverse=True)

    return {
        "total_segments": total_segments,
        "total_codes": total_codes,
        "avg_consistency_score": round(avg_score, 3),
        "score_over_time": score_trend,
        "top_drifting_codes": top_drifting[:5],
    }


@router.get("/facets")
def get_vis_facets(project_id: str, code_id: str | None = None, db: Session = Depends(get_db)):
    """Tab 2: Facet explorer. Returns scatter data (tsne_x/y) + facet labels per code."""
    query = db.query(Facet).filter(Facet.project_id == project_id, Facet.is_active == True)
    if code_id:
        query = query.filter(Facet.code_id == code_id)
    facets = query.all()

    if not facets:
        return {"facets": []}

    facet_ids = [f.id for f in facets]
    code_ids = list({f.code_id for f in facets})

    # Batch-load codes and segments to avoid N+1 queries
    codes_map = {c.id: c for c in db.query(Code).filter(Code.id.in_(code_ids)).all()}
    assignments = (
        db.query(FacetAssignment)
        .filter(FacetAssignment.facet_id.in_(facet_ids))
        .all()
    )
    seg_ids = list({a.segment_id for a in assignments})
    segs_map = {s.id: s for s in db.query(CodedSegment).filter(CodedSegment.id.in_(seg_ids)).all()}

    # Group assignments by facet_id
    asgns_by_facet: dict[str, list[FacetAssignment]] = {}
    for a in assignments:
        asgns_by_facet.setdefault(a.facet_id, []).append(a)

    result = []
    for facet in facets:
        code = codes_map.get(facet.code_id)
        segments_data = []
        for asgn in asgns_by_facet.get(facet.id, []):
            seg = segs_map.get(asgn.segment_id)
            if seg and seg.tsne_x is not None:
                segments_data.append({
                    "segment_id": seg.id,
                    "tsne_x": seg.tsne_x,
                    "tsne_y": seg.tsne_y,
                    "similarity_score": asgn.similarity_score,
                    "text_preview": (seg.text or "")[:120],
                })
        result.append({
            "facet_id": facet.id,
            "facet_label": facet.label,
            "code_id": facet.code_id,
            "code_name": code.label if code else "Unknown",
            "segment_count": facet.segment_count,
            "segments": segments_data,
        })

    return {"facets": result}


@router.get("/consistency")
def get_vis_consistency(
    project_id: str,
    code_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Tab 3: Box plots + timeline of consistency scores, filterable by code."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    if code_id:
        codes = [c for c in codes if c.id == code_id]

    # Single query for all scores, then group in Python
    code_ids = [c.id for c in codes]
    all_scores = (
        db.query(ConsistencyScore)
        .filter(
            ConsistencyScore.code_id.in_(code_ids),
            ConsistencyScore.project_id == project_id,
            ConsistencyScore.llm_consistency_score.isnot(None),
        )
        .order_by(ConsistencyScore.created_at)
        .all()
    )
    scores_lookup: dict[str, list[ConsistencyScore]] = {}
    for s in all_scores:
        scores_lookup.setdefault(s.code_id, []).append(s)

    scores_by_code = []
    timeline = []

    for code in codes:
        code_scores = scores_lookup.get(code.id, [])
        scores_by_code.append({
            "code_name": code.label,
            "code_id": code.id,
            "scores": [s.llm_consistency_score for s in code_scores],
        })
        for s in code_scores:
            timeline.append({
                "date": s.created_at.isoformat(),
                "score": s.llm_consistency_score,
                "code_name": code.label,
                "code_id": code.id,
            })

    return {
        "scores_by_code": scores_by_code,
        "timeline": sorted(timeline, key=lambda x: x["date"]),
    }


@router.patch("/facets/{facet_id}/label")
def relabel_facet(
    project_id: str,
    facet_id: str,
    body: RelabelFacetBody,
    db: Session = Depends(get_db),
):
    """Allow researcher to rename a facet."""
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")
    facet.label = body.label
    db.commit()
    return {"id": facet.id, "label": facet.label}
