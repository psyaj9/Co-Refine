"""Azure OpenAI chat completion client.

Thin wrapper around the openai SDK — keeps all the retry/parse logic in one
place so every feature that needs an LLM response just calls `call_llm()`.

The client is lazily initialised on first use (module-level singleton) so that
import time stays fast and misconfigured credentials don't blow up at startup.
"""

from openai import AzureOpenAI

from core.config import settings
from core.logging import get_logger
from infrastructure.llm.json_parser import parse_json_response, PARSE_FAILED_SENTINEL

logger = get_logger(__name__)

# Lazily created — avoids hammering the network or raising credential errors
# before the app has fully started.
_client: AzureOpenAI | None = None


def get_client() -> AzureOpenAI:
    """Return the module-level AzureOpenAI client, creating it on first call.

    Returns:
        A configured AzureOpenAI client instance.
    """
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
    """Send a prompt to Azure OpenAI and return a parsed JSON dict.

    Requests JSON mode from the API so the model is constrained to return
    valid JSON. Falls back to regex-based extraction if the raw text still
    can't be parsed directly.

    Args:
        prompt:  Either a plain string (wrapped into a user message) or an
                 already-structured messages list for multi-turn prompts.
        model:   Azure deployment name to use. Defaults to the fast deployment
                 from settings (gpt-4o-mini class).
        retries: How many additional attempts to make if parsing fails.
                 Total calls = 1 + retries.

    Returns:
        Parsed dict from the model response. On total parse failure every
        attempt returns a dict with ``definition == PARSE_FAILED_SENTINEL``
        so callers can detect the failure without catching exceptions.
    """
    client = get_client()
    # Default to the fast/cheap model; callers can pass the reasoning model
    # explicitly for the reflection stage.
    deployment = model or settings.azure_deployment_fast

    messages: list[dict]
    if isinstance(prompt, str):
        # Wrap bare strings so we don't have to repeat this boilerplate
        # everywhere a simple single-turn prompt is built.
        messages = [{"role": "user", "content": prompt}]
    else:
        messages = prompt

    result: dict = {}
    for attempt in range(1 + retries):
        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            # Constraining to json_object mode dramatically reduces parse failures,
            # but the model can still produce malformed JSON occasionally (e.g. it
            # sometimes wraps the response in a markdown code block).
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        result = parse_json_response(raw)

        # PARSE_FAILED_SENTINEL on the "definition" key is how json_parser
        # signals a complete failure — if we didn't hit that, we're done.
        if result.get("definition") != PARSE_FAILED_SENTINEL:
            return result

        logger.warning("LLM parse failure", extra={"attempt": attempt + 1, "raw": raw[:500]})

    # Return whatever the last attempt produced (a sentinel error dict) so
    # callers can log/handle it rather than receiving None.
    return result
