from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass
class Coding:
    coder_id: str
    segment_id: str
    code_id: str
    code_label: str
    start_index: int
    end_index: int


@dataclass
class AlignmentUnit:
    unit_id: str
    span_start: int
    span_end: int
    document_id: str
    project_id: str
    codings: list[Coding] = field(default_factory=list)

    @property
    def coder_ids(self) -> set[str]:
        return {c.coder_id for c in self.codings}

    @property
    def is_agreement(self) -> bool:
        codes = {c.code_id for c in self.codings}

        return len(codes) == 1 and len(self.codings) > 0

    def code_for_coder(self, coder_id: str) -> str | None:
        for c in self.codings:
            if c.coder_id == coder_id:
                return c.code_id
        return None

    def primary_coding_for_coder(self, coder_id: str) -> Coding | None:
        candidates = [c for c in self.codings if c.coder_id == coder_id]
        if not candidates:
            return None
        if len(candidates) == 1:
            return candidates[0]
        return max(candidates, key=lambda c: _jaccard(
            c.start_index, c.end_index, self.span_start, self.span_end
        ))


def _jaccard(a_start: int, a_end: int, b_start: int, b_end: int) -> float:
    intersection = max(0, min(a_end, b_end) - max(a_start, b_start))
    if intersection == 0:
        return 0.0
    union = (a_end - a_start) + (b_end - b_start) - intersection
    return intersection / union if union > 0 else 0.0


def _has_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return max(a_start, b_start) < min(a_end, b_end)


def compute_alignment_units(
    segments: list[tuple],
    coder_ids: list[str],
    project_id: str,
    document_id: str,
) -> list[AlignmentUnit]:

    codings: list[Coding] = []
    for seg, code in segments:
        if seg.user_id in coder_ids:
            codings.append(Coding(
                coder_id=seg.user_id,
                segment_id=seg.id,
                code_id=seg.code_id,
                code_label=code.label if code else "?",
                start_index=seg.start_index,
                end_index=seg.end_index,
            ))

    if not codings:
        return []

    n = len(codings)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        parent[find(x)] = find(y)

    for i in range(n):
        for j in range(i + 1, n):
            ci, cj = codings[i], codings[j]
            if ci.coder_id == cj.coder_id:
                continue
            if _has_overlap(ci.start_index, ci.end_index, cj.start_index, cj.end_index):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        root = find(i)
        groups.setdefault(root, []).append(i)

    units: list[AlignmentUnit] = []
    for group_indices in groups.values():
        group_codings = [codings[i] for i in group_indices]
        span_start = min(c.start_index for c in group_codings)
        span_end = max(c.end_index for c in group_codings)

        uid = hashlib.sha256(
            f"{project_id}:{document_id}:{span_start}:{span_end}".encode()
        ).hexdigest()[:16]

        units.append(AlignmentUnit(
            unit_id=uid,
            span_start=span_start,
            span_end=span_end,
            document_id=document_id,
            project_id=project_id,
            codings=group_codings,
        ))

    return sorted(units, key=lambda u: u.span_start)
