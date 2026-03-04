"""DEPRECATED — shim for backward compatibility.

Import from core.database and core.models instead.
This file will be removed in a future phase.
"""

# Infrastructure re-exports
from core.database import engine, SessionLocal, Base, get_db  # noqa: F401

# ORM model re-exports
from core.models import (  # noqa: F401
    Project,
    Document,
    Code,
    CodedSegment,
    AnalysisResult,
    AgentAlert,
    ChatMessage,
    EditEvent,
    ConsistencyScore,
    HumanFeedback,
    Facet,
    FacetAssignment,
)

# Migration re-export
from core.models.migrations import init_db  # noqa: F401
