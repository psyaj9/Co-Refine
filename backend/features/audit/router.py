"""HTTP endpoints for the audit pipeline.

Three routes:
  POST /api/segments/analyse       — manually trigger analysis for one code
  GET  /api/segments/analyses      — list all analysis results for a project
  POST /api/segments/batch-audit   — audit every code in a project at once

"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from core.models import User
from features.audit.schemas import AnalysisTrigger, BatchAuditRequest, AnalysisOut
from features.audit.auto_analyser import run_manual_analysis
from features.audit.service import run_batch_audit_background
from features.audit.repository import (
    get_code_by_id,
    count_segments_for_code,
    list_analyses_for_project,
    list_codes_for_project,
)
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/segments", tags=["audit"])


@router.post("/analyse")
async def trigger_analysis(
    body: AnalysisTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI analysis for a single code.

    Validates that the code exists and has enough segments before dispatching the background job. 
    The minimum exists because the LLM needs at least some examples to derive a meaningful definition.

    The actual analysis runs asynchronously meaning progress and results come back through WebSocket events (agents_started → agent_thinking → analysis_updated).

    Args:
        body: Contains the code_id to analyse
        background_tasks: FastAPI background task runner
        db: DB session
        current_user: Authenticated user

    Returns:
        {"status": "analysis_started", "code_id": ...} immediately

    Raises:
        404 if the code does not exist
        400 if there are fewer than 2 segments for the code
    """
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
    """Return all AI-generated analysis results for a project.

    Joins AnalysisResult with Code so we can include the code label in the
    response without a separate lookup per row.

    Args:
        project_id: Empty string returns all analyses
        db: DB session 
        current_user: Authenticated user

    Returns:
        List of AnalysisOut objects
    """
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
):
    """Audit every code in a project in one shot.

    Runs all per-code audits sequentially in the background, sending progress
    events via WebSocket. 
    
    At the end it also computes the code overlap matrix
    and sends temporal drift warnings for any codes that have shifted.

    Requires an Azure API key because this can trigger many LLM calls.
    Codes with no segments are skipped with a "skipped" progress event.

    Args:
        body: Contains the project_id to audit
        background_tasks: FastAPI background task runner
        db: DB session
        current_user: Authenticated user

    Returns:
        {"status": "batch_audit_started", "code_count": N} immediately

    Raises:
        400 if no AI API key is configured
        404 if the project has no codes
    """
    if not settings.azure_api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    codes = list_codes_for_project(db, body.project_id)
    if not codes:
        raise HTTPException(status_code=404, detail="No codes found for this project")

    background_tasks.add_task(
        run_batch_audit_background,
        project_id=body.project_id,
        user_id=current_user.id,
    )

    return {"status": "batch_audit_started", "code_count": len(codes)}
