"""Code centroid computation with cold-start fallback.

Literature: Thematic-LM approach — code centroid = mean embedding.
"""
from __future__ import annotations
import math

from infrastructure.vector_store.store import get_collection
from infrastructure.vector_store.embeddings import embed_text


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity in [-1, 1]."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


def _compute_centroid(embeddings: list[list[float]]) -> list[float]:
    """L2-normalised mean of embedding vectors."""
    if not embeddings:
        return []
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    for emb in embeddings:
        for i in range(dim):
            centroid[i] += emb[i]
    n = len(embeddings)
    for i in range(dim):
        centroid[i] /= n
    norm = math.sqrt(sum(x * x for x in centroid))
    if norm > 0:
        centroid = [x / norm for x in centroid]
    return centroid


def get_code_centroid(user_id: str, code_label: str) -> list[float] | None:
    collection = get_collection(user_id)
    results = collection.get(where={"code": code_label}, include=["embeddings"])
    embeddings = results.get("embeddings")
    if not embeddings:
        return None
    return _compute_centroid(embeddings)


def get_definition_pseudo_centroid(definition_text: str) -> list[float]:
    return embed_text(definition_text)


def get_code_centroid_with_fallback(
    user_id: str,
    code_label: str,
    code_definition: str | None = None,
    min_segments: int = 3,
) -> tuple[list[float] | None, bool]:
    """Returns (centroid, is_pseudo)."""
    collection = get_collection(user_id)
    results = collection.get(where={"code": code_label}, include=["embeddings"])
    embeddings = results.get("embeddings")
    if embeddings and len(embeddings) >= 1:
        return _compute_centroid(embeddings), False
    elif code_definition:
        return get_definition_pseudo_centroid(code_definition), True
    else:
        return None, False


def segment_to_centroid_similarity(
    user_id: str,
    segment_text: str,
    code_label: str,
    code_definition: str | None = None,
) -> tuple[float | None, bool]:
    """Returns (similarity, is_pseudo_centroid)."""
    centroid, is_pseudo = get_code_centroid_with_fallback(
        user_id, code_label, code_definition
    )
    if centroid is None:
        return None, False
    seg_emb = embed_text(segment_text)
    return cosine_similarity(seg_emb, centroid), is_pseudo
