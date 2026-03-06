"""Stage 1 scoring pipeline: compute all deterministic scores for a segment."""
from __future__ import annotations

from infrastructure.vector_store.store import get_collection
from features.scoring.centroid import segment_to_centroid_similarity
from features.scoring.temporal_drift import compute_temporal_drift


def compute_stage1_scores(
    user_id: str,
    segment_text: str,
    code_label: str,
    all_code_labels: list[str],
    code_definition: str | None = None,
) -> dict:
    """
    Compute all Stage 1 deterministic scores for a single segment.

    Returns dict with:
        centroid_similarity, is_pseudo_centroid, temporal_drift, segment_count
    """
    centroid_sim, is_pseudo = segment_to_centroid_similarity(
        user_id, segment_text, code_label, code_definition
    )

    drift = compute_temporal_drift(user_id, code_label)

    collection = get_collection(user_id)
    code_results = collection.get(where={"code": code_label}, include=[])
    seg_count = len(code_results.get("ids", []))

    return {
        "centroid_similarity": centroid_sim,
        "is_pseudo_centroid": is_pseudo,
        "temporal_drift": drift,
        "segment_count": seg_count,
    }
