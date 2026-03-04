from typing import Generator
from openai import AzureOpenAI

from core.config import settings
from prompts import (
    build_analysis_prompt,
    build_coding_audit_prompt,
    build_reflection_prompt,
    build_challenge_prompt,
)
from utils import parse_json_response, PARSE_FAILED_SENTINEL

_client: AzureOpenAI | None = None

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
    # Reflection loop controls
    enable_reflection: bool = True,
    reflection_history: list[tuple[str, str]] | None = None,
) -> dict:
    """Multi-stage coding audit with optional self-consistency reflection loop.

    When enable_reflection=True (default), Stage 2 becomes a 2-pass loop:
      Pass 1: Initial self-consistency judgment (fast model)
      Pass 2: Reflection on own judgment with fresh MMR examples (same fast model)
    Escalation (Stage 3) is evaluated against the *reflected* scores.

    Returns a dict with keys:
      self_lens: { is_consistent, consistency_score (float), intent_alignment_score (float),
                   reasoning, definition_match, drift_warning, alternative_codes, suggestion }
      overall_severity_score: float [0.0–1.0]
      overall_severity: 'high' | 'medium' | 'low'
      score_grounding_note: str
      _escalation: { was_escalated, reason }
      _reflection: { was_reflected, initial_scores, reflected_scores, score_delta }
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

    # ── Pass 1: Initial judgment (fast model) ──
    initial_result = _call_llm(messages)  # fast model

    # ── Pass 2: Reflection loop (same fast model) ──
    reflection_meta: dict = {"was_reflected": False}

    if enable_reflection and reflection_history is not None:
        initial_scores = _extract_scores(initial_result)

        reflection_messages = build_reflection_prompt(
            initial_judgment=initial_result,
            reflection_history=reflection_history,
            new_quote=new_quote,
            proposed_code=proposed_code,
            document_context=document_context,
            existing_codes_on_span=existing_codes_on_span,
            centroid_similarity=centroid_similarity,
            codebook_prob_dist=codebook_prob_dist,
            entropy=entropy,
            temporal_drift=temporal_drift,
            is_pseudo_centroid=is_pseudo_centroid,
            segment_count=segment_count,
        )
        reflected_result = _call_llm(reflection_messages)  # same fast model

        reflected_scores = _extract_scores(reflected_result)
        score_delta = {
            k: round(reflected_scores[k] - initial_scores[k], 4)
            for k in initial_scores
        }

        reflection_meta = {
            "was_reflected": True,
            "initial_scores": initial_scores,
            "reflected_scores": reflected_scores,
            "score_delta": score_delta,
        }

        # Use the reflected result going forward
        result = reflected_result
    else:
        result = initial_result

    # ── STAGE 3: Escalation — evaluated against reflected scores ──
    llm_severity = result.get("overall_severity_score")
    llm_consistency = result.get("self_lens", {}).get("consistency_score")

    llm_severity_f = _to_float(llm_severity, 0.5)
    llm_consistency_f = _to_float(llm_consistency, 0.5)

    escalation_reason = None

    # Condition 1: LLM contradicts the embedding evidence
    # Skip when centroid is pseudo (definition-only, no real usage signal)
    if centroid_similarity is not None and not is_pseudo_centroid:
        divergence = abs(centroid_similarity - llm_consistency_f)
        if divergence > settings.stage_divergence_threshold:
            escalation_reason = f"stage_divergence={divergence:.3f}"

    # Condition 2: LLM itself says this is serious (raise threshold to 0.80
    # — reflection already handles most medium-severity cases)
    if llm_severity_f >= 0.80:
        escalation_reason = f"high_severity={llm_severity_f:.3f}"

    # Condition 3 (entropy_conflict) removed: entropy structurally converges
    # near 1.0 on any codebook with 3+ codes, making it a near-constant that
    # triggered escalation on almost every consistent segment.

    was_escalated = escalation_reason is not None
    if was_escalated:
        result = _call_llm(messages, model=settings.azure_deployment_reasoning)

    # Attach escalation metadata to result
    result["_escalation"] = {
        "was_escalated": was_escalated,
        "reason": escalation_reason,
    }

    # Attach reflection metadata
    result["_reflection"] = reflection_meta

    return result


def _extract_scores(result: dict) -> dict:
    """Extract the three key numeric scores from an audit result."""
    self_lens = result.get("self_lens", {})
    return {
        "consistency_score": float(self_lens.get("consistency_score", 0.5)),
        "intent_alignment_score": float(self_lens.get("intent_alignment_score", 0.5)),
        "overall_severity_score": float(result.get("overall_severity_score", 0.5)),
    }


def run_challenge_cycle(
    reflected_judgment: dict,
    researcher_feedback: str,
    history: list[tuple[str, str]],
    new_quote: str,
    proposed_code: str,
    existing_codes_on_span: list[str] | None = None,
    # Stage 1 deterministic scores
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> dict:
    """Run a human-triggered challenge cycle (pass 3).

    The researcher disagrees with the reflected judgment and provides
    their own reasoning. The model reconsiders, weighting the researcher's
    expertise heavily.

    Returns normal audit dict with _challenge metadata.
    """
    pre_scores = _extract_scores(reflected_judgment)

    messages = build_challenge_prompt(
        reflected_judgment=reflected_judgment,
        researcher_feedback=researcher_feedback,
        history=history,
        new_quote=new_quote,
        proposed_code=proposed_code,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=centroid_similarity,
        codebook_prob_dist=codebook_prob_dist,
        entropy=entropy,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
    )

    result = _call_llm(messages)  # same fast model
    post_scores = _extract_scores(result)

    result["_challenge"] = {
        "was_challenged": True,
        "researcher_feedback": researcher_feedback,
        "pre_challenge_scores": pre_scores,
        "post_challenge_scores": post_scores,
        "score_delta": {
            k: round(post_scores[k] - pre_scores[k], 4)
            for k in pre_scores
        },
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
