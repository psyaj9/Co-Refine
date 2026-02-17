"""
JSON parsing utilities for handling AI model responses.
"""

import json
import re
from typing import Any


def parse_json_response(response_text: str) -> dict[str, Any]:
    """
    Robustly parse JSON from model response, handling markdown backticks.
    """
    result = _try_direct_parse(response_text)
    if result is not None:
        return result

    result = _try_markdown_extraction(response_text)
    if result is not None:
        return result

    result = _try_pattern_extraction(response_text)
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
        "definition": "Unable to parse response",
        "lens": "Unable to parse response",
        "reasoning": f"Raw response: {truncated}",
    }
