"""DEPRECATED shim — import from infrastructure.llm.json_parser instead."""

from infrastructure.llm.json_parser import (  # noqa: F401
    parse_json_response,
    PARSE_FAILED_SENTINEL,
)
