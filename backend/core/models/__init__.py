"""ORM model package — re-exports all SQLAlchemy models.

Import models from here (not from individual files) to ensure
all relationship strings resolve before any DB queries execute.

Usage:
    from core.models import Project, Document, Code, CodedSegment, ...
"""

from core.models.project import Project
from core.models.document import Document
from core.models.code import Code
from core.models.segment import CodedSegment
from core.models.analysis import AnalysisResult
from core.models.alert import AgentAlert
from core.models.chat import ChatMessage
from core.models.edit_event import EditEvent
from core.models.consistency_score import ConsistencyScore
from core.models.facet import Facet, FacetAssignment

__all__ = [
    "Project",
    "Document",
    "Code",
    "CodedSegment",
    "AnalysisResult",
    "AgentAlert",
    "ChatMessage",
    "EditEvent",
    "ConsistencyScore",
    "Facet",
    "FacetAssignment",
]
