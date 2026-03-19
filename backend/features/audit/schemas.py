"""Pydantic DTOs for the audit feature.

These are the request/response shapes for the audit HTTP endpoints.

"""
from typing import Optional
from pydantic import BaseModel


class AnalysisOut(BaseModel):
    """Response shape for a single AI-generated code analysis result.

    Returned by GET /api/segments/analyses. 
    
    The `segment_count` field records how many segments existed when the analysis was last run.
    Helps frontend show a "stale analysis" warning if the count has grown since.
    """
    code_id: str
    code_label: str
    definition: Optional[str] = None
    lens: Optional[str] = None
    reasoning: Optional[str] = None
    segment_count: int = 0


class AnalysisTrigger(BaseModel):
    """Request body for POST /api/segments/analyse.

    """
    code_id: str
    user_id: Optional[str] = None


class BatchAuditRequest(BaseModel):
    """Request body for POST /api/segments/batch-audit.

    """
    project_id: str
    user_id: Optional[str] = None
