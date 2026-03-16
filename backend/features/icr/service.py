"""
ICR service layer — orchestrates alignment, metric computation, and
LLM-based disagreement analysis.
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
    return MetricOut(
        score=round(r.score, 4) if r.score is not None else None,
        interpretation=r.interpretation,
        n_units=r.n_units,
    )


def _compute_all_metrics(all_units: list, coder_ids: list[str]) -> tuple:
    """Compute all project-level ICR metrics. Returns (pa, fk, ka, ga)."""
    pa = percent_agreement(all_units, coder_ids)
    fk = fleiss_kappa(all_units, coder_ids)
    ka = krippendorffs_alpha(all_units, coder_ids)
    ga = gwets_ac1(all_units, coder_ids)
    return pa, fk, ka, ga


def _build_pairwise_kappa(all_units: list, coder_ids: list[str], users: dict) -> list[PairwiseKappaOut]:
    """Compute pairwise Cohen's kappa for every pair of coders."""
    pairwise: list[PairwiseKappaOut] = []
    for i, a_id in enumerate(coder_ids):
        for b_id in coder_ids[i + 1:]:
            ck = cohens_kappa(all_units, a_id, b_id)
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
    """Return (disagreements_list, n_agreements, n_disagreements, breakdown)."""
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


def _resolution_to_out(r) -> ICRResolutionOut:
    return ICRResolutionOut(
        id=r.id,
        project_id=r.project_id,
        document_id=r.document_id,
        span_start=r.span_start,
        span_end=r.span_end,
        disagreement_type=r.disagreement_type,
        status=r.status,
        chosen_segment_id=r.chosen_segment_id,
        resolved_by=r.resolved_by,
        resolution_note=r.resolution_note,
        llm_analysis=r.llm_analysis,
        created_at=r.created_at,
        resolved_at=r.resolved_at,
    )


def _build_all_units(
    db: Session, project_id: str, coder_ids: list[str]
) -> tuple[list[AlignmentUnit], dict[str, str]]:
    """
    Return (all_units, doc_title_map) by iterating all project documents.
    Segments from all coders are fetched and computed per document.
    """
    documents = repo.list_documents_for_project(db, project_id)
    doc_title_map: dict[str, str] = {d.id: d.title for d in documents}
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

    return all_units, doc_title_map


# ── Public service functions ───────────────────────────────────────────────────

def get_icr_overview(db: Session, project_id: str) -> ICROverviewOut:
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
        # Not enough coders yet — return empty metrics
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

    all_units, _ = _build_all_units(db, project_id, coder_ids)
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
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    codes = repo.get_codes_for_project(db, project_id)

    if len(coder_ids) < 2 or not codes:
        return []

    all_units, _ = _build_all_units(db, project_id, coder_ids)
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

    result.sort(key=lambda x: (x.alpha is None, -(x.alpha or 0)))
    return result


def get_agreement_matrix(db: Session, project_id: str) -> AgreementMatrixOut:
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    codes = repo.get_codes_for_project(db, project_id)

    if len(coder_ids) < 2 or not codes:
        return AgreementMatrixOut(code_labels=[], code_ids=[], matrix=[])

    all_units, _ = _build_all_units(db, project_id, coder_ids)
    code_labels = [c.label for c in codes]
    code_ids = [c.id for c in codes]
    matrix_dict = build_agreement_matrix(all_units, coder_ids, code_ids)

    # Build dense matrix indexed by code position
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
    members = repo.list_members_for_project(db, project_id)
    coder_ids = [m.user_id for m in members]
    users = repo.get_users_by_ids(db, coder_ids)
    codes = repo.get_codes_for_project(db, project_id)
    code_map = {c.id: c for c in codes}

    if len(coder_ids) < 2:
        return DisagreementListOut(items=[], total=0, offset=offset, limit=limit)

    all_units, doc_title_map = _build_all_units(db, project_id, coder_ids)
    all_disagreements, _, _, _ = _classify_disagreements_summary(all_units, coder_ids)

    # Filter out pure agreements (unless type_filter explicitly asks for them)
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

    # Look up resolutions for these units
    all_resolutions = repo.list_resolutions(db, project_id, document_id=document_id)
    res_map: dict[str, tuple[str, str]] = {}   # unit_id -> (resolution_id, status)
    for res in all_resolutions:
        key = f"{res.document_id}:{res.span_start}:{res.span_end}"
        res_map[key] = (res.id, res.status)

    # Paginate
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

        items.append(ICRDisagreementOut(
            unit_id=d.unit_id,
            document_id=d.document_id,
            document_title=doc_title_map.get(d.document_id),
            span_start=d.span_start,
            span_end=d.span_end,
            span_text=None,   # filled by router from document text
            disagreement_type=d.disagreement_type,
            assignments=assignments,
            missing_coder_ids=d.missing_coder_ids,
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
    """Ask the LLM to explain a disagreement and suggest a resolution."""
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
    system_msg = "You are an expert qualitative research methodologist helping to resolve intercoder disagreements."
    user_msg = build_disagreement_analysis_prompt(target_d, users, code_map)
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]

    try:
        result = call_llm(messages)
        analysis = result.get("analysis") or result.get("explanation") or json.dumps(result)
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
    return _resolution_to_out(res)


def update_resolution(
    db: Session,
    project_id: str,
    resolution_id: str,
    data,
    user_id: str,
) -> ICRResolutionOut:
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
    return _resolution_to_out(updated)


def list_resolutions(
    db: Session,
    project_id: str,
    document_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[ICRResolutionOut]:
    results = repo.list_resolutions(db, project_id, document_id=document_id, status=status)
    return [_resolution_to_out(r) for r in results]
