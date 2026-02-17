from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
import asyncio

from database import get_db, CodedSegment, Code, Document, AnalysisResult, AgentAlert
from models import SegmentCreate, SegmentOut, AnalysisOut, AnalysisTrigger, AlertOut
from services.ai_analyzer import check_self_consistency, ghost_partner_predict, analyze_quotes
from services.vector_store import (
    add_segment_embedding,
    find_similar_across_codes,
    delete_segment_embedding,
)
from services.ws_manager import ws_manager
from config import settings

router = APIRouter(prefix="/api/segments", tags=["segments"])


def _extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str:
    before = full_text[:start]
    after = full_text[end:]

    before_parts = before.replace("?", ".").replace("!", ".").split(".")
    before_context = ".".join(before_parts[-sentences:]).strip() if before_parts else ""

    after_parts = after.replace("?", ".").replace("!", ".").split(".")
    after_context = ".".join(after_parts[:sentences]).strip() if after_parts else ""

    highlight = full_text[start:end]
    parts = []
    if before_context:
        parts.append(f"...{before_context}")
    parts.append(f">>>{highlight}<<<")
    if after_context:
        parts.append(f"{after_context}...")
    return " ".join(parts)


@router.post("/", response_model=SegmentOut)
async def create_segment(
    body: SegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    doc = db.query(Document).filter(Document.id == body.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    seg_id = str(uuid.uuid4())
    segment = CodedSegment(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        user_id=body.user_id,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)

    if settings.openrouter_api_key:
        context_window = _extract_window(doc.full_text, body.start_index, body.end_index)
        background_tasks.add_task(
            _run_background_agents,
            segment_id=seg_id,
            text=body.text,
            code_label=code.label,
            code_id=body.code_id,
            user_id=body.user_id,
            document_id=body.document_id,
            document_context=context_window,
        )

    return SegmentOut(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        code_label=code.label,
        code_colour=code.colour,
        user_id=body.user_id,
        created_at=segment.created_at,
    )


@router.get("/", response_model=list[SegmentOut])
def list_segments(
    document_id: str = "",
    user_id: str = "",
    db: Session = Depends(get_db),
):
    query = db.query(CodedSegment)
    if document_id:
        query = query.filter(CodedSegment.document_id == document_id)
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    segments = query.order_by(CodedSegment.created_at).all()

    out: list[SegmentOut] = []
    for s in segments:
        code = db.query(Code).filter(Code.id == s.code_id).first()
        out.append(SegmentOut(
            id=s.id,
            document_id=s.document_id,
            text=s.text,
            start_index=s.start_index,
            end_index=s.end_index,
            code_id=s.code_id,
            code_label=code.label if code else "?",
            code_colour=code.colour if code else "#ccc",
            user_id=s.user_id,
            created_at=s.created_at,
        ))
    return out


@router.delete("/{segment_id}")
def delete_segment(segment_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    seg = db.query(CodedSegment).filter(CodedSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")
    delete_segment_embedding(user_id, segment_id)
    db.delete(seg)
    db.commit()
    return {"status": "deleted"}


@router.post("/analyze", response_model=AnalysisOut)
def trigger_analysis(
    body: AnalysisTrigger,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    segments = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == body.code_id, CodedSegment.user_id == body.user_id)
        .all()
    )
    quotes = [s.text for s in segments]
    if len(quotes) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 segments to analyse")

    result = analyze_quotes(code.label, quotes, user_definition=code.definition)

    analysis = AnalysisResult(
        id=str(uuid.uuid4()),
        code_id=body.code_id,
        definition=result.get("definition"),
        lens=result.get("lens"),
        reasoning=result.get("reasoning"),
        segment_count_at_analysis=len(quotes),
    )
    db.merge(analysis)
    db.commit()

    return AnalysisOut(
        code_id=body.code_id,
        code_label=code.label,
        definition=result.get("definition"),
        lens=result.get("lens"),
        reasoning=result.get("reasoning"),
        segment_count=len(quotes),
    )


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(project_id: str = "", db: Session = Depends(get_db)):
    query = db.query(AnalysisResult)
    if project_id:
        query = query.join(Code, AnalysisResult.code_id == Code.id).filter(
            Code.project_id == project_id
        )
    results = query.all()
    out: list[AnalysisOut] = []
    for r in results:
        code = db.query(Code).filter(Code.id == r.code_id).first()
        if not code:
            continue
        out.append(AnalysisOut(
            code_id=r.code_id,
            code_label=code.label,
            definition=r.definition,
            lens=r.lens,
            reasoning=r.reasoning,
            segment_count=r.segment_count_at_analysis,
        ))
    return out


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(user_id: str, unread_only: bool = True, db: Session = Depends(get_db)):
    query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    if unread_only:
        query = query.filter(AgentAlert.is_read == False)
    alerts = query.order_by(AgentAlert.created_at.desc()).limit(50).all()
    return [
        AlertOut(
            id=a.id,
            alert_type=a.alert_type,
            payload=a.payload,
            segment_id=a.segment_id,
            is_read=a.is_read,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AgentAlert).filter(AgentAlert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"status": "ok"}


def _ws_send(user_id: str, payload: dict):
    """Helper: fire-and-forget send via the shared event loop or a new one."""
    try:
        asyncio.run(ws_manager.send_alert(user_id, payload))
    except Exception:
        pass  # WebSocket may be disconnected; not fatal


def _run_background_agents(
    *,
    segment_id: str,
    text: str,
    code_label: str,
    code_id: str,
    user_id: str,
    document_id: str,
    document_context: str,
):
    from database import SessionLocal
    db = SessionLocal()

    # --- Notify frontend: agents have started ---
    _ws_send(user_id, {
        "type": "agents_started",
        "segment_id": segment_id,
        "data": {},
    })

    try:
        # 1. Embed segment
        try:
            add_segment_embedding(
                user_id=user_id,
                segment_id=segment_id,
                text=text,
                code_label=code_label,
                document_id=document_id,
            )
        except Exception as e:
            print(f"[Vector] Embedding failed: {e}")

        # Load all codes for the project to build codebook of user definitions
        current_code = db.query(Code).filter(Code.id == code_id).first()
        project_id = current_code.project_id if current_code else None
        all_codes = (
            db.query(Code).filter(Code.project_id == project_id).all()
            if project_id else []
        )
        # user_code_definitions: {label -> definition_or_empty}
        user_code_definitions: dict[str, str] = {
            c.label: (c.definition or "") for c in all_codes
        }
        # codebook: same dict, used by ghost partner
        codebook = user_code_definitions

        user_segment_count = (
            db.query(CodedSegment).filter(CodedSegment.user_id == user_id).count()
        )

        # 2. Self-Consistency check
        if user_segment_count >= settings.min_segments_for_consistency:
            _ws_send(user_id, {
                "type": "agent_thinking",
                "agent": "consistency",
                "segment_id": segment_id,
                "data": {},
            })
            try:
                similar = find_similar_across_codes(
                    user_id=user_id, query_text=text, top_k=10
                )
                user_history = [(s["code"], s["text"]) for s in similar]

                analyses = db.query(AnalysisResult).all()
                code_definitions: dict[str, dict] = {}
                for a in analyses:
                    code_obj = db.query(Code).filter(Code.id == a.code_id).first()
                    if code_obj:
                        code_definitions[code_obj.label] = {
                            "definition": a.definition or "",
                            "lens": a.lens or "",
                        }

                consistency_result = check_self_consistency(
                    user_history=user_history,
                    code_definitions=code_definitions,
                    new_quote=text,
                    proposed_code=code_label,
                    document_context=document_context,
                    user_code_definitions=user_code_definitions,
                )

                is_consistent = consistency_result.get("is_consistent", True)

                alert = AgentAlert(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    segment_id=segment_id,
                    alert_type="consistency",
                    payload=consistency_result,
                )
                db.add(alert)
                db.commit()

                _ws_send(user_id, {
                    "type": "consistency",
                    "segment_id": segment_id,
                    "is_consistent": is_consistent,
                    "data": consistency_result,
                })
            except Exception as e:
                print(f"[Agent] Self-consistency error: {e}")
                _ws_send(user_id, {
                    "type": "agent_error",
                    "agent": "consistency",
                    "segment_id": segment_id,
                    "data": {"message": str(e)},
                })

        # 3. Ghost Partner check
        _ws_send(user_id, {
            "type": "agent_thinking",
            "agent": "ghost_partner",
            "segment_id": segment_id,
            "data": {},
        })
        try:
            partner_similar = find_similar_across_codes(
                user_id=user_id, query_text=text, top_k=10
            )
            partner_history = [(s["code"], s["text"]) for s in partner_similar]

            if len(partner_history) >= 3:
                ghost_result = ghost_partner_predict(
                    partner_history=partner_history,
                    new_quote=text,
                    user_proposed_code=code_label,
                    document_context=document_context,
                    codebook=codebook,
                )

                is_conflict = ghost_result.get("is_conflict", False)

                alert = AgentAlert(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    segment_id=segment_id,
                    alert_type="ghost_partner",
                    payload=ghost_result,
                )
                db.add(alert)
                db.commit()

                _ws_send(user_id, {
                    "type": "ghost_partner",
                    "segment_id": segment_id,
                    "is_conflict": is_conflict,
                    "data": ghost_result,
                })
        except Exception as e:
            print(f"[Agent] Ghost partner error: {e}")
            _ws_send(user_id, {
                "type": "agent_error",
                "agent": "ghost_partner",
                "segment_id": segment_id,
                "data": {"message": str(e)},
            })

        # 4. Auto-analysis
        code_segment_count = (
            db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .count()
        )
        existing_analysis = (
            db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).first()
        )
        last_count = existing_analysis.segment_count_at_analysis if existing_analysis else 0

        if code_segment_count >= settings.auto_analysis_threshold and (
            code_segment_count - last_count >= settings.auto_analysis_threshold or last_count == 0
        ):
            _ws_send(user_id, {
                "type": "agent_thinking",
                "agent": "analysis",
                "segment_id": segment_id,
                "data": {},
            })
            try:
                all_quotes = [
                    s.text
                    for s in db.query(CodedSegment)
                    .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
                    .all()
                ]
                current_code_def = current_code.definition if current_code else None
                analysis_result = analyze_quotes(code_label, all_quotes, user_definition=current_code_def)
                analysis = AnalysisResult(
                    id=existing_analysis.id if existing_analysis else str(uuid.uuid4()),
                    code_id=code_id,
                    definition=analysis_result.get("definition"),
                    lens=analysis_result.get("lens"),
                    reasoning=analysis_result.get("reasoning"),
                    segment_count_at_analysis=code_segment_count,
                )
                db.merge(analysis)
                db.commit()

                _ws_send(user_id, {
                    "type": "analysis_updated",
                    "code_id": code_id,
                    "code_label": code_label,
                    "data": analysis_result,
                })
            except Exception as e:
                print(f"[Agent] Auto-analysis error: {e}")
                _ws_send(user_id, {
                    "type": "agent_error",
                    "agent": "analysis",
                    "segment_id": segment_id,
                    "data": {"message": str(e)},
                })
    finally:
        # --- Notify frontend: all agents finished ---
        _ws_send(user_id, {
            "type": "agents_done",
            "segment_id": segment_id,
            "data": {},
        })
        db.close()
