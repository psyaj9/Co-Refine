"""Maximal Marginal Relevance (MMR) sampling for diverse segment retrieval.

MMR balances relevance to a query against diversity among already-selected
items, avoiding redundant near-duplicate results.

Score at each step:
    λ * sim(query, candidate) − (1 − λ) * max_sim(candidate, selected)

A λ of 1.0 is pure nearest-neighbour search; 0.0 returns the most diverse
set regardless of relevance. The default of 0.5 gives equal weight to both,
which works well for surfacing varied examples of how a code has been applied.
"""

from infrastructure.vector_store.embeddings import embed_text
from infrastructure.vector_store.store import get_collection


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length embedding vectors.

    Args:
        a: First embedding vector.
        b: Second embedding vector.

    Returns:
        Similarity score in [-1, 1]. Returns 0.0 if either vector is all-zeros
        to avoid division by zero on empty/missing embeddings.
    """
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    # Guard against zero vectors — can happen if a segment had empty text.
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

    Fetches all candidate embeddings from ChromaDB (optionally filtered by
    code label), then runs the greedy MMR selection loop to pick n items that
    are both relevant to the query and spread across the embedding space.

    Args:
        user_id:     ChromaDB collection owner (namespaces the collection).
        query_text:  Text to search against — used to compute relevance scores.
        code_filter: If set, only segments tagged with this code label are
                     considered. Useful for "show me examples of code X".
        n:           Max number of segments to return.
        lambda_mmr:  Trade-off between relevance and diversity.
                     0.0 = pure diversity, 1.0 = pure relevance.

    Returns:
        List of dicts with keys: id, text, code, document_id, created_at.
        Ordered from most to least preferred by MMR scoring.
    """
    collection = get_collection(user_id)
    if collection.count() == 0:
        return []

    # Pull all embeddings up-front — MMR needs the full candidate set to
    # compute pairwise similarities, so we can't just use ChromaDB's ANN search.
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

    # Embed the query once and compute relevance to all candidates upfront
    # rather than recomputing inside the loop.
    query_embedding = embed_text(query_text)
    relevance = [cosine_similarity(query_embedding, emb) for emb in embeddings]

    # Cap n at the total number of candidates so we don't loop forever.
    n = min(n, len(ids))
    selected_indices: list[int] = []
    selected_embeddings: list[list[float]] = []

    # Greedy selection: at each step pick the unselected candidate that
    # maximises the MMR objective.
    for _ in range(n):
        best_idx = -1
        best_score = float("-inf")

        for i, emb in enumerate(embeddings):
            if i in selected_indices:
                continue
            # max_sim is 0 for the first selection (no items chosen yet), so the
            # first pick is purely the most relevant candidate.
            max_sim = (
                max(cosine_similarity(emb, sel) for sel in selected_embeddings)
                if selected_embeddings
                else 0.0
            )
            mmr_score = lambda_mmr * relevance[i] - (1 - lambda_mmr) * max_sim
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = i

        # -1 means no valid candidate was found (shouldn't happen, but bail
        # cleanly rather than appending a garbage index).
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
