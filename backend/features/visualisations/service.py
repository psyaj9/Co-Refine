"""Visualisations service: overview, facet explorer, consistency aggregation.

Extracted from routers/vis.py — pure data transformation, no HTTP concerns.
"""
import math
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Project, CodedSegment, Code, ConsistencyScore, Facet, FacetAssignment
from infrastructure.llm.client import call_llm


def _safe_avg(lst: list[float]) -> float | None:
    return round(sum(lst) / len(lst), 3) if lst else None


def get_overview(db: Session, project_id: str) -> dict:
    """Tab 1: Project-level summary stats + multi-metric time-series."""
    total_segments = (
        db.query(func.count(CodedSegment.id))
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(Code.project_id == project_id)
        .scalar()
    ) or 0

    total_codes = db.query(func.count(Code.id)).filter(
        Code.project_id == project_id
    ).scalar() or 0

    scores = (
        db.query(ConsistencyScore)
        .filter(ConsistencyScore.project_id == project_id)
        .order_by(ConsistencyScore.created_at)
        .all()
    )

    scored = [s for s in scores if s.llm_consistency_score is not None]
    avg_score = _safe_avg([s.llm_consistency_score for s in scored]) or 0.0

    # Centroid similarity: exclude pseudo-centroids (code definition fallback) as they skew the avg
    centroid_vals = [
        s.centroid_similarity for s in scores
        if s.centroid_similarity is not None and not s.is_pseudo_centroid
    ]
    avg_centroid_sim = _safe_avg(centroid_vals) or 0.0

    total_all = len(scores)
    escalation_rate = round(sum(1 for s in scores if s.was_escalated) / max(1, total_all), 3)

    # Multi-metric time-series — only metrics that are meaningful and drive real decisions:
    # avg_consistency = Stage 2 LLM judgment; avg_centroid_sim = Stage 1 embedding guardrail
    metrics_by_date: dict[str, dict[str, list[float]]] = {}
    for s in scores:
        d = s.created_at.strftime("%Y-%m-%d")
        if d not in metrics_by_date:
            metrics_by_date[d] = {"consistency": [], "centroid": []}
        if s.llm_consistency_score is not None:
            metrics_by_date[d]["consistency"].append(s.llm_consistency_score)
        if s.centroid_similarity is not None and not s.is_pseudo_centroid:
            metrics_by_date[d]["centroid"].append(s.centroid_similarity)

    metrics_over_time = [
        {
            "date": d,
            "avg_consistency": _safe_avg(v["consistency"]),
            "avg_centroid_sim": _safe_avg(v["centroid"]),
        }
        for d, v in sorted(metrics_by_date.items())
    ]

    # Legacy series (backward compat)
    score_trend = [
        {"date": e["date"], "avg_score": e["avg_consistency"]}
        for e in metrics_over_time
        if e["avg_consistency"] is not None
    ]

    codes = db.query(Code).filter(Code.project_id == project_id).all()
    code_name_map = {c.id: c.label for c in codes}

    # "Most Variable Codes" — std dev of LLM consistency scores per code.
    # High variability = inconsistent application, may signal a poorly-defined code.
    scores_by_code: dict[str, list[float]] = {}
    for s in scored:
        scores_by_code.setdefault(s.code_id, []).append(s.llm_consistency_score)
    top_variable = []
    for code in codes:
        code_scores = scores_by_code.get(code.id, [])
        if len(code_scores) >= 2:
            mean = sum(code_scores) / len(code_scores)
            std = math.sqrt(sum((x - mean) ** 2 for x in code_scores) / len(code_scores))
            top_variable.append({"code_name": code.label, "variability_score": round(std, 4)})
    top_variable.sort(key=lambda x: x["variability_score"], reverse=True)

    # "Temporal Drift by Code" — average Stage 1 temporal drift per code.
    # Uses the LOGOS metric: cosine distance between early and recent coding centroids.
    # Requires >= 10 segments per code to compute (see scoring/temporal_drift.py).
    temporal_drift_by_code: dict[str, list[float]] = {}
    for s in scores:
        if s.temporal_drift is not None and not s.is_pseudo_centroid:
            temporal_drift_by_code.setdefault(s.code_id, []).append(s.temporal_drift)
    top_temporal_drift = []
    for code_id, drifts in temporal_drift_by_code.items():
        if len(drifts) >= 2 and code_id in code_name_map:
            avg = round(sum(drifts) / len(drifts), 4)
            top_temporal_drift.append({"code_name": code_name_map[code_id], "avg_drift": avg})
    top_temporal_drift.sort(key=lambda x: x["avg_drift"], reverse=True)

    return {
        "total_segments": total_segments,
        "total_codes": total_codes,
        "avg_consistency_score": round(avg_score, 3),
        "avg_centroid_sim": round(avg_centroid_sim, 3),
        "escalation_rate": escalation_rate,
        "score_over_time": score_trend,
        "metrics_over_time": metrics_over_time,
        "top_variable_codes": top_variable[:5],
        "top_temporal_drift_codes": top_temporal_drift[:5],
    }


def get_facets(db: Session, project_id: str, code_id: str | None = None) -> dict:
    """Tab 2: Facet explorer — scatter data per facet with similarity stats."""
    query = db.query(Facet).filter(Facet.project_id == project_id, Facet.is_active == True)
    if code_id:
        query = query.filter(Facet.code_id == code_id)
    facets = query.all()

    if not facets:
        return {"facets": []}

    facet_ids = [f.id for f in facets]
    code_ids = list({f.code_id for f in facets})

    codes_map = {c.id: c for c in db.query(Code).filter(Code.id.in_(code_ids)).all()}
    assignments = db.query(FacetAssignment).filter(FacetAssignment.facet_id.in_(facet_ids)).all()
    seg_ids = list({a.segment_id for a in assignments})
    segs_map = {s.id: s for s in db.query(CodedSegment).filter(CodedSegment.id.in_(seg_ids)).all()}

    asgns_by_facet: dict[str, list[FacetAssignment]] = {}
    for a in assignments:
        asgns_by_facet.setdefault(a.facet_id, []).append(a)

    result = []
    for facet in facets:
        code = codes_map.get(facet.code_id)
        segments_data = []
        similarity_scores: list[float] = []
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
                if asgn.similarity_score is not None:
                    similarity_scores.append(asgn.similarity_score)

        result.append({
            "facet_id": facet.id,
            "facet_label": facet.label,
            "suggested_label": facet.suggested_label,
            "label_source": facet.label_source or "auto",
            "code_id": facet.code_id,
            "code_name": code.label if code else "Unknown",
            "code_definition": code.definition if code else None,
            "segment_count": facet.segment_count,
            "avg_similarity": _safe_avg(similarity_scores),
            "min_similarity": round(min(similarity_scores), 3) if similarity_scores else None,
            "segments": segments_data,
        })

    return {"facets": result}


def get_consistency(db: Session, project_id: str, code_id: str | None = None) -> dict:
    """Tab 3: Box plots + timeline, enriched with Stage 1 metrics and reflection data."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    if code_id:
        codes = [c for c in codes if c.id == code_id]

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
    reflection_data = []

    for code in codes:
        code_scores = scores_lookup.get(code.id, [])
        scores_by_code.append({
            "code_name": code.label,
            "code_id": code.id,
            "scores": [s.llm_consistency_score for s in code_scores],
            "entropy_scores": [s.entropy for s in code_scores if s.entropy is not None],
            "conflict_scores": [s.conflict_score for s in code_scores if s.conflict_score is not None],
            "centroid_similarity_scores": [
                s.centroid_similarity for s in code_scores if s.centroid_similarity is not None
            ],
        })
        for s in code_scores:
            entry: dict = {
                "date": s.created_at.isoformat(),
                "score": s.llm_consistency_score,
                "code_name": code.label,
                "code_id": code.id,
            }
            if s.entropy is not None:
                entry["entropy"] = s.entropy
            if s.conflict_score is not None:
                entry["conflict"] = s.conflict_score
            timeline.append(entry)

            if s.was_reflected and s.initial_consistency_score is not None:
                reflection_data.append({
                    "date": s.created_at.isoformat(),
                    "code_id": code.id,
                    "code_name": code.label,
                    "initial_score": s.initial_consistency_score,
                    "final_score": s.llm_consistency_score,
                    "delta": round((s.llm_consistency_score or 0.0) - s.initial_consistency_score, 3),
                })

    return {
        "scores_by_code": scores_by_code,
        "timeline": sorted(timeline, key=lambda x: x["date"]),
        "reflection_data": reflection_data,
    }


def explain_facet(facet: Facet, code: Code | None) -> dict:
    """Call LLM to produce a plain-English explanation of a discovered facet sub-theme."""
    code_label = code.label if code else "Unknown code"
    code_def = (code.definition or "No definition provided") if code else "No definition provided"
    facet_label = facet.label or facet.suggested_label or "Unnamed facet"
    segment_count = facet.segment_count or 0

    prompt = [
        {
            "role": "system",
            "content": (
                "You are a qualitative research assistant helping a researcher understand "
                "discovered sub-themes (facets) within their codebook. "
                "Respond with JSON in the format: {\"explanation\": \"<plain-English text>\"}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"I am doing qualitative coding research. I have a code called '{code_label}' "
                f"defined as: '{code_def}'.\n\n"
                f"Within this code, an AI clustering algorithm discovered a sub-theme (facet) "
                f"labelled: '{facet_label}'. This facet contains {segment_count} coded text segments.\n\n"
                "Please explain in 2-3 sentences what this facet likely represents and why these "
                "segments may cluster together as a distinct sub-theme within the broader code. "
                "Be specific and use qualitative research language."
            ),
        },
    ]

    result = call_llm(prompt)
    explanation = result.get("explanation", "Unable to generate explanation at this time.")
    return {"explanation": explanation, "facet_label": facet_label, "code_name": code_label}
