"""Temporal drift detection (LOGOS-inspired)."""
from __future__ import annotations

from infrastructure.vector_store.store import get_collection
from features.scoring.centroid import _compute_centroid, cosine_similarity


def compute_temporal_drift(
    user_id: str,
    code_label: str,
    window_recent: int = 5,
    window_old: int = 5,
) -> float | None:
    """
    Cosine distance between oldest-N and newest-N segment centroids for a code.
    Returns None if insufficient segments.
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings", "metadatas"],
    )
    embeddings = results.get("embeddings", [])
    metadatas = results.get("metadatas", [])

    if not embeddings or len(embeddings) < (window_recent + window_old):
        return None

    paired = sorted(zip(embeddings, metadatas), key=lambda x: x[1].get("created_at", ""))
    old_centroid = _compute_centroid([p[0] for p in paired[:window_old]])
    recent_centroid = _compute_centroid([p[0] for p in paired[-window_recent:]])
    return 1.0 - cosine_similarity(old_centroid, recent_centroid)
