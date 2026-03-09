from typing import Optional
from pydantic import BaseModel


class AnalysisOut(BaseModel):
    code_id: str
    code_label: str
    definition: Optional[str] = None
    lens: Optional[str] = None
    reasoning: Optional[str] = None
    segment_count: int = 0


class AnalysisTrigger(BaseModel):
    code_id: str
    user_id: Optional[str] = None


class BatchAuditRequest(BaseModel):
    project_id: str
    user_id: Optional[str] = None
