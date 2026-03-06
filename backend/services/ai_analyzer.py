from typing import Generator

from core.config import settings
from infrastructure.llm.client import call_llm, get_client
from prompts import (
    build_analysis_prompt,
    build_coding_audit_prompt,
)

_ORDINAL_SCORE_MAP = {"high": 0.9, "medium": 0.6, "low": 0.3}


def _to_float(val: object, default: float = 0.5) -> float:
    """Coerce an LLM-returned value to float, handling ordinal strings and None."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str) and val.lower() in _ORDINAL_SCORE_MAP:
        return _ORDINAL_SCORE_MAP[val.lower()]
    try:
        return float(val)  # type: ignore[arg-type]
    except (ValueError, TypeError):
        return default


def analyze_quotes(code_label: str, quotes: list[str], user_definition: str | None = None) -> dict:
    prompt = build_analysis_prompt(code_label, quotes, user_definition=user_definition)
    return call_llm(prompt, model=settings.azure_deployment_reasoning)


def run_coding_audit(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
    # Stage 1 deterministic scores (None = no grounding available)
    centroid_similarity: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> dict:
    """Two-stage coding audit.

    Stage 2: LLM self-consistency judgment (fast model).
    Stage 3: Escalation with reasoning model when evidence diverges.

    Returns a dict with keys:
      self_lens: { is_consistent, consistency_score (float), intent_alignment_score (float),
                   reasoning, definition_match, drift_warning, alternative_codes, suggestion }
      overall_severity_score: float [0.0–1.0]
      overall_severity: 'high' | 'medium' | 'low'
      score_grounding_note: str
      _escalation: { was_escalated, reason }
    """
    messages = build_coding_audit_prompt(
        user_history=user_history,
        code_definitions=code_definitions,
        new_quote=new_quote,
        proposed_code=proposed_code,
        document_context=document_context,
        user_code_definitions=user_code_definitions,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=centroid_similarity,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
    )

    # ── Stage 2: Reasoning model — deep audit every segment ──
    result = call_llm(messages, model=settings.azure_deployment_reasoning)

    # Escalation metadata kept for backward compatibility (DB field, WS payload consumers)
    result["_escalation"] = {"was_escalated": False, "reason": None}

    return result


def stream_chat_response(
    messages: list[dict],
    model: str | None = None,
) -> Generator[str, None, None]:
    """Stream chat tokens from Azure OpenAI. Yields text chunks as they arrive."""
    client = get_client()
    response = client.chat.completions.create(
        model=model or settings.azure_deployment_fast,
        messages=messages,
        stream=True,
    )

    for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if not delta or not delta.content:
            continue
        yield delta.content
