"""Robust JSON extraction from LLM responses.

LLMs don't always return clean JSON even when asked nicely. This module tries
three progressively looser extraction strategies before giving up:

  1. Direct parse — works when the model behaves itself.
  2. Markdown fence extraction — catches ```json ... ``` blocks.
  3. Brace-pattern extraction — last resort: grabs the first {...} blob.

If all three fail, ``_create_error_response`` returns a sentinel dict so
callers can detect the failure without catching exceptions.

The ``<think>`` stripping handles reasoning-model outputs (e.g. o1, DeepSeek R1)
that prepend a chain-of-thought block before the actual JSON.
"""

import json
import re
from typing import Any


# Callers check ``result.get("definition") == PARSE_FAILED_SENTINEL`` to detect
# a failed parse without having to catch exceptions.
PARSE_FAILED_SENTINEL = "Unable to parse response"


def parse_json_response(response_text: str) -> dict[str, Any]:
    """Extract a JSON dict from a raw LLM response string.

    Strips reasoning-model ``<think>`` blocks first, then tries three
    extraction strategies in order of strictness.

    Args:
        response_text: Raw string from the model's message content.

    Returns:
        Parsed dict on success, or a sentinel error dict if all strategies fail.
    """
    # Strip completed <think>...</think> blocks from reasoning models.
    # The second regex catches unclosed blocks (model got cut off mid-think).
    text = re.sub(r"<\s*think\s*>[\s\S]*?<\s*/\s*think\s*>", "", response_text, flags=re.IGNORECASE).strip()
    text = re.sub(r"<\s*think\s*>[\s\S]*$", "", text, flags=re.IGNORECASE).strip()
    if not text:
        return _create_error_response(response_text)

    result = _try_direct_parse(text)
    if result is not None:
        return result

    result = _try_markdown_extraction(text)
    if result is not None:
        return result

    result = _try_pattern_extraction(text)
    if result is not None:
        return result

    return _create_error_response(response_text)


def _try_direct_parse(text: str) -> dict | None:
    """Try parsing the whole text as JSON directly.

    Args:
        text: Cleaned response text.

    Returns:
        Parsed dict, or None if parsing fails.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _try_markdown_extraction(text: str) -> dict | None:
    """Try extracting JSON from a markdown code fence (``` or ```json).

    Some models wrap their JSON in a code block even when asked not to.

    Args:
        text: Cleaned response text.

    Returns:
        Parsed dict, or None if no code fence found or its contents aren't valid JSON.
    """
    try:
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if json_match:
            return json.loads(json_match.group(1))
    except json.JSONDecodeError:
        pass
    return None


def _try_pattern_extraction(text: str) -> dict | None:
    """Try extracting the first {...} blob from anywhere in the text.

    Last resort — handles responses where the model emits prose before or
    after the JSON object.

    Args:
        text: Cleaned response text.

    Returns:
        Parsed dict, or None if no valid JSON object is found.
    """
    try:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            return json.loads(json_match.group(0))
    except json.JSONDecodeError:
        pass
    return None


def _create_error_response(response_text: str) -> dict:
    """Build a sentinel error dict that callers can detect and log.

    Truncates the raw response to 500 chars so it's safe to include in logs
    without flooding them.

    Args:
        response_text: The original (un-cleaned) response from the model.

    Returns:
        Dict with ``definition`` set to ``PARSE_FAILED_SENTINEL`` and the
        truncated raw response in ``reasoning`` for debugging.
    """
    truncated = response_text[:500] + "..." if len(response_text) > 500 else response_text
    return {
        "definition": PARSE_FAILED_SENTINEL,
        "lens": PARSE_FAILED_SENTINEL,
        # Include the raw text so engineers can diagnose which prompts are
        # producing unparseable outputs without needing to reproduce the call.
        "reasoning": f"Raw response: {truncated}",
    }
