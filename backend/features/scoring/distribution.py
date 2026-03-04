"""Codebook probability distribution scoring.

Literature: ITA-GPT approach — softmax over centroid similarities → probability
distribution, entropy, and conflict score.
"""
from __future__ import annotations
import math

from infrastructure.vector_store.embeddings import embed_text
from features.scoring.centroid import get_code_centroid, cosine_similarity


def compute_codebook_distribution(
    user_id: str,
    segment_text: str,
    code_labels: list[str],
) -> dict[str, float]:
    seg_emb = embed_text(segment_text)
    scores: dict[str, float] = {}
    for label in code_labels:
        centroid = get_code_centroid(user_id, label)
        scores[label] = cosine_similarity(seg_emb, centroid) if centroid else 0.0
    return scores


def softmax_scores(
    raw_scores: dict[str, float],
    temperature: float = 1.0,
) -> dict[str, float]:
    if not raw_scores:
        return {}
    labels = list(raw_scores.keys())
    vals = [raw_scores[l] / temperature for l in labels]
    max_val = max(vals)
    exp_vals = [math.exp(v - max_val) for v in vals]
    total = sum(exp_vals)
    if total == 0:
        n = len(labels)
        return {label: 1.0 / n for label in labels}
    return {label: ev / total for label, ev in zip(labels, exp_vals)}


def distribution_entropy(prob_dist: dict[str, float], top_k: int = 5) -> float:
    if not prob_dist:
        return 0.0
    top_probs = sorted(prob_dist.values(), reverse=True)[:top_k]
    n = len(top_probs)
    if n <= 1:
        return 0.0
    total = sum(top_probs)
    if total == 0:
        return 0.0
    normed = [p / total for p in top_probs]
    raw_entropy = -sum(p * math.log(p) for p in normed if p > 0)
    max_entropy = math.log(n)
    return raw_entropy / max_entropy if max_entropy > 0 else 0.0


def conflict_score(prob_dist: dict[str, float], proposed_code: str) -> float:
    return 1.0 - prob_dist.get(proposed_code, 0.0)
