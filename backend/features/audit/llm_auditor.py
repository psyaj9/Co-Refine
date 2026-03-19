"""LLM-backed audit functions shared across all audit flows.

Both the per-segment audit and the batch audit call into this module. 
Keeping the LLM calls in one place means prompt changes and model selection only need to happen here.

Two entry points:
  - `analyse_quotes`: generates an AI-derived definition + lens for a code by looking at all its segments together.
  - `run_coding_audit`: audits a single new segment against the existing coding history, returning a consistency verdict and alternative suggestions.
"""
from __future__ import annotations

from core.config import settings
from infrastructure.llm.client import call_llm
from prompts.analysis_prompt import build_analysis_prompt
from prompts.audit_prompt import build_coding_audit_prompt


_ORDINAL_SCORE_MAP = {"high": 0.9, "medium": 0.6, "low": 0.3}

def _to_float(val: object, default: float = 0.5) -> float:
    """Convert LLM returned value for a score field to a plain float.

    The LLM might return some form of value. But float value required.

    Args:
        val: The raw value from the LLM response dict.
        default: What to return if conversion fails entirely.

    Returns:
        A float, always. Falls back to `default` on parse failure.
    """
    if val is None:
        return default

    if isinstance(val, (int, float)):
        return float(val)

    if isinstance(val, str) and val.lower() in _ORDINAL_SCORE_MAP:
        return _ORDINAL_SCORE_MAP[val.lower()]

    try:
        return float(val)

    except (ValueError, TypeError):
        return default


def analyse_quotes(
    code_label: str,
    quotes: list[str],
    user_definition: str | None = None,
) -> dict:
    """Ask LLM to create a definition and theoretical lens for a code.

    Looks at all the segments that have been assigned this code and produces:
    - A concise definition of what the code means based on actual usage.
    - A "lens" — the theoretical framing the researcher seems to be applying.
    - Reasoning explaining how the definition was derived.

    Uses the reasoning model because this is a reflective synthesis task.

    Args:
        code_label: The name of the code being analysed.
        quotes: All text segments currently assigned this code.
        user_definition: The researcher's own definition, if written.
            Passed to the prompt so the LLM can compare and flag divergence.

    Returns:
        Parsed dict from the LLM with keys: definition, lens, reasoning.
        On parse failure, definition will equal PARSE_FAILED_SENTINEL.
    """
    prompt = build_analysis_prompt(code_label, quotes, user_definition=user_definition)
    return call_llm(prompt, model=settings.azure_deployment_reasoning)


def run_coding_audit(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
    centroid_similarity: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> dict:
    """Audit a single new coded segment against the researcher's coding history.

    This is the core audit call. The LLM gets the new quote, the proposed code,
    the full codebook context, and the Stage 1 deterministic scores so it can give an informed consistency verdict.

    Deterministic scores are passed in rather than computed here because the
    orchestrator already computed them for Stage 1.

    Uses the reasoning model because subtle consistency judgements benefit from deeper analysis.

    Args:
        user_history: Previous (code, text) pairs from the researcher's coding
            history for this code, used as reference examples.
        code_definitions: AI codebook: label → {definition, lens}.
        new_quote: The text of the segment being audited.
        proposed_code: The code the researcher assigned to this segment.
        document_context: A few sentences of surrounding text for context.
        user_code_definitions: Researcher-authored definitions for all codes.
            Used so the LLM knows the researcher's own intent.
        existing_codes_on_span: Any other codes already on the same text span.
            Helps flag redundant or conflicting co-coding.
        centroid_similarity: Cosine similarity to the code's mean embedding.
            None if not enough segments exist yet.
        temporal_drift: Cosine distance between oldest and newest segment
            centroids — a signal that the code's meaning is shifting.
        is_pseudo_centroid: True if centroid_similarity was computed against
            the code definition embedding rather than actual segment embeddings.
        segment_count: How many segments are assigned this code so far.
            Context for the LLM when evaluating consistency.

    Returns:
        Parsed dict from the LLM with keys including: self_lens,
        overall_severity_score, and alternatives. On parse failure,
        contains a PARSE_FAILED_SENTINEL marker.
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
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
    )

    result = call_llm(messages, model=settings.azure_deployment_reasoning)

    return result
