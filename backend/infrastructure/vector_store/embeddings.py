"""Text embedding via Azure OpenAI.

Single public function: ``embed_text(text) -> list[float]``.

The Azure client is initialised lazily behind a lock so it's safe in
multi-threaded contexts (background audit threads call this concurrently).
The import of openai is deferred to first use so that apps that don't configure
Azure credentials can still start without an import-time crash.
"""

import threading

from core.config import settings

# Module-level singleton — created once, reused for all embedding calls.
_embed_api_client = None
# Lock prevents two threads from both seeing _embed_api_client is None and
# each trying to create their own client (double-checked locking pattern).
_embed_api_lock = threading.Lock()


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return the embedding vector.

    Args:
        text: The text to embed. Can be a segment, a query, or a code label.

    Returns:
        A list of floats representing the embedding vector. Dimensionality
        depends on the configured Azure embedding model.
    """
    return _embed_api(text)


def _get_embed_api_client():
    """Return the lazily-created AzureOpenAI client for embeddings.

    Uses double-checked locking so the client is created at most once even
    if multiple threads reach this concurrently.

    Returns:
        Configured AzureOpenAI client instance.
    """
    global _embed_api_client
    if _embed_api_client is None:
        with _embed_api_lock:
            # Re-check inside the lock — another thread may have initialised
            # it between our first check and acquiring the lock.
            if _embed_api_client is None:
                from openai import AzureOpenAI
                _embed_api_client = AzureOpenAI(
                    azure_endpoint=settings.azure_endpoint,
                    api_key=settings.azure_api_key,
                    api_version=settings.azure_api_version,
                )
    return _embed_api_client


def _embed_api(text: str) -> list[float]:
    """Call the Azure OpenAI embeddings endpoint.

    Args:
        text: Text to embed.

    Returns:
        Embedding vector as a list of floats.
    """
    client = _get_embed_api_client()
    response = client.embeddings.create(
        model=settings.azure_embedding_model,
        input=text,
    )
    # The API always returns a list of embedding objects; we only ever send
    # a single input so index 0 is the one we want.
    return response.data[0].embedding
