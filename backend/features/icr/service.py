"""
ICR service layer — orchestrates alignment, metric computation, and
LLM-based disagreement analysis.

The core pipeline:
1. Load all members (coders) for the project.
2. For each document, fetch all coders' segments and compute alignment units —
   these are the canonical units of comparison (text spans where any coder coded anything).
3. Classify each unit as agreement or one of four disagreement types.
4. Compute reliability metrics over all units (kappa, alpha, etc.).

The LLM analysis feature is separate — it's called on-demand for a specific
disagreement unit to explain why coders might have differed.
"""
from __future__ import annotations

import json
from typing import Optional

from sqlalchemy.orm import Session

from core.logging import get_logger
from features.icr.alignment import Coding, compute_alignment_units, AlignmentUnit
from features.icr.metrics import (
    percent_agreement,
    cohens_kappa,
    fleiss_kappa,
    krippendorffs_alpha,
    gwets_ac1,
    build_agreement_matrix,
    per_code_alpha,
    _interpret_alpha,
)
from features.icr.disagreements import classify_units, filter_disagreements
from features.icr import repository as repo
from infrastructure.llm.client import call_llm
from features.icr.schemas import (
    CoderInfo,
    MetricOut,
    PairwiseKappaOut,
    MetricsOut,
    DisagreementBreakdownOut,
    ICROverviewOut,
    PerCodeMetricOut,
    AgreementMatrixOut,
    AssignmentOut,
    ICRDisagreementOut,
    DisagreementListOut,
    ICRResolutionOut,
)

logger = get_logger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _metric_result_to_out(r) -> MetricOut:
    """Convert an internal metric result object to the Pydantic output schema.

    Args:
        r: Internal metric result with .score, .interpretation, .n_units.

    Returns:
        MetricOut with score rounded to 4 dp (or None if unavailable).
    """
    return MetricOut(
        score=round(r.score, 4) if r.score is not None else None,
        interpretation=r.interpretation,
        n_units=r.n_units,
    )


def _compute_all_metrics(all_units: list, coder_ids: list[str]) -> tuple:
    """Compute all project-level ICR metrics. Returns (pa, fk, ka, ga).

    Args:
        all_units: List of AlignmentUnit objects across all documents.
        coder_ids: List of all coder user IDs in the project.

    Returns:
        Tuple of (percent_agreement, fleiss_kappa, krippendorffs_alpha, gwets_ac1) results.
    """
    pa = percent_agreement(all_units, coder_ids)
    fk = fleiss_kappa(all_units, coder_ids)
    ka = krippendorffs_alpha(all_units, coder_ids)
    ga = gwets_ac1(all_units, coder_ids)
    return pa, fk, ka, ga


def _build_pairwise_kappa(all_units: list, coder_ids: list[str], users: dict) -> list[PairwiseKappaOut]:
    """Compute pairwise Cohen's kappa for every pair of coders.

    Uses combinations (not permutations) so each pair appears once.

    Args:
        all_units: List of AlignmentUnit objects.
        coder_ids: All coder IDs — we iterate pairs from this list.
        users: Dict of user_id → User ORM object for name lookups.

    Returns:
        List of PairwiseKappaOut, one per unique coder pair.
    """
    pairwise: list[PairwiseKappaOut] = []
    for i, a_id in enumerate(coder_ids):
        for b_id in coder_ids[i + 1:]:
            ck = cohens_kappa(all_units, a_id, b_id)
            # Truncate to 8 chars as a fallback if the user record is missing
            a_name = users[a_id].display_name if a_id in users else a_id[:8]
            b_name = users[b_id].display_name if b_id in users else b_id[:8]
            pairwise.append(PairwiseKappaOut(
                coder_a_id=a_id,
                coder_b_id=b_id,
                coder_a_name=a_name,
                coder_b_name=b_name,
                score=round(ck.score, 4) if ck.score is not None else None,
                interpretation=ck.interpretation,
                n_units=ck.n_units,
            ))
    return pairwise


def _classify_disagreements_summary(all_units: list, coder_ids: list[str]) -> tuple:
    """Return (disagreements_list, n_agreements, n_disagreements, breakdown).

    A single call to classify_units() gets all the data we need; this helper
    also computes the counts and breakdown so callers don't have to.

    Args:
        all_units: List of AlignmentUnit objects.
        coder_ids: All coder IDs in the project.

    Returns:
        Tuple of (disagreements, n_agreements, n_disagreements, DisagreementBreakdownOut).
    """
    disagreements = classify_units(all_units, coder_ids)
    n_agreements = sum(1 for d in disagreements if d.disagreement_type == "agreement")
    n_disagreements = len(disagreements) - n_agreements
    breakdown = DisagreementBreakdownOut(
        code_mismatch=sum(1 for d in disagreements if d.disagreement_type == "code_mismatch"),
        boundary=sum(1 for d in disagreements if d.disagreement_type == "boundary"),
        coverage_gap=sum(1 for d in disagreements if d.disagreement_type == "coverage_gap"),
        split_merge=sum(1 for d in disagreements if d.disagreement_type == "split_merge"),
    )
    return disagreements, n_agreements, n_disagreements, breakdown


def _resolution_to_out(r, db: Session = None) -> ICRResolutionOut:
    """Convert an IcrResolution ORM object to the public output schema.

    Enriches the record with span_text (extracted from document) and
    resolved_by_name (looked up from users table) when db is provided.

    Args:
        r: IcrResolution ORM object.
        db: Optional DB session for enrichment queries. If None, skips enrichment.

    Returns:
        ICRResolutionOut with all fields populated.
    """
    span_text: Optional[str] = None
    resolved_by_name: Optional[str] = None
    if db is not None:
        if r.document_id:
            doc_text = repo.get_document_text(db, r.document_id)
            if doc_text:
                raw = doc_text[r.span_start:r.span_end]
                # Cap at 200 chars to avoid huge payloads in the list view
                span_text = raw[:200] + "…" if len(raw) > 200 else raw
        if r.resolved_by:
            users = repo.get_users_by_ids(db, [r.resolved_by])
            u = users.get(r.resolved_by)
            resolved_by_name = u.display_name if u else r.resolved_by[:8]
    return ICRResolutionOut(
        id=r.id,
        project_id=r.project_id,
        document_id=r.document_id,
        span_start=r.span_start,
        span_end=r.span_end,
        span_text=span_text,
        disagreement_type=r.disagreement_type,
        status=r.status,
        chosen_segment_id=r.chosen_segment_id,
        resolved_by=r.resolved_by,
        resolved_by_name=resolved_by_name,
        resolution_note=r.resolution_note,
        llm_analysis=r.llm_analysis,
        created_at=r.created_at,
        resolved_at=r.resolved_at,
    )


def _build_all_units(
    db: Session, project_id: str, coder_ids: list[str]
) -> tuple[list[AlignmentUnit], dict[str, str], dict[str, str]]:
    """
    Return (all_units, doc_title_map, doc_text_map) by iterating all project documents.

    Segments from all coders are fetched and alignment-computed per document,
    then merged into a single flat list. This is the foundational data structure
    for all ICR metric computations.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to build units for.
        coder_ids: All coder user IDs to include.

    Returns:
        Tuple of (all_units, doc_title_map, doc_text_map) where the maps are
        keyed by document_id.
    """
    documents = repo.list_documents_for_project(db, project_id)
    doc_title_map: dict[str, str] = {d.id: d.title for d in documents}
    doc_text_map: dict[str, str] = {d.id: d.full_text for d in documents if d.full_text}
    all_units: list[AlignmentUnit] = []

    for doc in documents:
        rows = repo.list_segments_for_document_all_coders(db, doc.id, coder_ids)
        if not rows:
            continue
        units = compute_alignment_units(
            segments=rows,
            coder_ids=coder_ids,
            project_id=project_id,
            document_id=doc.id,
        )
        all_units.extend(units)

    return all_units, doc_title_map, doc_text_map


# ── Public service functions ───────────────────────────────────────────────────

def get_icr_overview(db: Session, project_id: str) -> ICROverviewOut:
    """Compute full project-level ICR overview.

    Returns empty metrics with "insufficient data" interpretation if the project
    has fewer than 2 coders — can't compute reliability with one person.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to compute ICR for.

    Returns:
        ICROverviewOut with all metrics populated.
    """
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    users = repo.get_users_by_ids(db, coder_ids)

    coders = [
        CoderInfo(
            user_id=uid,
            display_name=users[uid].display_name if uid in users else uid[:8],
            email=users[uid].email if uid in users else "",
        )
        for uid in coder_ids
    ]

    if len(coder_ids) < 2:
        # Not enough coders yet — return zeros so the UI can show a helpful message
        empty_metric = MetricOut(score=None, interpretation="insufficient data", n_units=0)
        return ICROverviewOut(
            n_coders=len(coder_ids),
            n_units=0,
            n_agreements=0,
            n_disagreements=0,
            disagreement_breakdown=DisagreementBreakdownOut(
                code_mismatch=0, boundary=0, coverage_gap=0, split_merge=0
            ),
            metrics=MetricsOut(
                percent_agreement=empty_metric,
                fleiss_kappa=empty_metric,
                krippendorffs_alpha=empty_metric,
                gwets_ac1=empty_metric,
                pairwise_cohens_kappa=[],
            ),
            coders=coders,
        )

    all_units, _, _ = _build_all_units(db, project_id, coder_ids)
    _, n_agreements, n_disagreements, breakdown = _classify_disagreements_summary(all_units, coder_ids)
    pa, fk, ka, ga = _compute_all_metrics(all_units, coder_ids)
    pairwise = _build_pairwise_kappa(all_units, coder_ids, users)

    return ICROverviewOut(
        n_coders=len(coder_ids),
        n_units=len(all_units),
        n_agreements=n_agreements,
        n_disagreements=n_disagreements,
        disagreement_breakdown=breakdown,
        metrics=MetricsOut(
            percent_agreement=_metric_result_to_out(pa),
            fleiss_kappa=_metric_result_to_out(fk),
            krippendorffs_alpha=_metric_result_to_out(ka),
            gwets_ac1=_metric_result_to_out(ga),
            pairwise_cohens_kappa=pairwise,
        ),
        coders=coders,
    )


def get_per_code_metrics(db: Session, project_id: str) -> list[PerCodeMetricOut]:
    """Compute Krippendorff's alpha for each code individually.

    Sorted best (highest alpha) to worst so the most problematic codes
    appear at the bottom of the list.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to compute per-code metrics for.

    Returns:
        List of PerCodeMetricOut, sorted by alpha descending (None values last).
    """
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    codes = repo.get_codes_for_project(db, project_id)

    if len(coder_ids) < 2 or not codes:
        return []

    all_units, _, _ = _build_all_units(db, project_id, coder_ids)
    code_ids = [c.id for c in codes]
    alphas = per_code_alpha(all_units, coder_ids, code_ids)

    code_map = {c.id: c for c in codes}
    result = []
    for item in alphas:
        code_id = item["code_id"]
        alpha_score = item["alpha"]
        code = code_map.get(code_id)
        if not code:
            continue
        result.append(PerCodeMetricOut(
            code_id=code_id,
            code_label=code.label,
            code_colour=code.colour,
            alpha=round(alpha_score, 4) if alpha_score is not None else None,
            interpretation=_interpret_alpha(alpha_score),
            n_units=item["n_units"],
        ))

    # Sort: None last, then by alpha descending (best agreement first)
    result.sort(key=lambda x: (x.alpha is None, -(x.alpha or 0)))
    return result


def get_agreement_matrix(db: Session, project_id: str) -> AgreementMatrixOut:
    """Build the code confusion matrix for the project.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to compute the matrix for.

    Returns:
        AgreementMatrixOut with dense n×n matrix.
    """
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    codes = repo.get_codes_for_project(db, project_id)

    if len(coder_ids) < 2 or not codes:
        return AgreementMatrixOut(code_labels=[], code_ids=[], matrix=[])

    all_units, _, _ = _build_all_units(db, project_id, coder_ids)
    code_labels = [c.label for c in codes]
    code_ids = [c.id for c in codes]
    matrix_dict = build_agreement_matrix(all_units, coder_ids, code_ids)

    # Convert sparse dict to dense indexed matrix
    n = len(codes)
    idx_map = {cid: i for i, cid in enumerate(code_ids)}
    matrix: list[list[int]] = [[0] * n for _ in range(n)]
    for (a, b), count in matrix_dict.items():
        i, j = idx_map.get(a), idx_map.get(b)
        if i is not None and j is not None:
            matrix[i][j] += count

    return AgreementMatrixOut(
        code_labels=code_labels,
        code_ids=code_ids,
        matrix=matrix,
    )


def get_disagreements(
    db: Session,
    project_id: str,
    document_id: Optional[str] = None,
    code_id: Optional[str] = None,
    disagreement_type: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
) -> DisagreementListOut:
    """Return a paginated list of disagreements, excluding already-resolved ones.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to query.
        document_id: Optional filter to one document.
        code_id: Optional filter to disagreements involving a specific code.
        disagreement_type: Optional filter by type string.
        offset: Pagination start index.
        limit: Max items to return.

    Returns:
        DisagreementListOut with paginated items and total pre-pagination count.
    """
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    users = repo.get_users_by_ids(db, coder_ids)
    codes = repo.get_codes_for_project(db, project_id)
    code_map = {c.id: c for c in codes}

    if len(coder_ids) < 2:
        return DisagreementListOut(items=[], total=0, offset=offset, limit=limit)

    all_units, doc_title_map, doc_text_map = _build_all_units(db, project_id, coder_ids)
    all_disagreements, _, _, _ = _classify_disagreements_summary(all_units, coder_ids)

    # Strip pure agreement units from the default view — they're not actionable
    if disagreement_type != "agreement":
        filtered = [d for d in all_disagreements if d.disagreement_type != "agreement"]
    else:
        filtered = all_disagreements

    filtered = filter_disagreements(
        filtered,
        disagreement_type=disagreement_type if disagreement_type != "agreement" else None,
        code_id=code_id,
        document_id=document_id,
    )

    # Look up all resolutions and hide already-resolved disagreements
    all_resolutions = repo.list_resolutions(db, project_id, document_id=document_id)
    res_map: dict[str, tuple[str, str]] = {}   # key -> (resolution_id, status)
    for res in all_resolutions:
        key = f"{res.document_id}:{res.span_start}:{res.span_end}"
        res_map[key] = (res.id, res.status)

    # Filter out resolved disagreements — they've been dealt with
    filtered = [
        d for d in filtered
        if res_map.get(f"{d.document_id}:{d.span_start}:{d.span_end}", (None, None))[1] != "resolved"
    ]

    # Paginate after filtering so total reflects the unresolved count
    total = len(filtered)
    page = filtered[offset: offset + limit]

    items = []
    for d in page:
        assignments = []
        for a in d.assignments:
            code = code_map.get(a.code_id)
            assignments.append(AssignmentOut(
                coder_id=a.coder_id,
                coder_name=users[a.coder_id].display_name if a.coder_id in users else a.coder_id[:8],
                code_id=a.code_id,
                code_label=a.code_label,
                code_colour=code.colour if code else "#888888",
                segment_id=a.segment_id,
                start_index=a.start_index,
                end_index=a.end_index,
            ))

        lookup_key = f"{d.document_id}:{d.span_start}:{d.span_end}"
        res_entry = res_map.get(lookup_key)

        # Extract span text for display — cap at 200 chars
        doc_text = doc_text_map.get(d.document_id, "")
        span_text: Optional[str] = None
        if doc_text:
            raw = doc_text[d.span_start:d.span_end]
            span_text = raw[:200] + "…" if len(raw) > 200 else raw

        missing_names = [
            users[uid].display_name if uid in users else uid[:8]
            for uid in d.missing_coder_ids
        ]

        items.append(ICRDisagreementOut(
            unit_id=d.unit_id,
            document_id=d.document_id,
            document_title=doc_title_map.get(d.document_id),
            span_start=d.span_start,
            span_end=d.span_end,
            span_text=span_text,
            disagreement_type=d.disagreement_type,
            assignments=assignments,
            missing_coder_ids=d.missing_coder_ids,
            missing_coder_names=missing_names,
            resolution_id=res_entry[0] if res_entry else None,
            resolution_status=res_entry[1] if res_entry else None,
        ))

    return DisagreementListOut(items=items, total=total, offset=offset, limit=limit)


def analyze_disagreement_llm(
    db: Session,
    project_id: str,
    unit_id: str,
    document_id: str,
) -> dict:
    """Ask the LLM to explain a disagreement and suggest a resolution.

    Rebuilds the alignment units for the specified document, finds the target
    unit, and sends the disagreement details to the LLM for analysis.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project context for loading members and codes.
        unit_id: The specific alignment unit to analyse.
        document_id: Document containing the disagreement.

    Returns:
        Dict with "analysis" text and "unit_id", or {"error": ...} if not found.
    """
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    users = repo.get_users_by_ids(db, coder_ids)

    rows = repo.list_segments_for_document_all_coders(db, document_id, coder_ids)
    units = compute_alignment_units(
        segments=rows,
        coder_ids=coder_ids,
        project_id=project_id,
        document_id=document_id,
    )

    target = next((u for u in units if u.unit_id == unit_id), None)
    if not target:
        return {"error": "Unit not found"}

    disagreements = classify_units(units, coder_ids)
    target_d = next((d for d in disagreements if d.unit_id == unit_id), None)
    if not target_d:
        return {"error": "Disagreement not found"}

    codes = repo.get_codes_for_project(db, project_id)
    code_map = {c.id: c for c in codes}

    from prompts.icr_prompt import build_disagreement_analysis_prompt
    messages = build_disagreement_analysis_prompt(target_d, users, code_map)

    try:
        result = call_llm(messages)
        # Try "analysis" key first, then "recommendation", then "explanation", then fall back to JSON dump
        analysis = result.get("analysis") or result.get("recommendation") or result.get("explanation") or json.dumps(result)
        return {"analysis": analysis, "unit_id": unit_id}
    except Exception as exc:
        logger.error("LLM disagreement analysis failed", extra={"error": str(exc)})
        return {"error": str(exc)}


def create_resolution(
    db: Session,
    project_id: str,
    data,
    user_id: str,
) -> ICRResolutionOut:
    """Create a new resolution record and return it as a response schema.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project the resolution belongs to.
        data: ICRResolutionCreate schema with resolution details.
        user_id: Who is creating the resolution.

    Returns:
        ICRResolutionOut with span_text and resolver name enriched.
    """
    res = repo.create_resolution(
        db=db,
        project_id=project_id,
        document_id=data.document_id,
        span_start=data.span_start,
        span_end=data.span_end,
        disagreement_type=data.disagreement_type,
        chosen_segment_id=data.chosen_segment_id,
        resolution_note=data.resolution_note,
        user_id=user_id,
    )
    return _resolution_to_out(res, db)


def update_resolution(
    db: Session,
    project_id: str,
    resolution_id: str,
    data,
    user_id: str,
) -> ICRResolutionOut:
    """Update a resolution and return the updated record.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project context for ownership check.
        resolution_id: UUID of the resolution to update.
        data: ICRResolutionUpdate schema with fields to change.
        user_id: Who is making the update.

    Returns:
        ICRResolutionOut with updated fields.

    Raises:
        HTTPException: 404 if resolution not found or doesn't belong to this project.
    """
    res = repo.get_resolution(db, resolution_id)
    if not res or res.project_id != project_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Resolution not found")

    updated = repo.update_resolution(
        db=db,
        resolution=res,
        status=data.status,
        chosen_segment_id=data.chosen_segment_id,
        resolution_note=data.resolution_note,
        user_id=user_id,
    )
    return _resolution_to_out(updated, db)


def list_resolutions(
    db: Session,
    project_id: str,
    document_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[ICRResolutionOut]:
    """Return all resolutions for a project, enriched with span text and resolver name.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to list resolutions for.
        document_id: Optional filter to one document.
        status: Optional filter by resolution status.

    Returns:
        List of ICRResolutionOut, newest first.
    """
    results = repo.list_resolutions(db, project_id, document_id=document_id, status=status)
    return [_resolution_to_out(r, db) for r in results]
