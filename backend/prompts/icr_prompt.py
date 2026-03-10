"""
Prompts for ICR (Inter-Coder Reliability) LLM analysis.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from features.icr.disagreements import Disagreement
    from core.models.user import User
    from core.models.code import Code


def build_disagreement_analysis_prompt(
    disagreement: "Disagreement",
    users: dict,
    code_map: dict,
) -> str:
    """
    Build a prompt asking the LLM to explain a coding disagreement and
    suggest a resolution strategy.
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
        code_def = f" — *{code.definition}*" if code and code.definition else ""
        lines.append(f"- **{name}** applied code **\"{a.code_label}\"**{code_def}")

    if d.missing_coder_ids:
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
    ]

    return "\n".join(lines)
