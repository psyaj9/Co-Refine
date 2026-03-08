"""Text embedding via Azure OpenAI."""

import threading

from core.config import settings

_embed_api_client = None
_embed_api_lock = threading.Lock()


def embed_text(text: str) -> list[float]:
    """Embed a text string using Azure OpenAI."""
    return _embed_api(text)


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
