"""
WebSocket event type constants.

These strings are the `type` field on every message sent over the WebSocket connection.
These are kept as constants

The frontend's useWebSocket.ts handler switches on these same strings — if you add one
here, add the corresponding case there too.
"""

AGENTS_STARTED = "agents_started"
AGENTS_DONE = "agents_done"
AGENT_THINKING = "agent_thinking"
AGENT_ERROR = "agent_error"

# Stage 1: deterministic scoring 
DETERMINISTIC_SCORES = "deterministic_scores"

# Stage 2: LLM audit result for a single segment
CODING_AUDIT = "coding_audit"

# Fired when an analysis is created or updated
ANALYSIS_UPDATED = "analysis_updated"

# Batch audit events, this is sent when the researcher manually triggers a full-project re-audit
BATCH_AUDIT_STARTED = "batch_audit_started"
BATCH_AUDIT_PROGRESS = "batch_audit_progress"
BATCH_AUDIT_DONE = "batch_audit_done"

# Code overlap matrix result, this is sent after batch audit or when overlap is recalculated
CODE_OVERLAP_MATRIX = "code_overlap_matrix"

# Temporal drift warning, this is sent when a code's usage has drifted significantly over time
TEMPORAL_DRIFT_WARNING = "temporal_drift_warning"

# KMeans facet clustering result for a code, this updates the visualisation tab
FACET_UPDATED = "facet_updated"

# Chat streaming events, the frontend accumulates tokens into the message bubble
CHAT_STREAM_START = "chat_stream_start"
CHAT_TOKEN = "chat_token"
CHAT_DONE = "chat_done"
CHAT_ERROR = "chat_error"
