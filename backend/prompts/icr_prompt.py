"""
Prompts for ICR (Inter-Coder Reliability) LLM analysis.

This module builds the prompt for the on-demand disagreement analysis feature.
When a researcher asks the system to explain a specific disagreement, this
prompt presents the disagreement details and asks the LLM to:
1. Explain why the coders might have disagreed.
2. Suggest a resolution strategy.
3. Recommend a specific code if applicable.

The output is intentionally brief (under 200 words) to keep it scannable.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

# TYPE_CHECKING guard prevents circular imports — these types are only
# needed for type hints, not runtime behaviour
if TYPE_CHECKING:
    from features.icr.disagreements import Disagreement
    from core.models.user import User
    from core.models.code import Code


def build_disagreement_analysis_prompt(
    disagreement: "Disagreement",
    users: dict,
    code_map: dict,
) -> str:
    """Build a prompt asking the LLM to explain a coding disagreement and
    suggest a resolution strategy.

    Formats the disagreement details in plain markdown so the LLM can
    reason about what each coder did (or didn't do) at this span.

    Args:
        disagreement: The Disagreement dataclass from features/icr/disagreements.py.
        users: Dict of user_id → User ORM object for display name lookups.
        code_map: Dict of code_id → Code ORM object for definition lookups.

    Returns:
        A formatted user message string, ready to combine with a system prompt.
    """
    d = disagreement
    lines = [
        "You are reviewing a disagreement between qualitative coders.",
        "",
        f"Disagreement type: **{d.disagreement_type.replace('_', ' ').title()}**",
        f"Text span: characters {d.span_start}–{d.span_end}",
        "",
        "## Coder Assignments",
    ]

    for a in d.assignments:
        coder = users.get(a.coder_id)
        name = coder.display_name if coder else a.coder_id[:8]
        code = code_map.get(a.code_id)
        # Include code definition if available — helps the LLM reason about
        # why each code was chosen and where the ambiguity lies
        code_def = f" — *{code.definition}*" if code and code.definition else ""
        lines.append(f"- **{name}** applied code **\"{a.code_label}\"**{code_def}")

    if d.missing_coder_ids:
        # Coverage gap: some coders didn't code this span at all
        for uid in d.missing_coder_ids:
            coder = users.get(uid)
            name = coder.display_name if coder else uid[:8]
            lines.append(f"- **{name}** did NOT code this passage")

    lines += [
        "",
        "## Task",
        "1. Briefly explain WHY these coders might have disagreed (2–3 sentences).",
        "2. Suggest a resolution strategy: should one code be preferred, should a new code be created, "
           "or should the codebook definition be clarified?",
        "3. If you recommend a specific code, state it clearly.",
        "",
        "Be concise (under 200 words). Write in plain paragraphs, no bullet points.",
        "",
        'Respond with a JSON object: {"analysis": "<your response here>"}',
    ]

    return "\n".join(lines)
