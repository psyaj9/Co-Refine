"""Code overlap matrix (GATOS-inspired)."""
from __future__ import annotations

from features.scoring.centroid import get_code_centroid, cosine_similarity


def compute_code_overlap_matrix(
    user_id: str,
    code_labels: list[str],
) -> dict[str, dict[str, float]]:
    """
    Pairwise cosine similarity between code centroids.
    High values (>0.85) suggest potential code redundancy.
    """
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
                matrix[a][b] = 1.0
            elif j < i:
                matrix[a][b] = matrix[b][a]
            else:
                matrix[a][b] = cosine_similarity(centroids[a], centroids[b])
    return matrix
