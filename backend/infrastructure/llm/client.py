"""Azure OpenAI LLM client adapter.

Owns the HTTP connection singleton and the core call wrapper that all
feature-level callers (ai_analyzer, chat service) use.
"""

from openai import AzureOpenAI

from core.config import settings
from infrastructure.llm.json_parser import parse_json_response, PARSE_FAILED_SENTINEL

_client: AzureOpenAI | None = None


def get_client() -> AzureOpenAI:
    """Return the lazily-initialised AzureOpenAI singleton."""
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=settings.azure_api_key,
            azure_endpoint=settings.azure_endpoint,
            api_version=settings.azure_api_version,
        )
    return _client


def call_llm(
    prompt: str | list[dict],
    model: str | None = None,
    retries: int = 1,
) -> dict:
    """Call the LLM and return a parsed JSON dict.

    Args:
        prompt: Either a plain string (wrapped to user message) or a full
                messages list (system + user, etc.).
        model:  Azure deployment name. Defaults to settings.azure_deployment_fast.
        retries: Number of additional attempts on parse failure.

    Returns:
        Parsed dict, or error sentinel dict on repeated parse failure.
    """
    client = get_client()
    deployment = model or settings.azure_deployment_fast

    messages: list[dict]
    if isinstance(prompt, str):
        messages = [{"role": "user", "content": prompt}]
    else:
        messages = prompt

    result: dict = {}
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

        print(f"[LLM] Parse failure (attempt {attempt + 1}) — raw: {raw[:500]}")

    return result
