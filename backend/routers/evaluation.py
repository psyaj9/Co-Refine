"""Evaluation endpoints — read-only access to scoring pipeline data."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, ConsistencyScore, Code, CodedSegment, Document
from models import (
    ConsistencyScoreOut, CodeOverlapEntry, DriftTimelineEntry,
    CooccurrenceEntry, AgreementSummaryEntry, DocumentStatEntry,
)
from services.scoring import compute_code_overlap_matrix, compute_temporal_drift

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.get("/scores", response_model=list[ConsistencyScoreOut])
def get_scores(
    project_id: str = Query(...),
    code_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Return all ConsistencyScore rows for a project, optionally filtered by code."""
    q = db.query(ConsistencyScore).filter(ConsistencyScore.project_id == project_id)
    if code_id:
        q = q.filter(ConsistencyScore.code_id == code_id)
    rows = q.order_by(ConsistencyScore.created_at.desc()).all()
    return [
        ConsistencyScoreOut(
            id=r.id,
            segment_id=r.segment_id,
            code_id=r.code_id,
            user_id=r.user_id,
            project_id=r.project_id,
            centroid_similarity=r.centroid_similarity,
            is_pseudo_centroid=r.is_pseudo_centroid or False,
            proposed_code_prob=r.proposed_code_prob,
            entropy=r.entropy,
            conflict_score=r.conflict_score,
            temporal_drift=r.temporal_drift,
            codebook_distribution=r.codebook_distribution,
            llm_consistency_score=r.llm_consistency_score,
            llm_intent_score=r.llm_intent_score,
            llm_conflict_severity=r.llm_conflict_severity,
            llm_overall_severity=r.llm_overall_severity,
            llm_predicted_code=r.llm_predicted_code,
            llm_predicted_confidence=r.llm_predicted_confidence,
            was_escalated=r.was_escalated or False,
            escalation_reason=r.escalation_reason,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/code-overlap", response_model=list[CodeOverlapEntry])
def get_code_overlap(
    project_id: str = Query(...),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Compute and return the code overlap (cosine centroid similarity) matrix."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    labels = [c.label for c in codes]
    if len(labels) < 2:
        return []
    matrix = compute_code_overlap_matrix(user_id, labels)
    return [
        CodeOverlapEntry(code_a=entry["code_a"], code_b=entry["code_b"], similarity=entry["similarity"])
        for entry in matrix
    ]


@router.get("/drift-timeline", response_model=list[DriftTimelineEntry])
def get_drift_timeline(
    project_id: str = Query(...),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Compute temporal drift for every code in a project."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    results = []
    for code in codes:
        drift = compute_temporal_drift(user_id, code.label)
        results.append(DriftTimelineEntry(code_label=code.label, drift=drift))
    return results


# ── New visualisation-oriented endpoints ─────────────────────────────


@router.get("/code-cooccurrence", response_model=list[CooccurrenceEntry])
def get_code_cooccurrence(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """How often two codes appear on the same document."""
    # Get all segments for the project grouped by document
    segs = (
        db.query(CodedSegment.document_id, CodedSegment.code_id, Code.label)
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(Code.project_id == project_id)
        .all()
    )
    # Group code labels by document
    from collections import defaultdict
    doc_codes: dict[str, set[str]] = defaultdict(set)
    code_label_map: dict[str, str] = {}
    for doc_id, code_id, label in segs:
        doc_codes[doc_id].add(label)
        code_label_map[code_id] = label

    # Count pairwise co-occurrences
    pair_counts: dict[tuple[str, str], int] = defaultdict(int)
    for codes_in_doc in doc_codes.values():
        sorted_codes = sorted(codes_in_doc)
        for i, a in enumerate(sorted_codes):
            for b in sorted_codes[i:]:  # include self-pair on diagonal
                pair_counts[(a, b)] += 1

    return [
        CooccurrenceEntry(code_a=a, code_b=b, count=c)
        for (a, b), c in sorted(pair_counts.items())
    ]


@router.get("/agreement-summary", response_model=list[AgreementSummaryEntry])
def get_agreement_summary(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Per-code agreement between user's assigned code and AI ghost coder's prediction."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    code_map = {c.id: c for c in codes}

    scores = (
        db.query(ConsistencyScore)
        .filter(ConsistencyScore.project_id == project_id)
        .filter(ConsistencyScore.llm_predicted_code.isnot(None))
        .all()
    )

    from collections import defaultdict
    stats: dict[str, dict] = defaultdict(lambda: {
        "total": 0, "agree": 0, "disagree": 0,
        "severity_sum": 0.0, "confidence_sum": 0.0,
        "severity_count": 0, "confidence_count": 0,
    })

    for s in scores:
        code = code_map.get(s.code_id)
        if not code:
            continue
        d = stats[s.code_id]
        d["total"] += 1
        if s.llm_predicted_code == code.label:
            d["agree"] += 1
        else:
            d["disagree"] += 1
        if s.llm_conflict_severity is not None:
            d["severity_sum"] += s.llm_conflict_severity
            d["severity_count"] += 1
        if s.llm_predicted_confidence is not None:
            d["confidence_sum"] += s.llm_predicted_confidence
            d["confidence_count"] += 1

    results = []
    for code_id, d in stats.items():
        code = code_map[code_id]
        results.append(AgreementSummaryEntry(
            code_id=code_id,
            code_label=code.label,
            colour=code.colour or "#FFEB3B",
            total=d["total"],
            agree_count=d["agree"],
            disagree_count=d["disagree"],
            avg_conflict_severity=(
                d["severity_sum"] / d["severity_count"]
                if d["severity_count"] > 0 else None
            ),
            avg_confidence=(
                d["confidence_sum"] / d["confidence_count"]
                if d["confidence_count"] > 0 else None
            ),
        ))
    return results


@router.get("/document-stats", response_model=list[DocumentStatEntry])
def get_document_stats(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Per-document segment and code counts for histograms."""
    docs = db.query(Document).filter(Document.project_id == project_id).all()

    results = []
    for doc in docs:
        segs = (
            db.query(CodedSegment.code_id, Code.label)
            .join(Code, CodedSegment.code_id == Code.id)
            .filter(CodedSegment.document_id == doc.id)
            .all()
        )
        unique_codes = list({label for _, label in segs})
        results.append(DocumentStatEntry(
            document_id=doc.id,
            document_title=doc.title,
            segment_count=len(segs),
            code_count=len(unique_codes),
            codes=sorted(unique_codes),
        ))
    return results
