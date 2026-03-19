"""ChromaDB collection CRUD: add, query, delete embeddings.

All collection access is namespaced per-user: ``segments_{user_id}``.

The ChromaDB client is a module-level singleton (one persistent client per
process) because creating a new PersistentClient on every request is slow and
can cause file-lock conflicts on the underlying SQLite store.

Public API:
    get_collection()             — raw collection handle (used by mmr.py)
    add_segment_embedding()      — upsert a segment after it's coded
    find_similar_segments()      — cosine nearest-neighbour search
    delete_segment_embedding()   — clean up when a segment is removed
    get_all_segments_for_code()  — fetch the full set for a code (audit use)
    get_segment_count()          — total embeddings for a user
"""

from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings

from core.config import settings
from core.logging import get_logger
from infrastructure.vector_store.embeddings import embed_text

logger = get_logger(__name__)

# One ChromaDB client per process — persistent so data survives restarts.
_chroma_client: chromadb.ClientAPI | None = None


def _get_chroma() -> chromadb.ClientAPI:
    """Return the module-level ChromaDB client, creating it on first call.

    Returns:
        A PersistentClient pointed at the configured chroma directory.
    """
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            # Opt out of ChromaDB's anonymous telemetry — no need to phone home
            # in a research/dissertation context.
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection(user_id: str) -> chromadb.Collection:
    """Return (or create) the per-user segment collection.

    Collections are namespaced by user_id so different projects/users can't
    accidentally read each other's embeddings.

    Args:
        user_id: Identifier used to namespace the ChromaDB collection.

    Returns:
        ChromaDB Collection configured for cosine distance.
    """
    return _get_chroma().get_or_create_collection(
        name=f"segments_{user_id}",
        # Cosine distance matches the similarity metric used throughout the
        # audit pipeline — keeps the distance values interpretable (0 = identical,
        # 2 = opposite).
        metadata={"hnsw:space": "cosine"},
    )


def add_segment_embedding(
    user_id: str,
    segment_id: str,
    text: str,
    code_label: str,
    document_id: str,
    created_at: str | None = None,
) -> None:
    """Upsert a segment's embedding into the user collection.

    Uses upsert rather than add so that re-coding a segment (changing its
    code label) updates the existing record instead of creating a duplicate.

    Args:
        user_id:     Collection namespace.
        segment_id:  UUID of the coded segment (used as the ChromaDB document ID).
        text:        Full segment text — embedded and stored as the document.
        code_label:  The code applied to this segment (stored in metadata for
                     filtering during similarity search).
        document_id: UUID of the source document (stored in metadata).
        created_at:  ISO timestamp string. Defaults to now (UTC) if not provided.
    """
    collection = get_collection(user_id)
    embedding = embed_text(text)
    collection.upsert(
        ids=[segment_id],
        embeddings=[embedding],
        metadatas=[{
            "code": code_label,
            "document_id": document_id,
            # Keep a short preview in metadata for quick display without
            # needing to look up the full text in the relational DB.
            "text_preview": text[:300],
            "created_at": created_at or datetime.now(timezone.utc).isoformat(),
        }],
        documents=[text],
    )


def find_similar_segments(
    user_id: str,
    query_text: str,
    top_k: int = 0,
    code_filter: str | None = None,
) -> list[dict]:
    """Cosine nearest-neighbour search within a user's collection.

    Args:
        user_id:     Collection namespace.
        query_text:  Text to embed and search against.
        top_k:       Number of results to return. Defaults to the configured
                     ``vector_search_top_k`` setting if 0 or negative.
        code_filter: If set, only returns segments tagged with this code label.

    Returns:
        List of dicts with keys: id, text, code, document_id, distance.
        Ordered by ascending cosine distance (most similar first).
    """
    if top_k <= 0:
        top_k = settings.vector_search_top_k
    collection = get_collection(user_id)
    if collection.count() == 0:
        return []

    query_embedding = embed_text(query_text)
    # ChromaDB requires the where clause to be omitted entirely (not set to None)
    # when there's no filter — passing None causes a validation error.
    where = {"code": code_filter} if code_filter else None

    results = collection.query(
        query_embeddings=[query_embedding],
        # Cap n_results at collection size — ChromaDB errors if you ask for
        # more results than exist.
        n_results=min(top_k, collection.count()),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    items: list[dict] = []
    for i, seg_id in enumerate(results["ids"][0]):
        items.append({
            "id": seg_id,
            "text": results["documents"][0][i],
            "code": results["metadatas"][0][i].get("code", ""),
            "document_id": results["metadatas"][0][i].get("document_id", ""),
            "distance": results["distances"][0][i],
        })
    return items


def delete_segment_embedding(user_id: str, segment_id: str) -> None:
    """Remove a single segment embedding.

    Silently no-ops if the segment isn't in the collection — deletion is
    best-effort; the relational DB is the source of truth.

    Args:
        user_id:    Collection namespace.
        segment_id: UUID of the segment to remove.
    """
    try:
        get_collection(user_id).delete(ids=[segment_id])
    except Exception as e:
        # Log and swallow — a missing embedding shouldn't block a segment delete.
        logger.warning("Failed to delete segment embedding", extra={"segment_id": segment_id, "error": str(e)})


def get_all_segments_for_code(
    user_id: str,
    code_label: str,
    exclude_id: str | None = None,
) -> list[dict]:
    """Fetch ALL segments for a code, sorted by created_at. No MMR sampling.

    Used by the audit pipeline when it needs the complete set of examples for
    a code (e.g. to compute centroid distance or check consistency). MMR is
    not appropriate here because we want the full picture, not a diverse sample.

    Args:
        user_id:    Collection namespace.
        code_label: Only segments tagged with this code are returned.
        exclude_id: Segment ID to omit from results — typically the segment
                    currently being audited so it doesn't compare to itself.

    Returns:
        List of dicts with keys: id, text, code, document_id, created_at.
        Sorted chronologically (oldest first).
    """
    collection = get_collection(user_id)
    if collection.count() == 0:
        return []
    results = collection.get(
        where={"code": code_label},
        include=["documents", "metadatas"],
    )
    items = []
    for i, seg_id in enumerate(results.get("ids", [])):
        if exclude_id and seg_id == exclude_id:
            continue
        meta = results["metadatas"][i] if results.get("metadatas") else {}
        items.append({
            "id": seg_id,
            "text": results["documents"][i] if results.get("documents") else "",
            "code": code_label,
            "document_id": meta.get("document_id", ""),
            "created_at": meta.get("created_at", ""),
        })
    # Sort chronologically so callers processing temporal patterns get a
    # consistent ordering without needing to sort themselves.
    items.sort(key=lambda x: x["created_at"])
    return items


def get_segment_count(user_id: str) -> int:
    """Return the total number of embedded segments for a user.

    Used by auto_analyzer to decide when to trigger the analysis pipeline
    (e.g. every N new segments).

    Args:
        user_id: Collection namespace.

    Returns:
        Total count, or 0 if the collection doesn't exist or the query fails.
    """
    try:
        return get_collection(user_id).count()
    except Exception as e:
        # Don't crash if ChromaDB is temporarily unavailable — just return 0
        # so the threshold check in auto_analyzer doesn't fire spuriously.
        logger.warning("Failed to count segment embeddings", extra={"user_id": user_id, "error": str(e)})
        return 0
