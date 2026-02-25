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


def _call_llm(prompt: str, model: str | None = None, retries: int = 1) -> dict:
    client = _get_client()
    deployment = model or settings.azure_deployment_fast

    for attempt in range(1 + retries):
        response = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
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
) -> dict:
    """Merged coding audit: runs self-consistency and inter-rater checks in a single LLM call.

    Returns a dict with keys:
      self_lens: { is_consistent, consistency_score, reasoning, definition_match,
                   drift_warning, alternative_codes, suggestion }
      inter_rater_lens: { predicted_code, confidence, is_conflict, reasoning,
                          conflict_explanation }
      overall_severity: 'high' | 'medium' | 'low'
    """
    prompt = build_coding_audit_prompt(
        user_history=user_history,
        code_definitions=code_definitions,
        new_quote=new_quote,
        proposed_code=proposed_code,
        document_context=document_context,
        user_code_definitions=user_code_definitions,
        existing_codes_on_span=existing_codes_on_span,
    )
    result = _call_llm(prompt)

    # Escalate to reasoning model if severity is high or self-lens score is low
    severity = result.get("overall_severity", "medium")
    self_score = result.get("self_lens", {}).get("consistency_score", "medium")
    score_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
    numeric_score = score_map.get(self_score, 0.5) if isinstance(self_score, str) else float(self_score)

    if severity == "high" or numeric_score < settings.consistency_escalation_threshold:
        result = _call_llm(prompt, model=settings.azure_deployment_reasoning)

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
