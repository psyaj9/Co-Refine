"""Code overlap matrix — pairwise centroid similarity between codes.

High cosine similarity between two code centroids (>0.85) suggests that the
codes may be covering the same concept.

The matrix is computed and sent to the frontend.
"""
from __future__ import annotations

from features.scoring.centroid import get_code_centroid, cosine_similarity


def compute_code_overlap_matrix(
    user_id: str,
    code_labels: list[str],
) -> dict[str, dict[str, float]]:
    """Compute pairwise cosine similarity between all code centroids.

    Codes that have no segments in the vector store are silently skipped
    (their centroids can't be computed). The resulting matrix only includes
    codes that have at least one embedded segment.

    The matrix is symmetric, so we only compute each pair once and mirror
    the result (matrix[a][b] = matrix[b][a]) to avoid duplicate LLM calls.
    The diagonal is always 1.0.

    Args:
        user_id: Used to look up the user's ChromaDB collection.
        code_labels: All code labels in the project to compare pairwise.

    Returns:
        Nested dict: {code_label: {other_label: similarity_score}}.
        Only contains entries for codes that have computed centroids.
        High values (>0.85) suggest potential code redundancy.
    """
    # Fetch centroids upfront — skip any codes with no segments
    centroids: dict[str, list[float]] = {}
    for label in code_labels:
        c = get_code_centroid(user_id, label)
        if c is not None:
            centroids[label] = c

    labels = list(centroids.keys())
    matrix: dict[str, dict[str, float]] = {}
    for i, a in enumerate(labels):
        matrix[a] = {}
        for j, b in enumerate(labels):
            if i == j:
                # A code is always identical to itself
                matrix[a][b] = 1.0
            elif j < i:
                # Already computed the symmetric pair — just mirror it
                matrix[a][b] = matrix[b][a]
            else:
                matrix[a][b] = cosine_similarity(centroids[a], centroids[b])
    return matrix
