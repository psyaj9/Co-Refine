"""Stage 1 scoring pipeline: compute all deterministic scores for a segment.

Stage 1 runs before the LLM audit and produces fast, interpretable signals
based on vector maths rather than LLM inference. These scores are:

  - centroid_similarity: How typical is this segment compared to existing
    usage of the same code? Low values flag outliers.
  - is_pseudo_centroid: Was the centroid computed from real segments or from
    the code definition (cold-start fallback)?
  - temporal_drift: Has the code's meaning been shifting over time?
  - segment_count: How many segments exist for this code so far?

These scores are sent to the frontend immediately as a `deterministic_scores`
WebSocket event, and are also passed as context to the Stage 2 LLM audit.
"""
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
    """Compute all Stage 1 deterministic scores for a single segment.

    Runs centroid similarity and temporal drift computations, then queries
    ChromaDB for the current segment count. Everything comes from the vector
    store — no SQL queries, no LLM calls.

    The `all_code_labels` param is accepted for interface consistency (the
    overlap matrix uses it) but not used directly in this function.

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        segment_text: The text being coded.
        code_label: The code being assigned.
        all_code_labels: All code labels in the project. Currently unused here
            but kept for forward compatibility.
        code_definition: Used as cold-start fallback for centroid computation.

    Returns:
        Dict with keys:
            - centroid_similarity (float | None)
            - is_pseudo_centroid (bool)
            - temporal_drift (float | None)
            - segment_count (int)
    """
    centroid_sim, is_pseudo = segment_to_centroid_similarity(
        user_id, segment_text, code_label, code_definition
    )

    drift = compute_temporal_drift(user_id, code_label)

    # Count how many segments exist for this code in the vector store.
    # We query with include=[] to avoid fetching embeddings we don't need.
    collection = get_collection(user_id)
    code_results = collection.get(where={"code": code_label}, include=[])
    seg_count = len(code_results.get("ids", []))

    return {
        "centroid_similarity": centroid_sim,
        "is_pseudo_centroid": is_pseudo,
        "temporal_drift": drift,
        "segment_count": seg_count,
    }
