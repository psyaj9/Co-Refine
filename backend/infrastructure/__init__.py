"""Infrastructure package — external integration adapters.

Everything in here talks to the outside world: Azure OpenAI, ChromaDB,
WebSockets. No business logic lives here; no feature imports are allowed.
Features depend on infrastructure, never the other way around.
"""
