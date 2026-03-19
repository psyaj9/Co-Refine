"""
Prompts for ICR (Inter-Coder Reliability) LLM analysis.

This module builds the messages list for the on-demand disagreement analysis
feature. When a researcher asks the system to explain a specific disagreement,
this prompt presents the disagreement details and asks the LLM to:
1. Classify the root cause of the disagreement.
2. Reason step-by-step before producing structured output.
3. Recommend a specific resolution strategy.

Prompting approach: dedicated system message establishes the expert role,
the taxonomy of disagreement types, and the exact output schema. The user
message contains the disagreement data and a CoT chain that guides the LLM
through classification before writing JSON.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

# TYPE_CHECKING guard prevents circular imports — these types are only
# needed for type hints, not runtime behaviour
if TYPE_CHECKING:
    from features.icr.disagreements import Disagreement
    from core.models.user import User
    from core.models.code import Code


_ICR_SYSTEM_PROMPT = """\
You are an expert qualitative research methodologist specialising in intercoder reliability and disagreement resolution.

When analysing a coding disagreement, you consider four categories:
- BOUNDARY disagreement: coders identified different text spans (one coded more or less text than the other).
- ASSIGNMENT disagreement: same span, different codes chosen — the coders interpret the passage differently.
- COVERAGE GAP: one coder coded this passage; another skipped it entirely.
- DEFINITION AMBIGUITY: the code definition is broad enough that both choices are defensible — the issue is in the codebook, not coder error.

OUTPUT SCHEMA — return JSON with EXACTLY these keys:
{
  "analysis": "2\u20133 sentence explanation of why the disagreement occurred, written for the researcher",
  "root_cause": one of ["definition_ambiguity", "boundary_disagreement", "conceptual_overlap", "coverage_gap", "coder_error"],
  "resolution_type": one of ["prefer_code_a", "prefer_code_b", "create_new_code", "clarify_definition", "merge_codes", "no_change"],
  "recommendation": "One actionable sentence telling the researcher exactly what to do",
  "recommended_code": "The specific code label if resolution_type is prefer_code_a or prefer_code_b, otherwise null"
}

Write for a qualitative researcher. No jargon, no bullet points in the analysis field — plain prose only."""


def build_disagreement_analysis_prompt(
    disagreement: "Disagreement",
    users: dict,
    code_map: dict,
) -> list[dict]:
    """Build a messages list asking the LLM to explain a coding disagreement
    and recommend a structured resolution strategy.

    Formats the disagreement details in plain markdown so the LLM can
    reason about what each coder did (or didn't do) at this span.
    Returns a complete [system, user] messages list ready for call_llm().

    Args:
        disagreement: The Disagreement dataclass from features/icr/disagreements.py.
        users: Dict of user_id \u2192 User ORM object for display name lookups.
        code_map: Dict of code_id \u2192 Code ORM object for definition lookups.

    Returns:
        A messages list [system, user] ready for call_llm().
    """
    d = disagreement
    lines = [
        f"Disagreement type: **{d.disagreement_type.replace('_', ' ').title()}**",
        f"Text span: characters {d.span_start}\u2013{d.span_end}",
        "",
        "## Coder Assignments",
    ]

    for a in d.assignments:
        coder = users.get(a.coder_id)
        name = coder.display_name if coder else a.coder_id[:8]
        code = code_map.get(a.code_id)
        # Include code definition if available — helps the LLM reason about
        # why each code was chosen and where the ambiguity lies
        code_def = f" \u2014 *{code.definition}*" if code and code.definition else ""
        lines.append(f"- **{name}** applied code **\"{a.code_label}\"**{code_def}")

    if d.missing_coder_ids:
        # Coverage gap: some coders didn't code this span at all
        for uid in d.missing_coder_ids:
            coder = users.get(uid)
            name = coder.display_name if coder else uid[:8]
            lines.append(f"- **{name}** did NOT code this passage")

    lines += [
        "",
        "## Reasoning Steps — work through these before writing your JSON:",
        "1. What type of disagreement is this? (boundary, assignment, coverage gap, or definition ambiguity)",
        "2. Look at each code's definition — is the ambiguity in the definitions themselves, or in coder judgment?",
        "3. Which resolution approach best serves the researcher's codebook integrity?",
        "",
        "## Task",
        "Produce a JSON response matching the output schema in your system prompt exactly.",
        "The `analysis` field should be 2\u20133 sentences in plain prose explaining why the disagreement occurred.",
        "The `recommendation` field should be one actionable sentence telling the researcher what to do next.",
    ]

    user_msg = "\n".join(lines)

    return [
        {"role": "system", "content": _ICR_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
