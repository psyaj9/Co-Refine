"""LLM-based audit functions: coding audit and auto-analysis.

Moved here from services/ai_analyzer.py to eliminate the cross-layer
dependency (features/ must not depend on services/).
"""
from __future__ import annotations

from core.config import settings
from infrastructure.llm.client import call_llm
from prompts.analysis_prompt import build_analysis_prompt
from prompts.audit_prompt import build_coding_audit_prompt

_ORDINAL_SCORE_MAP = {"high": 0.9, "medium": 0.6, "low": 0.3}


def _to_float(val: object, default: float = 0.5) -> float:
    """Coerce an LLM-returned value to a float, handling ordinal strings and None."""
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


def analyze_quotes(
    code_label: str,
    quotes: list[str],
    user_definition: str | None = None,
) -> dict:
    """Call reasoning model to synthesise an operational definition for a code.

    Returns a dict with keys: definition, lens, reasoning.
    """
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
    centroid_similarity: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> dict:
    """Run Stage 2 LLM self-consistency audit on a single coded segment.

    Uses the reasoning model for every audit call.

    Returns:
        dict with keys:
          self_lens: {is_consistent, consistency_score, intent_alignment_score,
                      reasoning, definition_match, drift_warning, alternative_codes, suggestion}
          overall_severity_score: float [0.0–1.0]
          overall_severity: 'high' | 'medium' | 'low'
          score_grounding_note: str
          _escalation: {was_escalated, reason}
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

    result = call_llm(messages, model=settings.azure_deployment_reasoning)

    # Escalation metadata kept for backward compatibility (DB field, WS consumers)
    result["_escalation"] = {"was_escalated": False, "reason": None}

    return result
