import threading

import chromadb
from chromadb.config import Settings

from config import settings

_chroma_client: chromadb.ClientAPI | None = None
_embed_model = None
_embed_lock = threading.Lock()


def _get_chroma() -> chromadb.ClientAPI:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def _get_collection(user_id: str) -> chromadb.Collection:
    return _get_chroma().get_or_create_collection(
        name=f"segments_{user_id}",
        metadata={"hnsw:space": "cosine"},
    )


def _embed_text(text: str) -> list[float]:
    if settings.embedding_model == "local":
        return _embed_local(text)
    return _embed_api(text)


def _embed_local(text: str) -> list[float]:
    global _embed_model
    if _embed_model is None:
        with _embed_lock:
            if _embed_model is None:
                from sentence_transformers import SentenceTransformer
                _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model.encode(text).tolist()


def _embed_api(text: str) -> list[float]:
    """API-based embeddings (fallback when embedding_model != 'local')."""
    from openai import OpenAI
    client = OpenAI(
        base_url=settings.gemini_api_base,
        api_key=settings.gemini_api_key,
    )
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


def add_segment_embedding(
    user_id: str,
    segment_id: str,
    text: str,
    code_label: str,
    document_id: str,
) -> None:
    collection = _get_collection(user_id)
    embedding = _embed_text(text)
    collection.upsert(
        ids=[segment_id],
        embeddings=[embedding],
        metadatas=[{
            "code": code_label,
            "document_id": document_id,
            "text_preview": text[:300],
        }],
        documents=[text],
    )


def find_similar_segments(
    user_id: str,
    query_text: str,
    top_k: int = 0,
    code_filter: str | None = None,
) -> list[dict]:
    if top_k <= 0:
        top_k = settings.vector_search_top_k
    collection = _get_collection(user_id)
    if collection.count() == 0:
        return []

    query_embedding = _embed_text(query_text)
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


def find_similar_across_codes(
    user_id: str,
    query_text: str,
    top_k: int = 0,
) -> list[dict]:
    return find_similar_segments(user_id, query_text, top_k=top_k)


def delete_segment_embedding(user_id: str, segment_id: str) -> None:
    try:
        collection = _get_collection(user_id)
        collection.delete(ids=[segment_id])
    except Exception:
        pass


def get_segment_count(user_id: str) -> int:
    try:
        return _get_collection(user_id).count()
    except Exception:
        return 0
