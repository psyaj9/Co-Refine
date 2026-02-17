import json
from openai import OpenAI

from config import settings
from prompts import (
    build_analysis_prompt,
    build_ghost_partner_prompt,
    build_self_consistency_prompt,
)
from utils import parse_json_response


def _get_client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )


def _call_llm(prompt: str, model: str | None = None) -> dict:
    client = _get_client()
    response = client.chat.completions.create(
        model=model or settings.fast_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return parse_json_response(response.choices[0].message.content or "")


def _call_llm_stream(prompt: str, model: str | None = None):
    client = _get_client()
    return client.chat.completions.create(
        model=model or settings.fast_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        stream=True,
    )


def analyze_quotes(code_label: str, quotes: list[str], user_definition: str | None = None) -> dict:
    prompt = build_analysis_prompt(code_label, quotes, user_definition=user_definition)
    return _call_llm(prompt, model=settings.reasoning_model)


def ghost_partner_predict(
    partner_history: list[tuple[str, str]],
    new_quote: str,
    user_proposed_code: str,
    document_context: str = "",
    codebook: dict[str, str] | None = None,
) -> dict:
    prompt = build_ghost_partner_prompt(
        partner_history, new_quote, user_proposed_code,
        document_context=document_context,
        codebook=codebook,
    )
    return _call_llm(prompt)


def check_self_consistency(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
) -> dict:
    prompt = build_self_consistency_prompt(
        user_history=user_history,
        code_definitions=code_definitions,
        new_quote=new_quote,
        proposed_code=proposed_code,
        document_context=document_context,
        user_code_definitions=user_code_definitions,
    )
    result = _call_llm(prompt)

    score = result.get("consistency_score", "high")
    score_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
    numeric_score = score_map.get(score, 0.5) if isinstance(score, str) else float(score)

    if numeric_score < settings.consistency_escalation_threshold:
        result = _call_llm(prompt, model=settings.reasoning_model)

    return result
