"""Code centroid computation with cold-start fallback.

Code centroid = L2-normalised mean of all its segment embeddings.
Acts as a reference point for measuring how well a new segment fits an
existing code. 
Higher cosine similarity → the new segment is more typical of the code's existing usage.

"""
from __future__ import annotations
import math

from infrastructure.vector_store.store import get_collection
from infrastructure.vector_store.embeddings import embed_text
from infrastructure.vector_store.mmr import cosine_similarity  # single source of truth

__all__ = ["cosine_similarity", "_compute_centroid", "get_code_centroid"]


def _compute_centroid(embeddings: list[list[float]]) -> list[float]:
    """L2-normalised mean of a list of embedding vectors.

    We normalise the result so it stays on the unit hypersphere, which makes
    cosine similarity comparisons well-behaved regardless of embedding scale.

    Args:
        embeddings: List of equal-length float vectors. Must be non-empty.

    Returns:
        A single normalised float vector. Returns an empty list if `embeddings`
        is None or empty.
    """
    if embeddings is None or len(embeddings) == 0:
        return []
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    for emb in embeddings:
        for i in range(dim):
            centroid[i] += emb[i]
    n = len(embeddings)
    # Divide by count to get the mean
    for i in range(dim):
        centroid[i] /= n
    # L2 normalise so the result stays on the unit sphere
    norm = math.sqrt(sum(x * x for x in centroid))
    if norm > 0:
        centroid = [x / norm for x in centroid]
    return centroid


def get_code_centroid(user_id: str, code_label: str) -> list[float] | None:
    """Compute the centroid for a code from its stored segment embeddings.

    Pulls all embeddings for the given code label from ChromaDB and averages
    them. Returns None if there are no segments yet (caller decides what to
    do with the cold-start case).

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        code_label: The code whose segments to average.

    Returns:
        Normalised centroid vector, or None if no segments exist.
    """
    collection = get_collection(user_id)
    results = collection.get(where={"code": code_label}, include=["embeddings"])
    embeddings = results.get("embeddings")
    if embeddings is None or len(embeddings) == 0:
        return None
    return _compute_centroid(embeddings)


def get_definition_pseudo_centroid(definition_text: str) -> list[float]:
    """Embed a code definition text to use as a cold-start centroid.

    When a code has no segments yet, we can still compute a proxy centroid
    by embedding the researcher's written definition. This is flagged as
    a "pseudo" centroid downstream.

    Args:
        definition_text: The human-written definition of the code.

    Returns:
        Embedding vector for the definition text.
    """
    return embed_text(definition_text)


def get_code_centroid_with_fallback(
    user_id: str,
    code_label: str,
    code_definition: str | None = None,
    min_segments: int = 3,
) -> tuple[list[float] | None, bool]:
    """Get a centroid for a code, falling back to the definition if needed.

    Tries to compute a centroid from actual segment embeddings first. If
    there aren't enough, falls back to the definition pseudo-centroid if one
    is available. Returns (None, False) if neither is possible.

    The `min_segments` param is currently unused — we include any non-zero
    number of real embeddings rather than waiting for a minimum. Kept as a
    parameter for future tuning without changing the call signature.

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        code_label: The code to compute a centroid for.
        code_definition: Optional definition text for the cold-start fallback.
        min_segments: Reserved for future use (not currently enforced).

    Returns:
        Tuple of (centroid_vector, is_pseudo). is_pseudo is True when the
        centroid came from the definition rather than segment embeddings.
    """
    collection = get_collection(user_id)
    results = collection.get(where={"code": code_label}, include=["embeddings"])
    embeddings = results.get("embeddings")
    if embeddings is not None and len(embeddings) >= 1:
        # Real centroid — enough data to use segment embeddings
        return _compute_centroid(embeddings), False
    elif code_definition:
        # Cold-start fallback — embed the definition text instead
        return get_definition_pseudo_centroid(code_definition), True
    else:
        # No segments and no definition — can't compute anything useful
        return None, False


def segment_to_centroid_similarity(
    user_id: str,
    segment_text: str,
    code_label: str,
    code_definition: str | None = None,
) -> tuple[float | None, bool]:
    """Compute how similar a segment is to its code's centroid.

    This is the key signal for Stage 1 scoring. A low similarity means the
    new segment is an outlier compared to existing usage of this code.

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        segment_text: The text of the segment being evaluated.
        code_label: The code the segment is being assigned to.
        code_definition: Used for the cold-start pseudo-centroid fallback.

    Returns:
        Tuple of (similarity_score, is_pseudo_centroid). similarity_score is
        None if no centroid could be computed at all.
    """
    centroid, is_pseudo = get_code_centroid_with_fallback(
        user_id, code_label, code_definition
    )
    if centroid is None:
        return None, False
    seg_emb = embed_text(segment_text)
    return cosine_similarity(seg_emb, centroid), is_pseudo
