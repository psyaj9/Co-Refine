from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from core.models import User
from core.models import User
from features.audit.schemas import AnalysisTrigger, BatchAuditRequest, AnalysisOut
from features.audit.auto_analyzer import run_manual_analysis
from features.audit.batch_auditor import run_batch_audit_background
from features.audit.repository import (
    get_code_by_id,
    count_segments_for_code,
    list_analyses_for_project,
    list_codes_for_project,
)
from infrastructure.auth.dependencies import get_current_user
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/segments", tags=["audit"])


@router.post("/analyze")
async def trigger_analysis(
    body: AnalysisTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_user: User = Depends(get_current_user),
):
    code = get_code_by_id(db, body.code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    user_id = current_user.id
    segment_count = count_segments_for_code(db, body.code_id, user_id)
    if segment_count < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 segments to analyse")

    background_tasks.add_task(
        run_manual_analysis,
        code_id=body.code_id,
        code_label=code.label,
        user_id=user_id,
        user_definition=code.definition,
    )
    return {"status": "analysis_started", "code_id": body.code_id}


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(project_id: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = list_analyses_for_project(db, project_id)
    return [
        AnalysisOut(
            code_id=r.code_id,
            code_label=code.label,
            definition=r.definition,
            lens=r.lens,
            reasoning=r.reasoning,
            segment_count=r.segment_count_at_analysis,
        )
        for r, code in rows
    ]


@router.post("/batch-audit")
async def batch_audit(
    body: BatchAuditRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_user: User = Depends(get_current_user),
):
    if not settings.azure_api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    codes = list_codes_for_project(db, body.project_id)
    if not codes:
        raise HTTPException(status_code=404, detail="No codes found for this project")

    background_tasks.add_task(
        run_batch_audit_background,
        project_id=body.project_id,
        user_id=current_user.id,
        user_id=current_user.id,
    )
    return {"status": "batch_audit_started", "code_count": len(codes)}
