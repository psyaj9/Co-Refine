"""DEPRECATED shim — import from infrastructure.vector_store.* instead."""

# Store + embedding functions
from infrastructure.vector_store.store import (  # noqa: F401
    get_collection,
    add_segment_embedding,
    find_similar_segments,
    delete_segment_embedding,
    get_segment_count,
)

# Diversity sampling
from infrastructure.vector_store.mmr import find_diverse_segments  # noqa: F401

# Raw embedding (used by services.scoring for Stage 1)
from infrastructure.vector_store.embeddings import embed_text  # noqa: F401


