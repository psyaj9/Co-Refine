"""
ORM model registry, imports all models here so SQLAlchemy's metadata is fully populated.
This file doesn't define any models itself, but importing it ensures that all the individual model modules are imported and registered with SQLAlchemy.
"""

from core.models.user import User
from core.models.project_member import ProjectMember
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
from core.models.icr_resolution import IcrResolution

__all__ = [
    "User",
    "ProjectMember",
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
    "IcrResolution",
]
