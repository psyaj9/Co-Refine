"""
ICR Statistical Metrics.

Implements five inter-coder reliability measures:

1. Percent Agreement (P₀) — simplest; ignores chance agreement.
2. Cohen's Kappa (κ) — pairwise (exactly 2 coders), corrects for chance.
3. Fleiss' Kappa (κ_F) — generalised to N coders, all units must be rated.
4. Krippendorff's Alpha (α) — most general: handles missing data, N coders.
5. Gwet's AC1 — paradox-resistant kappa; more stable when categories skewed.

References:
  Krippendorff (2011). Computing Krippendorff's alpha-reliability.
  Fleiss (1971). Measuring nominal scale agreement among many raters.
  Cohen (1960). A coefficient of agreement for nominal scales.
  Gwet (2008). Computing inter-rater reliability and its variance.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from features.icr.alignment import AlignmentUnit


@dataclass
class MetricResult:
    score: Optional[float]
    interpretation: str
    n_units: int           # total alignment units considered
    n_rated_pairs: int     # units where ≥2 coders participated


def _interpret_kappa(score: Optional[float]) -> str:
    if score is None:
        return "insufficient data"
    if score < 0:
        return "worse than chance"
    if score < 0.20:
        return "slight agreement"
    if score < 0.40:
        return "fair agreement"
    if score < 0.60:
        return "moderate agreement"
    if score < 0.80:
        return "substantial agreement"
    return "near-perfect agreement"


def _interpret_alpha(score: Optional[float]) -> str:
    if score is None:
        return "insufficient data"
    if score >= 0.800:
        return "reliable"
    if score >= 0.667:
        return "tentative (acceptable for exploratory work)"
    return "unreliable (below threshold)"


# ── Rating matrix builder ──────────────────────────────────────────────────────

def build_rating_matrix(
    units: list[AlignmentUnit],
    coder_ids: list[str],
) -> dict[str, dict[str, Optional[str]]]:
    """
    Build a unit × coder matrix of code assignments.

    Returns:
        {unit_id: {coder_id: code_id | None}}
        None means the coder did not rate that unit.
    """
    matrix: dict[str, dict[str, Optional[str]]] = {}
    for unit in units:
        row: dict[str, Optional[str]] = {cid: None for cid in coder_ids}
        for coder_id in coder_ids:
            primary = unit.primary_coding_for_coder(coder_id)
            if primary:
                row[coder_id] = primary.code_id
        matrix[unit.unit_id] = row
    return matrix


# ── Percent Agreement ─────────────────────────────────────────────────────────

def percent_agreement(
    units: list[AlignmentUnit],
    coder_ids: list[str],
) -> MetricResult:
    """
    Proportion of units where ALL coders who participated agreed.
    Only counts units where ≥2 coders participated.
    """
    rated = [u for u in units if len(u.coder_ids & set(coder_ids)) >= 2]
    if not rated:
        return MetricResult(score=None, interpretation="insufficient data", n_units=len(units), n_rated_pairs=0)

    agreed = sum(1 for u in rated if u.is_agreement)
    score = agreed / len(rated)
    pct = round(score * 100, 1)
    return MetricResult(
        score=round(score, 4),
        interpretation=f"{pct}% of co-coded passages agree",
        n_units=len(units),
        n_rated_pairs=len(rated),
    )


# ── Cohen's Kappa (2 coders only) ────────────────────────────────────────────

def cohens_kappa(
    units: list[AlignmentUnit],
    coder_a: str,
    coder_b: str,
) -> MetricResult:
    """
    Cohen's κ for exactly two coders.
    Units not coded by both raters are excluded.
    """
    # Collect pairwise ratings
    ratings_a: list[str] = []
    ratings_b: list[str] = []
    for unit in units:
        ca = unit.primary_coding_for_coder(coder_a)
        cb = unit.primary_coding_for_coder(coder_b)
        if ca and cb:
            ratings_a.append(ca.code_id)
            ratings_b.append(cb.code_id)

    n = len(ratings_a)
    total_units = len(units)
    if n < 2:
        return MetricResult(score=None, interpretation="insufficient data", n_units=total_units, n_rated_pairs=n)

    categories = list(set(ratings_a) | set(ratings_b))

    # Observed agreement
    p_o = sum(1 for a, b in zip(ratings_a, ratings_b) if a == b) / n

    # Expected agreement
    p_e = sum(
        (ratings_a.count(k) / n) * (ratings_b.count(k) / n)
        for k in categories
    )

    if abs(1 - p_e) < 1e-10:
        score = 1.0
    else:
        score = (p_o - p_e) / (1 - p_e)

    return MetricResult(
        score=round(score, 4),
        interpretation=_interpret_kappa(score),
        n_units=total_units,
        n_rated_pairs=n,
    )


# ── Fleiss' Kappa (N coders) ─────────────────────────────────────────────────

def fleiss_kappa(
    units: list[AlignmentUnit],
    coder_ids: list[str],
) -> MetricResult:
    """
    Fleiss' κ for N raters.
    Only includes units where ALL specified coders participated.
    """
    coder_set = set(coder_ids)
    N = len(coder_ids)
    if N < 2:
        return MetricResult(score=None, interpretation="insufficient data", n_units=len(units), n_rated_pairs=0)

    # Units where all coders participated
    complete = [u for u in units if coder_set <= u.coder_ids]
    n = len(complete)
    if n == 0:
        return MetricResult(score=None, interpretation="insufficient data", n_units=len(units), n_rated_pairs=0)

    # Collect all categories
    categories: set[str] = set()
    for unit in complete:
        for coder_id in coder_ids:
            pc = unit.primary_coding_for_coder(coder_id)
            if pc:
                categories.add(pc.code_id)
    categories_list = sorted(categories)
    k = len(categories_list)
    if k < 2:
        return MetricResult(score=1.0, interpretation="perfect agreement (single category)", n_units=len(units), n_rated_pairs=n)

    # n_ij[i][j] = number of raters who assigned category j to unit i
    n_ij: list[dict[str, int]] = []
    for unit in complete:
        row: dict[str, int] = defaultdict(int)
        for coder_id in coder_ids:
            pc = unit.primary_coding_for_coder(coder_id)
            if pc:
                row[pc.code_id] += 1
        n_ij.append(row)

    # P_i (proportion of agreement pairs for unit i)
    P_i = [
        sum(row[cat] * (row[cat] - 1) for cat in categories_list) / (N * (N - 1))
        for row in n_ij
    ]
    P_bar = sum(P_i) / n

    # p_j (proportion of all assignments to category j)
    p_j = {
        cat: sum(row[cat] for row in n_ij) / (n * N)
        for cat in categories_list
    }
    P_e = sum(v ** 2 for v in p_j.values())

    if abs(1 - P_e) < 1e-10:
        score = 1.0
    else:
        score = (P_bar - P_e) / (1 - P_e)

    return MetricResult(
        score=round(score, 4),
        interpretation=_interpret_kappa(score),
        n_units=len(units),
        n_rated_pairs=n,
    )


# ── Krippendorff's Alpha (nominal) ───────────────────────────────────────────

def krippendorffs_alpha(
    units: list[AlignmentUnit],
    coder_ids: list[str],
) -> MetricResult:
    """
    Krippendorff's α for nominal data.
    Handles missing data: includes any unit where ≥2 coders participated.
    Uses the coincidence matrix method (Krippendorff 2011).
    """
    # Build coincidence matrix c[k][l] weighted by 1/(m_u - 1) per unit
    c: dict[tuple[str, str], float] = defaultdict(float)
    total_units = len(units)
    rated_pairs = 0

    for unit in units:
        active = [
            unit.primary_coding_for_coder(cid)
            for cid in coder_ids
            if unit.primary_coding_for_coder(cid) is not None
        ]
        m_u = len(active)
        if m_u < 2:
            continue
        rated_pairs += 1
        weight = 1.0 / (m_u - 1)
        for i in range(m_u):
            for j in range(m_u):
                if i != j:
                    c[(active[i].code_id, active[j].code_id)] += weight

    if rated_pairs < 2:
        return MetricResult(score=None, interpretation="insufficient data", n_units=total_units, n_rated_pairs=rated_pairs)

    # Marginal sums n_k
    categories: set[str] = {cat for pair in c for cat in pair}
    n_k = {cat: sum(c[(cat, l)] for l in categories) for cat in categories}
    n_total = sum(n_k.values())

    if n_total < 2:
        return MetricResult(score=None, interpretation="insufficient data", n_units=total_units, n_rated_pairs=rated_pairs)

    # Observed disagreement
    D_o = sum(v for (k, l), v in c.items() if k != l) / n_total

    # Expected disagreement
    D_e = sum(
        n_k[k] * n_k[l]
        for k in categories
        for l in categories
        if k != l
    ) / (n_total * (n_total - 1))

    if abs(D_e) < 1e-10:
        score = 1.0
    else:
        score = 1.0 - D_o / D_e

    return MetricResult(
        score=round(score, 4),
        interpretation=_interpret_alpha(score),
        n_units=total_units,
        n_rated_pairs=rated_pairs,
    )


# ── Gwet's AC1 ────────────────────────────────────────────────────────────────

def gwets_ac1(
    units: list[AlignmentUnit],
    coder_ids: list[str],
) -> MetricResult:
    """
    Gwet's AC1 — paradox-resistant inter-rater agreement.
    Only uses units where ALL coders participated.
    """
    coder_set = set(coder_ids)
    N = len(coder_ids)
    if N < 2:
        return MetricResult(score=None, interpretation="insufficient data", n_units=len(units), n_rated_pairs=0)

    complete = [u for u in units if coder_set <= u.coder_ids]
    n = len(complete)
    total_units = len(units)
    if n == 0:
        return MetricResult(score=None, interpretation="insufficient data", n_units=total_units, n_rated_pairs=0)

    # Collect categories and their proportions
    all_ratings: list[str] = []
    for unit in complete:
        for coder_id in coder_ids:
            pc = unit.primary_coding_for_coder(coder_id)
            if pc:
                all_ratings.append(pc.code_id)

    categories = set(all_ratings)
    K = len(categories)
    if K < 2:
        return MetricResult(score=1.0, interpretation="perfect agreement (single category)", n_units=total_units, n_rated_pairs=n)

    # p_k = proportion of all ratings in category k
    total_ratings = len(all_ratings)
    p_k = {cat: all_ratings.count(cat) / total_ratings for cat in categories}

    # Gwet's chance agreement: p_e_w = (1/K) * Σ_k p_k*(1-p_k)
    p_e_w = (1.0 / K) * sum(p * (1 - p) for p in p_k.values())

    # Observed agreement (same as Fleiss' P_bar construction but can differ)
    P_i = [
        sum(
            1 for ca in coder_ids for cb in coder_ids
            if ca < cb
            and unit.primary_coding_for_coder(ca)
            and unit.primary_coding_for_coder(cb)
            and unit.primary_coding_for_coder(ca).code_id == unit.primary_coding_for_coder(cb).code_id  # type: ignore[union-attr]
        ) / max(1, math.comb(N, 2))
        for unit in complete
    ]
    p_a = sum(P_i) / n

    if abs(1 - p_e_w) < 1e-10:
        score = 1.0
    else:
        score = (p_a - p_e_w) / (1 - p_e_w)

    return MetricResult(
        score=round(score, 4),
        interpretation=_interpret_kappa(score),
        n_units=total_units,
        n_rated_pairs=n,
    )


# ── Agreement matrix ──────────────────────────────────────────────────────────

def build_agreement_matrix(
    units: list[AlignmentUnit],
    coder_ids: list[str],
    code_labels: dict[str, str],   # code_id → label
) -> dict[str, dict[str, int]]:
    """
    Build a confusion matrix: for each pair of codes (A, B), count how many
    units had Coder X assign A and Coder Y assign B (across all coder pairs).
    """
    matrix: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    coders = list(coder_ids)
    for unit in units:
        for i, coder_i in enumerate(coders):
            for coder_j in coders[i + 1:]:
                ci = unit.primary_coding_for_coder(coder_i)
                cj = unit.primary_coding_for_coder(coder_j)
                if ci and cj and ci.code_id != cj.code_id:
                    label_i = code_labels.get(ci.code_id, ci.code_id)
                    label_j = code_labels.get(cj.code_id, cj.code_id)
                    matrix[label_i][label_j] += 1
                    matrix[label_j][label_i] += 1
    return {k: dict(v) for k, v in matrix.items()}


# ── Per-code breakdown ────────────────────────────────────────────────────────

def per_code_alpha(
    units: list[AlignmentUnit],
    coder_ids: list[str],
    all_code_ids: list[str],
) -> list[dict]:
    """
    For each code, compute Krippendorff's α treating the task as binary:
    "did the coder assign this code to this unit or not?"
    """
    results = []
    for code_id in all_code_ids:
        binary_units = []
        for unit in units:
            binary_codings = []
            for c in unit.codings:
                if c.coder_id in coder_ids:
                    # Use the primary coding for this coder in this unit
                    primary = unit.primary_coding_for_coder(c.coder_id)
                    if primary:
                        binary_codings.append((c.coder_id, "yes" if primary.code_id == code_id else "no"))

            if len({cid for cid, _ in binary_codings}) < 2:
                continue  # skip single-coder units

            # Build a minimal unit-like structure for alpha computation
            class _BinaryUnit:
                def __init__(self, codings_list: list[tuple[str, str]]) -> None:
                    self._map = dict(codings_list)
                    self.coder_ids: set[str] = set(self._map.keys())

                def primary_coding_for_coder(self, cid: str):  # type: ignore[override]
                    v = self._map.get(cid)
                    if v is None:
                        return None

                    class _Rating:
                        def __init__(self, code_id: str) -> None:
                            self.code_id = code_id

                    return _Rating(v)

            binary_units.append(_BinaryUnit(binary_codings))

        if not binary_units:
            results.append({"code_id": code_id, "alpha": None, "n_units": 0})
            continue

        result = krippendorffs_alpha(binary_units, coder_ids)  # type: ignore[arg-type]
        results.append({
            "code_id": code_id,
            "alpha": result.score,
            "n_units": result.n_rated_pairs,
        })

    return results
