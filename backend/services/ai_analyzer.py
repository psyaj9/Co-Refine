import json
from typing import Generator
from openai import AzureOpenAI

from config import settings
from prompts import (
    build_analysis_prompt,
    build_coding_audit_prompt,
)
from utils import parse_json_response, PARSE_FAILED_SENTINEL

_client: AzureOpenAI | None = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=settings.azure_api_key,
            azure_endpoint=settings.azure_endpoint,
            api_version=settings.azure_api_version,
        )
    return _client


def _call_llm(prompt: str | list[dict], model: str | None = None, retries: int = 1) -> dict:
    """Call LLM with either a plain string prompt or a list of message dicts.

    Accepts:
        prompt: str  — wrapped as [{"role": "user", "content": prompt}]
        prompt: list[dict] — used directly as messages (system + user)
    """
    client = _get_client()
    deployment = model or settings.azure_deployment_fast

    # Support both old (string) and new (messages list) format
    if isinstance(prompt, str):
        messages = [{"role": "user", "content": prompt}]
    else:
        messages = prompt

    for attempt in range(1 + retries):
        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        result = parse_json_response(raw)

        if result.get("definition") != PARSE_FAILED_SENTINEL:
            return result

        print(f"[LLM] Parse failure (attempt {attempt + 1}) — raw response: {raw[:500]}")

    return result


def analyze_quotes(code_label: str, quotes: list[str], user_definition: str | None = None) -> dict:
    prompt = build_analysis_prompt(code_label, quotes, user_definition=user_definition)
    return _call_llm(prompt, model=settings.azure_deployment_reasoning)

    return result


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
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> dict:
    """Multi-stage coding audit: Stage 1 scores ground Stage 2 LLM judgment.

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
        codebook_prob_dist=codebook_prob_dist,
        entropy=entropy,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
    )

    result = _call_llm(messages)  # fast model

    # ── STAGE 3: Escalation — only when Stage 1 and Stage 2 diverge ──
    llm_severity = result.get("overall_severity_score")
    llm_consistency = result.get("self_lens", {}).get("consistency_score")

    # Coerce to float safely (in case LLM returns strings despite instructions)
    def _to_float(val, default: float = 0.5) -> float:
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        # Handle ordinal fallback for robustness
        score_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
        if isinstance(val, str) and val.lower() in score_map:
            return score_map[val.lower()]
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    llm_severity_f = _to_float(llm_severity, 0.5)
    llm_consistency_f = _to_float(llm_consistency, 0.5)

    escalation_reason = None

    # Condition 1: LLM contradicts the embedding evidence
    if centroid_similarity is not None:
        divergence = abs(centroid_similarity - llm_consistency_f)
        if divergence > settings.stage_divergence_threshold:
            escalation_reason = f"stage_divergence={divergence:.3f}"

    # Condition 2: LLM itself says this is serious
    if llm_severity_f >= 0.65:
        escalation_reason = f"high_severity={llm_severity_f:.3f}"

    # Condition 3: Embedding says ambiguous but LLM dismisses it
    if entropy is not None and entropy > 0.7 and llm_consistency_f > 0.7:
        escalation_reason = f"entropy_conflict: entropy={entropy:.3f}, llm_consistency={llm_consistency_f:.3f}"

    was_escalated = escalation_reason is not None
    if was_escalated:
        result = _call_llm(messages, model=settings.azure_deployment_reasoning)

    # Attach escalation metadata to result
    result["_escalation"] = {
        "was_escalated": was_escalated,
        "reason": escalation_reason,
    }

    return result


def stream_chat_response(
    messages: list[dict],
    model: str | None = None,
) -> Generator[str, None, None]:
    """Stream chat tokens from Azure OpenAI. Yields text chunks as they arrive."""
    client = _get_client()
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
