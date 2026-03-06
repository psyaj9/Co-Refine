"""ChromaDB collection CRUD: add, query, delete embeddings.

All collection access is namespaced per-user: `segments_{user_id}`.
"""

from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings

from core.config import settings
from infrastructure.vector_store.embeddings import embed_text

_chroma_client: chromadb.ClientAPI | None = None


def _get_chroma() -> chromadb.ClientAPI:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection(user_id: str) -> chromadb.Collection:
    """Return (or create) the per-user segment collection."""
    return _get_chroma().get_or_create_collection(
        name=f"segments_{user_id}",
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
    """Upsert a segment's embedding into the user collection."""
    collection = get_collection(user_id)
    embedding = embed_text(text)
    collection.upsert(
        ids=[segment_id],
        embeddings=[embedding],
        metadatas=[{
            "code": code_label,
            "document_id": document_id,
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
    """Cosine-nearest-neighbour search within a user's collection."""
    if top_k <= 0:
        top_k = settings.vector_search_top_k
    collection = get_collection(user_id)
    if collection.count() == 0:
        return []

    query_embedding = embed_text(query_text)
    where = {"code": code_filter} if code_filter else None

    results = collection.query(
        query_embeddings=[query_embedding],
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
    """Remove a single segment embedding (silently no-ops if not found)."""
    try:
        get_collection(user_id).delete(ids=[segment_id])
    except Exception:
        pass


def get_all_segments_for_code(
    user_id: str,
    code_label: str,
    exclude_id: str | None = None,
) -> list[dict]:
    """Fetch ALL segments for a code, sorted by created_at. No MMR sampling."""
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
    items.sort(key=lambda x: x["created_at"])
    return items


def get_segment_count(user_id: str) -> int:
    """Return the total number of embedded segments for a user."""
    try:
        return get_collection(user_id).count()
    except Exception:
        return 0
