"""Text embedding strategies: local SentenceTransformer or Azure OpenAI.

Strategy is selected at call time:
  - If settings.azure_embedding_model is set → Azure OpenAI embeddings
  - Otherwise → local all-MiniLM-L6-v2 via SentenceTransformer
"""

import threading

from core.config import settings

_embed_model = None
_embed_lock = threading.Lock()

_embed_api_client = None
_embed_api_lock = threading.Lock()


def embed_text(text: str) -> list[float]:
    """Embed a text string using the configured strategy."""
    if settings.azure_embedding_model:
        return _embed_api(text)
    return _embed_local(text)


def _embed_local(text: str) -> list[float]:
    global _embed_model
    if _embed_model is None:
        with _embed_lock:
            if _embed_model is None:
                from sentence_transformers import SentenceTransformer
                _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model.encode(text).tolist()


def _get_embed_api_client():
    global _embed_api_client
    if _embed_api_client is None:
        with _embed_api_lock:
            if _embed_api_client is None:
                from openai import AzureOpenAI
                _embed_api_client = AzureOpenAI(
                    azure_endpoint=settings.azure_endpoint,
                    api_key=settings.azure_api_key,
                    api_version=settings.azure_api_version,
                )
    return _embed_api_client


def _embed_api(text: str) -> list[float]:
    """Azure OpenAI embeddings using the configured embedding deployment."""
    client = _get_embed_api_client()
    response = client.embeddings.create(
        model=settings.azure_embedding_model,
        input=text,
    )
    return response.data[0].embedding
