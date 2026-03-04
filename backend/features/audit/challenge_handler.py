"""Challenge handler: human-triggered Pass 3 audit cycle."""
from __future__ import annotations
import uuid

from sqlalchemy.orm import Session

from core.models import CodedSegment, Code, AgentAlert, ConsistencyScore, HumanFeedback
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from infrastructure.vector_store.mmr import find_diverse_segments
from features.audit.schemas import ChallengeMeta, ChallengeReflectionResponse

logger = get_logger(__name__)


def _ws_send(user_id: str, payload: dict) -> None:
    ws_manager.send_alert_threadsafe(user_id, payload)


def run_challenge(
    *,
    db: Session,
    segment_id: str,
    user_id: str,
    feedback: str,
) -> ChallengeReflectionResponse:
    from services.ai_analyzer import run_challenge_cycle

    segment = db.query(CodedSegment).filter(CodedSegment.id == segment_id).first()
    if not segment:
        raise ValueError("Segment not found")

    code = db.query(Code).filter(Code.id == segment.code_id).first()
    if not code:
        raise ValueError("Code not found")

    latest_alert = (
        db.query(AgentAlert)
        .filter(AgentAlert.segment_id == segment_id, AgentAlert.alert_type == "coding_audit")
        .order_by(AgentAlert.created_at.desc())
        .first()
    )
    if not latest_alert:
        raise ValueError("No audit found for this segment")

    existing_score = (
        db.query(ConsistencyScore)
        .filter(ConsistencyScore.segment_id == segment_id, ConsistencyScore.code_id == code.id)
        .order_by(ConsistencyScore.created_at.desc())
        .first()
    )

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

    diverse = find_diverse_segments(
        user_id=user_id, query_text=segment.text, code_filter=code.label, n=10,
    )
    history = [(s["code"], s["text"]) for s in diverse]

    challenge_result = run_challenge_cycle(
        reflected_judgment=latest_alert.payload,
        researcher_feedback=feedback,
        history=history,
        new_quote=segment.text,
        proposed_code=code.label,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=existing_score.centroid_similarity if existing_score else None,
        codebook_prob_dist=existing_score.codebook_distribution if existing_score else None,
        entropy=existing_score.entropy if existing_score else None,
        temporal_drift=existing_score.temporal_drift if existing_score else None,
        is_pseudo_centroid=existing_score.is_pseudo_centroid if existing_score else False,
        segment_count=None,
    )

    challenge_meta = challenge_result.get("_challenge", {})

    feedback_id = str(uuid.uuid4())
    feedback_row = HumanFeedback(
        id=feedback_id,
        segment_id=segment_id,
        code_id=code.id,
        user_id=user_id,
        project_id=code.project_id,
        feedback_type="challenge_reflection",
        feedback_text=feedback,
        context_json={
            "reflected_judgment": latest_alert.payload,
            "stage1": {
                "centroid_similarity": existing_score.centroid_similarity if existing_score else None,
                "entropy": existing_score.entropy if existing_score else None,
                "temporal_drift": existing_score.temporal_drift if existing_score else None,
            },
        },
        result_json=challenge_result,
    )
    db.add(feedback_row)

    if existing_score:
        self_lens = challenge_result.get("self_lens", {})
        existing_score.llm_consistency_score = self_lens.get("consistency_score")
        existing_score.llm_intent_score = self_lens.get("intent_alignment_score")
        existing_score.llm_overall_severity = challenge_result.get("overall_severity_score")
        existing_score.was_challenged = True

    latest_alert.payload = challenge_result
    db.commit()

    _ws_send(user_id, {
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
