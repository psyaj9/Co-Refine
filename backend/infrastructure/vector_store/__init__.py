"""Vector store (ChromaDB) + embedding subpackage.

Wraps all ChromaDB interactions behind simple helper functions so the rest of
the app never imports chromadb directly. Embedding generation lives here too
so the embedding strategy (Azure API vs local model) is swappable in one place.
"""
