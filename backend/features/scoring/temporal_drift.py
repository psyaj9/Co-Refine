"""Temporal drift detection, inspired by the LOGOS framework.

"Temporal drift" measures whether a code's meaning has shifted over the
course of a research session. We detect it by comparing the centroid of the
researcher's oldest segments for a code against the centroid of their most
recent ones. A large cosine distance (high drift) means early and late
usages are semantically dissimilar — the code's meaning has wandered.

This can happen for legitimate reasons (a code genuinely evolved) or
problematic ones (the researcher unconsciously started applying it differently).
Either way, it's worth flagging so the researcher can make a conscious choice.

The window size (default 5+5) is a pragmatic balance — small enough to be
sensitive to recent shifts, large enough to avoid noise from single outliers.
A drift score of None means there weren't enough segments to make the
comparison meaningful.
"""
from __future__ import annotations

from infrastructure.vector_store.store import get_collection
from features.scoring.centroid import _compute_centroid, cosine_similarity


def compute_temporal_drift(
    user_id: str,
    code_label: str,
    window_recent: int = 5,
    window_old: int = 5,
) -> float | None:
    """Compute cosine distance between the oldest and newest segment centroids.

    Sorts all segments for the code by their `created_at` metadata timestamp,
    then computes a centroid for the oldest `window_old` segments and another
    for the most recent `window_recent` segments. The drift score is
    1 - cosine_similarity, so 0.0 means no drift and 1.0 means maximum drift.

    Returns None if there aren't enough total segments to fill both windows
    — you need at least (window_recent + window_old) segments for a meaningful
    comparison, otherwise the two windows would overlap.

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        code_label: The code to measure drift for.
        window_recent: How many of the most recent segments to use.
        window_old: How many of the oldest segments to use.

    Returns:
        A float in [0, 1] where higher = more drift, or None if insufficient
        data to compute.
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings", "metadatas"],
    )
    embeddings = results.get("embeddings")
    if embeddings is None:
        embeddings = []
    metadatas = results.get("metadatas") or []

    # Bail out early if we don't have enough segments to fill both windows
    if len(embeddings) == 0 or len(embeddings) < (window_recent + window_old):
        return None

    # Sort by created_at so oldest are first, most recent are last.
    # Missing created_at sorts to the front (empty string < any real timestamp).
    paired = sorted(zip(embeddings, metadatas), key=lambda x: x[1].get("created_at") or "")
    old_centroid = _compute_centroid([p[0] for p in paired[:window_old]])
    recent_centroid = _compute_centroid([p[0] for p in paired[-window_recent:]])

    # Convert similarity to distance — high distance = high drift
    return 1.0 - cosine_similarity(old_centroid, recent_centroid)
