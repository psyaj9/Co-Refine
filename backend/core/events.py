"""WebSocket event type constants.

Single source of truth for all WS event type strings used between
backend background tasks and the frontend WebSocket handler.
"""

# Agent lifecycle
AGENTS_STARTED = "agents_started"
AGENTS_DONE = "agents_done"
AGENT_THINKING = "agent_thinking"
AGENT_ERROR = "agent_error"

# Deterministic scoring (Stage 1)
DETERMINISTIC_SCORES = "deterministic_scores"

# Coding audit (Stage 2)
CODING_AUDIT = "coding_audit"

# Reflection (Stage 2b)
REFLECTION_COMPLETE = "reflection_complete"

# Challenge (Pass 3)
CHALLENGE_RESULT = "challenge_result"

# Analysis
ANALYSIS_UPDATED = "analysis_updated"

# Batch audit
BATCH_AUDIT_STARTED = "batch_audit_started"
BATCH_AUDIT_PROGRESS = "batch_audit_progress"
BATCH_AUDIT_DONE = "batch_audit_done"

# Scoring
CODE_OVERLAP_MATRIX = "code_overlap_matrix"

# Temporal drift alert (Stage 1 LOGOS metric — emitted when a code's centroid has drifted)
TEMPORAL_DRIFT_WARNING = "temporal_drift_warning"

# Facets
FACET_UPDATED = "facet_updated"

# Chat
CHAT_STREAM_START = "chat_stream_start"
CHAT_TOKEN = "chat_token"
CHAT_DONE = "chat_done"
CHAT_ERROR = "chat_error"
