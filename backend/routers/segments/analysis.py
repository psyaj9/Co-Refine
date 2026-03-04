"""Codebook analysis and batch audit endpoints."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import CodedSegment, Code, AnalysisResult
from models import AnalysisOut, AnalysisTrigger, BatchAuditRequest
from services.audit_pipeline import _run_analysis_background, _run_batch_audit_background
from core.config import settings

router = APIRouter()


@router.post("/analyze")
async def trigger_analysis(
    body: AnalysisTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    segment_count = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == body.code_id, CodedSegment.user_id == body.user_id)
        .count()
    )
    if segment_count < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 segments to analyse")

    background_tasks.add_task(
        _run_analysis_background,
        code_id=body.code_id,
        code_label=code.label,
        user_id=body.user_id,
        user_definition=code.definition,
    )

    return {"status": "analysis_started", "code_id": body.code_id}


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(project_id: str = "", db: Session = Depends(get_db)):
    query = (
        db.query(AnalysisResult, Code)
        .join(Code, AnalysisResult.code_id == Code.id)
    )
    if project_id:
        query = query.filter(Code.project_id == project_id)
    return [
        AnalysisOut(
            code_id=r.code_id,
            code_label=code.label,
            definition=r.definition,
            lens=r.lens,
            reasoning=r.reasoning,
            segment_count=r.segment_count_at_analysis,
        )
        for r, code in query.all()
    ]


@router.post("/batch-audit")
async def batch_audit(
    body: BatchAuditRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Run the Coding Audit agent across ALL codes in a project.

    Uses MMR diversity sampling to pick representative segments per code, then
    runs run_coding_audit on each. Results stream back via WebSocket as
    'coding_audit' events with batch=True.
    """
    if not settings.azure_api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    codes = db.query(Code).filter(Code.project_id == body.project_id).all()
    if not codes:
        raise HTTPException(status_code=404, detail="No codes found for this project")

    background_tasks.add_task(
        _run_batch_audit_background,
        project_id=body.project_id,
        user_id=body.user_id,
    )
    return {"status": "batch_audit_started", "code_count": len(codes)}
