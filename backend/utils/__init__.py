"""
JSON parsing utilities for handling AI model responses.
"""

import json
import re
from typing import Any


PARSE_FAILED_SENTINEL = "Unable to parse response"


def parse_json_response(response_text: str) -> dict[str, Any]:
    """
    Robustly parse JSON from model response, handling markdown backticks
    and <think>...</think> reasoning blocks from Gemini 2.5 models.
    """
    # Strip closed <think>...</think> blocks (case-insensitive, handles whitespace)
    text = re.sub(r"<\s*think\s*>[\s\S]*?<\s*/\s*think\s*>", "", response_text, flags=re.IGNORECASE).strip()
    # Strip unclosed <think> blocks — everything from <think> to end of string
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
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _try_markdown_extraction(text: str) -> dict | None:
    try:
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if json_match:
            return json.loads(json_match.group(1))
    except json.JSONDecodeError:
        pass
    return None


def _try_pattern_extraction(text: str) -> dict | None:
    try:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            return json.loads(json_match.group(0))
    except json.JSONDecodeError:
        pass
    return None


def _create_error_response(response_text: str) -> dict:
    truncated = response_text[:500] + "..." if len(response_text) > 500 else response_text
    return {
        "definition": PARSE_FAILED_SENTINEL,
        "lens": PARSE_FAILED_SENTINEL,
        "reasoning": f"Raw response: {truncated}",
    }
