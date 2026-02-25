CODING_AUDIT_PROMPT_TEMPLATE = """
Role: You are an expert Qualitative Research Auditor reviewing a new coding decision from two complementary perspectives simultaneously:
  1. SELF-CONSISTENCY — did the researcher apply this code consistently with their own past decisions?
  2. INTER-RATER RELIABILITY — what would an independent second researcher code this segment as?

---

SURROUNDING CONTEXT (>>> marks the highlighted segment <<<):
{document_context_section}

---

THE RESEARCHER'S CODEBOOK (authoritative — researcher-supplied definitions):
{user_definitions}

AI-INFERRED DEFINITIONS (supplementary — inferred from observed coding patterns):
{ai_definitions}

NOTE: Treat researcher-supplied definitions as canonical. AI-inferred definitions are supplementary
and may capture emergent patterns, but the researcher's intent takes precedence.

---

CODING HISTORY ({history_count} segments, sampled for diversity):
{user_history}

---

NEW CODING DECISION TO AUDIT:
Segment: "{new_quote}"
Researcher's Proposed Code: "{proposed_code}"

{co_applied_section}

---

Your Task:
Perform TWO analyses and return them together in a single JSON response.

**LENS 1 — SELF-CONSISTENCY:**
1. Does this segment match the researcher's own definition of "{proposed_code}" (or the AI-inferred definition if none)?
2. Compare against the coding history — has this code been applied to similar material before?
3. Is there any drift or inconsistency in how this code is being applied over time?
4. Are there better-fitting codes from the codebook? (NEVER suggest codes already applied to this segment)

**LENS 2 — INTER-RATER (Independent Researcher Simulation):**
1. Based on the codebook definitions and the coding history as representative examples, which code would an independent researcher assign?
2. Does this differ from the researcher's proposed code AND all codes already applied to this segment?
3. If so, flag it as a conflict and explain the disagreement.

Guidelines:
- Only flag TRUE inconsistencies — minor variation is normal in qualitative coding
- For alternative_codes, NEVER include: {co_applied_label_list}
- overall_severity should reflect the most serious issue found across both lenses
- If the inter_rater predicted_code matches any code already applied to this segment, set is_conflict to false

Return JSON:
{{
    "self_lens": {{
        "is_consistent": true or false,
        "consistency_score": "high/medium/low",
        "reasoning": "Why this is or isn't consistent with established patterns",
        "definition_match": "How well this segment matches the code definition",
        "drift_warning": "How their interpretation seems to be shifting, or empty string",
        "alternative_codes": ["Better-fitting codes NOT already applied to this segment, if any"],
        "suggestion": "Brief constructive suggestion for the researcher"
    }},
    "inter_rater_lens": {{
        "predicted_code": "The code an independent researcher would likely assign",
        "confidence": "high/medium/low",
        "is_conflict": true or false,
        "reasoning": "Step-by-step rationale based on codebook definitions and coding patterns",
        "conflict_explanation": "Why the second researcher would disagree, or empty string if no conflict"
    }},
    "overall_severity": "high/medium/low"
}}
"""


def build_coding_audit_prompt(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
) -> str:
    # Document context section
    document_context_section = (
        f'"""\n{document_context}\n"""' if document_context else "(No surrounding context)"
    )

    # Co-applied codes section
    all_applied = list({proposed_code} | set(existing_codes_on_span or []))
    if existing_codes_on_span:
        co_codes = ", ".join(f'"{c}"' for c in existing_codes_on_span)
        co_applied_section = (
            f"OTHER CODES ALREADY APPLIED TO THIS SEGMENT: {co_codes}\n"
            f"Do NOT suggest any of these as alternatives."
        )
    else:
        co_applied_section = "(No other codes applied to this segment)"

    co_applied_label_list = ", ".join(f'"{c}"' for c in all_applied) if all_applied else "(none)"

    # Researcher-supplied definitions (canonical codebook)
    if user_code_definitions:
        user_def_lines = [
            f"**{code}**: {defn}" if defn else f"**{code}**: (No definition provided)"
            for code, defn in user_code_definitions.items()
        ]
        user_definitions_str = "\n".join(user_def_lines)
    else:
        user_definitions_str = "(No researcher-supplied definitions yet)"

    # AI-inferred definitions (supplementary)
    if code_definitions:
        def_lines = []
        for code, analysis in code_definitions.items():
            def_lines.append(f"**{code}**:")
            def_lines.append(f"  - Definition: {analysis.get('definition', 'Not yet analysed')}")
            def_lines.append(f"  - Lens: {analysis.get('lens', 'Not yet analysed')}")
        ai_definitions_str = "\n".join(def_lines)
    else:
        ai_definitions_str = "(No AI-inferred definitions yet)"

    # History section
    if user_history:
        history_lines = []
        for code, quote in user_history:
            display = quote[:200] + "..." if len(quote) > 200 else quote
            history_lines.append(f'  - Code: "{code}" → "{display}"')
        history_str = "\n".join(history_lines)
    else:
        history_str = "  (No coding history available yet)"

    return CODING_AUDIT_PROMPT_TEMPLATE.format(
        document_context_section=document_context_section,
        user_definitions=user_definitions_str,
        ai_definitions=ai_definitions_str,
        history_count=len(user_history),
        user_history=history_str,
        new_quote=new_quote,
        proposed_code=proposed_code,
        co_applied_section=co_applied_section,
        co_applied_label_list=co_applied_label_list,
    )
