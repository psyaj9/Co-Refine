"""Challenge handler stub.

The human challenge cycle (allowing researchers to dispute an AI audit verdict)
is not yet implemented. The database schema supports it via the `was_challenged`
column on AgentAlert, but the LLM pass-3 re-evaluation logic is pending.

The /challenge endpoint returns HTTP 501 until this is built out.
"""
