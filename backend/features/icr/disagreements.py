"""
Disagreement detection and classification.

Takes a list of AlignmentUnit objects and returns structured disagreement
records suitable for display in the ICR UI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from features.icr.alignment import AlignmentUnit, _jaccard


@dataclass
class CoderAssignment:
    coder_id: str
    code_id: str
    code_label: str
    segment_id: str
    start_index: int
    end_index: int


@dataclass
class Disagreement:
    unit_id: str
    document_id: str
    project_id: str
    span_start: int
    span_end: int
    # one of: "agreement" | "code_mismatch" | "boundary" | "coverage_gap" | "split_merge"
    disagreement_type: str
    assignments: list[CoderAssignment] = field(default_factory=list)
    # IDs of coders who did NOT code this unit (for coverage_gap type)
    missing_coder_ids: list[str] = field(default_factory=list)


def classify_units(
    units: list[AlignmentUnit],
    all_coder_ids: list[str],
    jaccard_threshold: float = 0.5,
) -> list[Disagreement]:
    """
    Classify every alignment unit and return Disagreement records
    (including agreements — filter by disagreement_type on the consumer side).
    """
    result: list[Disagreement] = []
    coder_set = set(all_coder_ids)

    for unit in units:
        participating_coders = unit.coder_ids & coder_set
        missing_coders = list(coder_set - participating_coders)

        # Build assignments list (one per participating coder, primary coding)
        assignments: list[CoderAssignment] = []
        for coder_id in sorted(participating_coders):
            primary = unit.primary_coding_for_coder(coder_id)
            if primary:
                assignments.append(CoderAssignment(
                    coder_id=coder_id,
                    code_id=primary.code_id,
                    code_label=primary.code_label,
                    segment_id=primary.segment_id,
                    start_index=primary.start_index,
                    end_index=primary.end_index,
                ))

        d_type = _classify_type(unit, assignments, missing_coders, jaccard_threshold)

        result.append(Disagreement(
            unit_id=unit.unit_id,
            document_id=unit.document_id,
            project_id=unit.project_id,
            span_start=unit.span_start,
            span_end=unit.span_end,
            disagreement_type=d_type,
            assignments=assignments,
            missing_coder_ids=missing_coders,
        ))

    return result


def _classify_type(
    unit: AlignmentUnit,
    assignments: list[CoderAssignment],
    missing_coders: list[str],
    jaccard_threshold: float,
) -> str:
    # coverage_gap: fewer than 2 coders participated (one coder coded it, others didn't)
    # If 2+ coders participated, classify by the nature of their disagreement even if
    # additional coders are absent — those absent coders show up as coverage_gap units
    # elsewhere (their own isolated segments become single-coder units).
    if len(assignments) < 2:
        return "coverage_gap"

    # Check for split/merge: any one coder has multiple segments in this unit
    codings_per_coder = {}
    for c in unit.codings:
        codings_per_coder.setdefault(c.coder_id, []).append(c)
    has_split_merge = any(len(segs) > 1 for segs in codings_per_coder.values())
    if has_split_merge:
        return "split_merge"

    # All coders have exactly one segment — check boundary disagreement
    # (low Jaccard between any two coders' spans)
    any_boundary_issue = False
    for i, a in enumerate(assignments):
        for b in assignments[i + 1:]:
            j = _jaccard(a.start_index, a.end_index, b.start_index, b.end_index)
            if j < jaccard_threshold:
                any_boundary_issue = True
                break

    # Check code agreement
    code_ids = {a.code_id for a in assignments}
    all_agree = len(code_ids) == 1

    if all_agree and not any_boundary_issue:
        return "agreement"
    if all_agree and any_boundary_issue:
        return "boundary"
    if not all_agree and any_boundary_issue:
        return "boundary"  # boundary is more fundamental
    return "code_mismatch"


def filter_disagreements(
    disagreements: list[Disagreement],
    disagreement_type: Optional[str] = None,
    code_id: Optional[str] = None,
    document_id: Optional[str] = None,
) -> list[Disagreement]:
    out = disagreements
    if disagreement_type:
        out = [d for d in out if d.disagreement_type == disagreement_type]
    if code_id:
        out = [
            d for d in out
            if any(a.code_id == code_id for a in d.assignments)
        ]
    if document_id:
        out = [d for d in out if d.document_id == document_id]
    return out
