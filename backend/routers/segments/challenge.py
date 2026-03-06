"""Human-triggered challenge-reflection endpoint (pass 3 of the audit cycle)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import CodedSegment, Code, AgentAlert, ConsistencyScore, HumanFeedback
from models import ChallengeReflectionRequest, ChallengeReflectionResponse, ChallengeMeta
from services.ai_analyzer import run_challenge_cycle
from services.vector_store import find_diverse_segments
from services.audit_pipeline import _ws_send

router = APIRouter()


@router.post("/{segment_id}/challenge-reflection", response_model=ChallengeReflectionResponse)
async def challenge_reflection(
    segment_id: str,
    body: ChallengeReflectionRequest,
    db: Session = Depends(get_db),
):
    """Human-triggered 3rd cycle: researcher challenges the AI's reflected judgment.

    The researcher provides text feedback explaining why the reflection is wrong.
    The model reconsiders, weighting the researcher's expertise heavily.
    A HumanFeedback row is persisted for the audit trail.
    """
    # Fetch the segment
    segment = db.query(CodedSegment).filter(CodedSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    code = db.query(Code).filter(Code.id == segment.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    # Get the latest audit alert for this segment
    latest_alert = (
        db.query(AgentAlert)
        .filter(
            AgentAlert.segment_id == segment_id,
            AgentAlert.alert_type == "coding_audit",
        )
        .order_by(AgentAlert.created_at.desc())
        .first()
    )
    if not latest_alert:
        raise HTTPException(status_code=404, detail="No audit found for this segment")

    reflected_judgment = latest_alert.payload

    # Fetch existing ConsistencyScore for Stage 1 data
    existing_score = (
        db.query(ConsistencyScore)
        .filter(
            ConsistencyScore.segment_id == segment_id,
            ConsistencyScore.code_id == code.id,
        )
        .order_by(ConsistencyScore.created_at.desc())
        .first()
    )

    # Fetch co-applied codes
    overlapping = (
        db.query(CodedSegment, Code)
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(
            CodedSegment.document_id == segment.document_id,
            CodedSegment.id != segment.id,
            CodedSegment.start_index < segment.end_index,
            CodedSegment.end_index > segment.start_index,
        )
        .all()
    )
    existing_codes_on_span = list({c.label for _seg, c in overlapping})

    # Fetch MMR history for challenge context
    diverse = find_diverse_segments(
        user_id=body.user_id,
        query_text=segment.text,
        code_filter=code.label,
        n=10,
    )
    history = [(s["code"], s["text"]) for s in diverse]

    # Run the challenge cycle (3rd pass)
    challenge_result = run_challenge_cycle(
        reflected_judgment=reflected_judgment,
        researcher_feedback=body.feedback,
        history=history,
        new_quote=segment.text,
        proposed_code=code.label,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=existing_score.centroid_similarity if existing_score else None,
        temporal_drift=existing_score.temporal_drift if existing_score else None,
        is_pseudo_centroid=existing_score.is_pseudo_centroid if existing_score else False,
        segment_count=None,
    )

    challenge_meta = challenge_result.get("_challenge", {})

    # Persist HumanFeedback row
    feedback_id = str(uuid.uuid4())
    feedback = HumanFeedback(
        id=feedback_id,
        segment_id=segment_id,
        code_id=code.id,
        user_id=body.user_id,
        project_id=code.project_id,
        feedback_type="challenge_reflection",
        feedback_text=body.feedback,
        context_json={
            "reflected_judgment": reflected_judgment,
            "stage1": {
                "centroid_similarity": existing_score.centroid_similarity if existing_score else None,
                "temporal_drift": existing_score.temporal_drift if existing_score else None,
            },
        },
        result_json=challenge_result,
    )
    db.add(feedback)

    # Update ConsistencyScore with challenged result
    if existing_score:
        self_lens = challenge_result.get("self_lens", {})
        existing_score.llm_consistency_score = self_lens.get("consistency_score")
        existing_score.llm_intent_score = self_lens.get("intent_alignment_score")
        existing_score.llm_overall_severity = challenge_result.get("overall_severity_score")
        existing_score.was_challenged = True

    # Update the alert payload with challenged result
    latest_alert.payload = challenge_result
    db.commit()

    # Send WS notification
    _ws_send(body.user_id, {
        "type": "challenge_result",
        "segment_id": segment_id,
        "code_id": code.id,
        "code_label": code.label,
        "data": challenge_result,
    })

    return ChallengeReflectionResponse(
        audit_result=challenge_result,
        challenge=ChallengeMeta(**challenge_meta),
        human_feedback_id=feedback_id,
    )
