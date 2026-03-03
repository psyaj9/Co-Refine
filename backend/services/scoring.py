"""
Deterministic scoring layer — Stage 1 of the consistency pipeline.

All functions are pure math on embeddings. No LLM calls.
Produces reproducible, evaluatable numeric scores.

Literature grounding:
  - Thematic-LM:  code centroid = mean embedding → segment_to_centroid_similarity
  - ITA-GPT:      softmax probability distribution → softmax_scores / distribution_entropy
  - GATOS:        pairwise code-code distance → compute_code_overlap_matrix
  - LOGOS:         temporal drift via rolling centroids → compute_temporal_drift
"""
from __future__ import annotations

import math
from typing import Optional

from services.vector_store import get_collection, embed_text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors. Returns [-1, 1]."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


def _compute_centroid(embeddings: list[list[float]]) -> list[float]:
    """Compute L2-normalised mean of a list of embedding vectors."""
    if embeddings is None or len(embeddings) == 0:
        return []
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    for emb in embeddings:
        for i in range(dim):
            centroid[i] += emb[i]
    n = len(embeddings)
    for i in range(dim):
        centroid[i] /= n
    # L2-normalise so cosine sim == dot product
    norm = math.sqrt(sum(x * x for x in centroid))
    if norm > 0:
        centroid = [x / norm for x in centroid]
    return centroid


# ---------------------------------------------------------------------------
# Code centroid (with cold-start fallback)
# ---------------------------------------------------------------------------

def get_code_centroid(user_id: str, code_label: str) -> list[float] | None:
    """
    Compute the mean embedding vector for all segments assigned to *code_label*.
    Returns None if the code has no segments in Chroma.

    This is the Thematic-LM approach: the centroid represents the
    "semantic centre" of a code based on observed usage patterns.
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings"],
    )
    embeddings = results.get("embeddings")
    if embeddings is None or len(embeddings) == 0:
        return None
    return _compute_centroid(embeddings)


def get_definition_pseudo_centroid(definition_text: str) -> list[float]:
    """
    Cold-start fallback: when a code has < 3 segments, embed the
    user-supplied code definition as a pseudo-centroid.

    This addresses the Grok Report 1 weakness: prevents ungrounded
    LLM scoring when centroid data is sparse.
    """
    return embed_text(definition_text)


def get_code_centroid_with_fallback(
    user_id: str,
    code_label: str,
    code_definition: str | None = None,
    min_segments: int = 3,
) -> tuple[list[float] | None, bool]:
    """
    Returns (centroid, is_pseudo).

    If the code has >= min_segments, returns the real centroid.
    If it has < min_segments but > 0, returns the real centroid with a warning.
    If it has 0 segments, falls back to pseudo-centroid from the definition.
    If no definition either, returns (None, False).
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings"],
    )
    embeddings = results.get("embeddings")

    if embeddings is not None and len(embeddings) >= min_segments:
        return _compute_centroid(embeddings), False
    elif embeddings is not None and len(embeddings) > 0:
        # Sparse but usable — return real centroid, mark as not-pseudo
        return _compute_centroid(embeddings), False
    elif code_definition:
        return get_definition_pseudo_centroid(code_definition), True
    else:
        return None, False


# ---------------------------------------------------------------------------
# Segment → Centroid similarity
# ---------------------------------------------------------------------------

def segment_to_centroid_similarity(
    user_id: str,
    segment_text: str,
    code_label: str,
    code_definition: str | None = None,
) -> tuple[float | None, bool]:
    """
    Cosine similarity between a segment's embedding and the code centroid.

    Returns:
        (similarity, is_pseudo_centroid)
        similarity is Float in [0, 1] or None if no centroid available.

    This is the PRIMARY reproducible similarity score — the anchor for:
    - LLM grounding (Stage 2 must stay within ±0.15)
    - Escalation decisions (Stage 3)
    - Evaluation benchmarking
    """
    centroid, is_pseudo = get_code_centroid_with_fallback(
        user_id, code_label, code_definition
    )
    if centroid is None:
        return None, False
    seg_emb = embed_text(segment_text)
    return cosine_similarity(seg_emb, centroid), is_pseudo


# ---------------------------------------------------------------------------
# Codebook probability distribution (ITA-GPT)
# ---------------------------------------------------------------------------

def compute_codebook_distribution(
    user_id: str,
    segment_text: str,
    code_labels: list[str],
) -> dict[str, float]:
    """
    Compute raw cosine similarity between segment_text and the centroid of
    every code in code_labels.

    Returns dict mapping code_label → raw cosine similarity.
    Codes with no segments get score 0.0.
    """
    seg_emb = embed_text(segment_text)
    scores: dict[str, float] = {}
    for label in code_labels:
        centroid = get_code_centroid(user_id, label)
        if centroid is None:
            scores[label] = 0.0
        else:
            scores[label] = cosine_similarity(seg_emb, centroid)
    return scores


def softmax_scores(
    raw_scores: dict[str, float],
    temperature: float = 1.0,
) -> dict[str, float]:
    """
    Softmax over raw cosine similarities → probability distribution.

    ITA-GPT approach: produces a probability distribution across the codebook.
    Sum of all probabilities = 1.0.

    Args:
        temperature: lower = more peaked (decisive); 1.0 = neutral

    Interpretation:
        - P(proposed_code) high → low conflict
        - P spread across codes → high conflict
        - Entropy of this distribution = standalone ambiguity metric
    """
    if not raw_scores:
        return {}
    labels = list(raw_scores.keys())
    vals = [raw_scores[l] / temperature for l in labels]
    max_val = max(vals)
    exp_vals = [math.exp(v - max_val) for v in vals]  # numerically stable
    total = sum(exp_vals)
    if total == 0:
        # Degenerate case — return uniform
        n = len(labels)
        return {label: 1.0 / n for label in labels}
    return {label: ev / total for label, ev in zip(labels, exp_vals)}


def distribution_entropy(prob_dist: dict[str, float], top_k: int = 5) -> float:
    """
    Normalised Shannon entropy of a probability distribution.

    Range [0, 1]:
        0 = perfectly certain (one code dominates)
        1 = maximally uncertain (uniform distribution)

    Only the top_k codes by probability are considered. This prevents
    entropy from trivially approaching 1.0 just because the codebook is
    large — with 10+ codes a flat softmax makes entropy meaningless.
    Restricting to the top-K competitors that genuinely compete for the
    segment gives a score that reflects real ambiguity.
    """
    if not prob_dist:
        return 0.0
    # Take top-K competitors only
    top_probs = sorted(prob_dist.values(), reverse=True)[:top_k]
    n = len(top_probs)
    if n <= 1:
        return 0.0
    # Re-normalise so they sum to 1 over this reduced set
    total = sum(top_probs)
    if total == 0:
        return 0.0
    normed = [p / total for p in top_probs]
    raw_entropy = -sum(p * math.log(p) for p in normed if p > 0)
    max_entropy = math.log(n)
    return raw_entropy / max_entropy if max_entropy > 0 else 0.0


def conflict_score(prob_dist: dict[str, float], proposed_code: str) -> float:
    """
    Scalar conflict score in [0, 1].

    Formula: 1 - P(proposed_code)

    0.0 = no conflict (proposed code dominates the distribution)
    1.0 = maximum conflict (proposed code has near-zero probability)
    """
    return 1.0 - prob_dist.get(proposed_code, 0.0)


# ---------------------------------------------------------------------------
# Temporal drift (LOGOS)
# ---------------------------------------------------------------------------

def compute_temporal_drift(
    user_id: str,
    code_label: str,
    window_recent: int = 5,
    window_old: int = 5,
) -> float | None:
    """
    LOGOS-inspired temporal drift detection.

    Computes the cosine distance between:
    - Centroid of the N most recent segments for this code
    - Centroid of the N oldest segments for this code

    Returns:
        Float in [0, 1] where:
            0.0  = no drift (old and new usage is semantically identical)
            >0.3 = meaningful drift (the researcher's interpretation is shifting)
        None if insufficient segments (need at least window_recent + window_old).
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings", "metadatas"],
    )

    embeddings = results.get("embeddings", [])
    metadatas = results.get("metadatas", [])

    if embeddings is None or len(embeddings) < (window_recent + window_old):
        return None

    # Sort by created_at
    paired = list(zip(embeddings, metadatas))
    paired.sort(key=lambda x: x[1].get("created_at", ""))

    old_embs = [p[0] for p in paired[:window_old]]
    recent_embs = [p[0] for p in paired[-window_recent:]]

    old_centroid = _compute_centroid(old_embs)
    recent_centroid = _compute_centroid(recent_embs)

    # Return cosine DISTANCE (1 - similarity)
    sim = cosine_similarity(old_centroid, recent_centroid)
    return 1.0 - sim


# ---------------------------------------------------------------------------
# Code overlap matrix (GATOS)
# ---------------------------------------------------------------------------

def compute_code_overlap_matrix(
    user_id: str,
    code_labels: list[str],
) -> dict[str, dict[str, float]]:
    """
    GATOS-inspired: pairwise cosine similarity between code centroids.

    Returns:
        Nested dict: {code_a: {code_b: similarity, ...}, ...}

    High values (>0.85) suggest codes may be semantically redundant
    and should be reviewed for potential merging.

    Only computed for codes that have segments (centroid exists).
    """
    centroids: dict[str, list[float]] = {}
    for label in code_labels:
        c = get_code_centroid(user_id, label)
        if c is not None:
            centroids[label] = c

    matrix: dict[str, dict[str, float]] = {}
    labels_with_data = list(centroids.keys())

    for i, a in enumerate(labels_with_data):
        matrix[a] = {}
        for j, b in enumerate(labels_with_data):
            if i == j:
                matrix[a][b] = 1.0
            elif j < i:
                matrix[a][b] = matrix[b][a]  # symmetric
            else:
                matrix[a][b] = cosine_similarity(centroids[a], centroids[b])

    return matrix


# ---------------------------------------------------------------------------
# All-in-one Stage 1 computation
# ---------------------------------------------------------------------------

def compute_stage1_scores(
    user_id: str,
    segment_text: str,
    code_label: str,
    all_code_labels: list[str],
    code_definition: str | None = None,
    softmax_temperature: float = 1.0,
) -> dict:
    """
    Compute all Stage 1 deterministic scores for a single segment.

    Returns a dict with:
        centroid_similarity: float | None
        is_pseudo_centroid: bool
        codebook_prob_dist: dict[str, float]
        entropy: float
        conflict_score: float
        proposed_code_prob: float
        temporal_drift: float | None
        segment_count: int  (for this code)
    """
    centroid_sim, is_pseudo = segment_to_centroid_similarity(
        user_id, segment_text, code_label, code_definition
    )

    raw_scores = compute_codebook_distribution(user_id, segment_text, all_code_labels)
    prob_dist = softmax_scores(raw_scores, temperature=softmax_temperature)
    entropy = distribution_entropy(prob_dist)
    conf_score = conflict_score(prob_dist, code_label)
    proposed_prob = prob_dist.get(code_label, 0.0)
    drift = compute_temporal_drift(user_id, code_label)

    # Segment count for this code (for cold-start awareness)
    collection = get_collection(user_id)
    code_results = collection.get(where={"code": code_label}, include=[])
    seg_count = len(code_results.get("ids", []))

    return {
        "centroid_similarity": centroid_sim,
        "is_pseudo_centroid": is_pseudo,
        "codebook_prob_dist": prob_dist,
        "entropy": entropy,
        "conflict_score": conf_score,
        "proposed_code_prob": proposed_prob,
        "temporal_drift": drift,
        "segment_count": seg_count,
    }
