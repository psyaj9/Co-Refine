from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Project, CodedSegment, Code, ConsistencyScore, Facet, FacetAssignment

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


@router.get("/overview")
def get_vis_overview(project_id: str, db: Session = Depends(get_db)):
    """Tab 1: Project-level summary stats + score-over-time series."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    total_segments = db.query(func.count(CodedSegment.id)).filter(
        CodedSegment.document_id.in_(
            db.query(func.distinct(CodedSegment.document_id))
            .join(Code, CodedSegment.code_id == Code.id)
            .filter(Code.project_id == project_id)
            .scalar_subquery()
        )
    ).scalar() or 0

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

    # Top drifting codes (std dev of scores as proxy for drift)
    import numpy as np
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    top_drifting = []
    for code in codes:
        code_scores = [
            s.llm_consistency_score
            for s in scores
            if s.code_id == code.id and s.llm_consistency_score is not None
        ]
        if len(code_scores) >= 2:
            top_drifting.append({
                "code_name": code.label,
                "drift_score": float(np.std(code_scores)),
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

    result = []
    for facet in facets:
        code = db.query(Code).filter(Code.id == facet.code_id).first()
        assignments = (
            db.query(FacetAssignment)
            .filter(FacetAssignment.facet_id == facet.id)
            .all()
        )
        segments_data = []
        for asgn in assignments:
            seg = db.query(CodedSegment).filter(CodedSegment.id == asgn.segment_id).first()
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

    scores_by_code = []
    timeline = []

    for code in codes:
        code_scores = (
            db.query(ConsistencyScore)
            .filter(
                ConsistencyScore.code_id == code.id,
                ConsistencyScore.project_id == project_id,
                ConsistencyScore.llm_consistency_score.isnot(None),
            )
            .order_by(ConsistencyScore.created_at)
            .all()
        )
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
    body: dict,
    db: Session = Depends(get_db),
):
    """Allow researcher to rename a facet."""
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
    if not facet:
        raise HTTPException(status_code=404, detail="Facet not found")
    facet.label = body.get("label", facet.label)
    db.commit()
    return {"id": facet.id, "label": facet.label}
