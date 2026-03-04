"""Maximal Marginal Relevance (MMR) sampling for diverse segment retrieval.

MMR balances relevance to a query against diversity among already-selected
items, avoiding redundant near-duplicate results.

Score at each step:
    λ * sim(query, candidate) − (1 − λ) * max_sim(candidate, selected)
"""

from infrastructure.vector_store.embeddings import embed_text
from infrastructure.vector_store.store import get_collection


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def find_diverse_segments(
    user_id: str,
    query_text: str,
    code_filter: str | None = None,
    n: int = 15,
    lambda_mmr: float = 0.5,
) -> list[dict]:
    """Return up to *n* maximally-diverse segments using MMR.

    Args:
        user_id:     ChromaDB collection owner.
        query_text:  Text to search against.
        code_filter: If set, only segments with this code label are candidates.
        n:           Max segments to return.
        lambda_mmr:  0.0 = pure diversity, 1.0 = pure relevance.
    """
    collection = get_collection(user_id)
    if collection.count() == 0:
        return []

    # Fetch all candidate embeddings (optionally filtered by code)
    get_kwargs: dict = {"include": ["embeddings", "documents", "metadatas"]}
    if code_filter:
        get_kwargs["where"] = {"code": code_filter}

    results = collection.get(**get_kwargs)
    ids: list[str] = results["ids"]
    if not ids:
        return []

    embeddings: list[list[float]] = results["embeddings"]
    documents: list[str] = results["documents"]
    metadatas: list[dict] = results["metadatas"]

    query_embedding = embed_text(query_text)
    relevance = [cosine_similarity(query_embedding, emb) for emb in embeddings]

    n = min(n, len(ids))
    selected_indices: list[int] = []
    selected_embeddings: list[list[float]] = []

    for _ in range(n):
        best_idx = -1
        best_score = float("-inf")

        for i, emb in enumerate(embeddings):
            if i in selected_indices:
                continue
            max_sim = (
                max(cosine_similarity(emb, sel) for sel in selected_embeddings)
                if selected_embeddings
                else 0.0
            )
            mmr_score = lambda_mmr * relevance[i] - (1 - lambda_mmr) * max_sim
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = i

        if best_idx == -1:
            break
        selected_indices.append(best_idx)
        selected_embeddings.append(embeddings[best_idx])

    return [
        {
            "id": ids[i],
            "text": documents[i],
            "code": metadatas[i].get("code", ""),
            "document_id": metadatas[i].get("document_id", ""),
            "created_at": metadatas[i].get("created_at", ""),
        }
        for i in selected_indices
    ]
