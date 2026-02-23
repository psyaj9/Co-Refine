import json
from typing import Generator
from openai import OpenAI

from config import settings
from prompts import (
    build_analysis_prompt,
    build_ghost_partner_prompt,
    build_self_consistency_prompt,
)
from utils import parse_json_response, PARSE_FAILED_SENTINEL

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=settings.gemini_api_base,
            api_key=settings.gemini_api_key,
        )
    return _client


def _call_llm(prompt: str, model: str | None = None, retries: int = 1) -> dict:
    client = _get_client()
    use_model = model or settings.fast_model

    for attempt in range(1 + retries):
        response = client.chat.completions.create(
            model=use_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        result = parse_json_response(raw)

        if result.get("definition") != PARSE_FAILED_SENTINEL:
            return result

        # Log the failed parse for debugging
        print(f"[LLM] Parse failure (attempt {attempt + 1}) — raw response: {raw[:500]}")

    # All retries exhausted — return the error dict
    return result


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


def stream_chat_response(
    messages: list[dict],
    model: str | None = None,
) -> Generator[str, None, None]:
    """Stream chat tokens from Gemini. Yields text chunks as they arrive.
    Strips any leading <think>...</think> block automatically."""
    client = _get_client()
    response = client.chat.completions.create(
        model=model or settings.fast_model,
        messages=messages,
        stream=True,
    )

    in_think_block = False
    think_ended = False

    for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if not delta or not delta.content:
            continue
        token = delta.content

        # Strip <think>...</think> blocks from Gemini 2.5
        if not think_ended:
            if "<think>" in token:
                in_think_block = True
                # Remove the <think> tag from the token
                token = token.split("<think>", 1)[0]
                if token:
                    yield token
                continue
            if in_think_block:
                if "</think>" in token:
                    in_think_block = False
                    think_ended = True
                    # Yield any text after </think>
                    after = token.split("</think>", 1)[1]
                    if after:
                        yield after
                continue

        yield token
