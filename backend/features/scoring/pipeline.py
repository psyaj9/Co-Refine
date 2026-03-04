"""Stage 1 scoring pipeline: compute all deterministic scores for a segment."""
from __future__ import annotations

from infrastructure.vector_store.store import get_collection
from features.scoring.centroid import segment_to_centroid_similarity
from features.scoring.distribution import (
    compute_codebook_distribution,
    softmax_scores,
    distribution_entropy,
    conflict_score,
)
from features.scoring.temporal_drift import compute_temporal_drift


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

    Returns dict with:
        centroid_similarity, is_pseudo_centroid, codebook_prob_dist,
        entropy, conflict_score, proposed_code_prob, temporal_drift, segment_count
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
