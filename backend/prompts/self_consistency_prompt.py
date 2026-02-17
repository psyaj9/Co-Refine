SELF_CONSISTENCY_PROMPT_TEMPLATE = """
Role: You are an expert Qualitative Researcher helping ensure coding consistency.

---

SURROUNDING CONTEXT (>>> marks the highlighted segment <<<):
{document_context_section}

---

THE RESEARCHER'S CODEBOOK (authoritative definitions supplied by the researcher):
{user_definitions}

AI-INFERRED DEFINITIONS AND INTERPRETIVE LENSES (supplementary — inferred from coding patterns):
{ai_definitions}

NOTE: When a researcher-supplied definition exists for a code, treat it as the
canonical meaning. The AI-inferred definition is a complementary reflection that
may capture emergent patterns, but the researcher's intent takes precedence.

---

CODING HISTORY (past decisions):
{user_history}

---

NEW CODING DECISION TO EVALUATE:
Segment: "{new_quote}"
Proposed Code: "{proposed_code}"

---

Your Task:
1. Review the researcher's definition for "{proposed_code}" — does this segment match?
2. If no researcher definition exists, fall back to the AI-inferred definition and lens
3. Compare with how they have previously applied this code
4. Determine if this segment fits the established pattern
5. Consider if another existing code (from the codebook) might be a better fit
6. Flag any drift from established patterns

Only flag true inconsistencies — minor variations are normal in qualitative coding.

Return JSON:
{{
    "is_consistent": true or false,
    "consistency_score": "high/medium/low",
    "reasoning": "Why this is or isn't consistent with established patterns",
    "definition_match": "How well this segment matches the code definition (researcher or inferred)",
    "lens_alignment": "Does this coding align with their interpretive lens?",
    "alternative_codes": ["Better-fitting codes from their codebook, if any"],
    "drift_warning": "How their interpretation seems to be shifting, or empty string",
    "suggestion": "Brief constructive suggestion for the researcher"
}}
"""


def build_self_consistency_prompt(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
) -> str:
    document_context_section = f'"""\n{document_context}\n"""' if document_context else "(No context)"

    # --- User-supplied definitions (canonical codebook) ---
    if user_code_definitions:
        user_def_lines = []
        for code, definition in user_code_definitions.items():
            if definition:
                user_def_lines.append(f"**{code}**: {definition}")
            else:
                user_def_lines.append(f"**{code}**: (No definition provided by researcher)")
        user_definitions_str = "\n".join(user_def_lines)
    else:
        user_definitions_str = "(No researcher-supplied definitions yet)"

    # --- AI-inferred definitions (supplementary) ---
    if code_definitions:
        def_lines = []
        for code, analysis in code_definitions.items():
            def_lines.append(f"**{code}**:")
            def_lines.append(f"  - Definition: {analysis.get('definition', 'Not yet analysed')}")
            def_lines.append(f"  - Lens: {analysis.get('lens', 'Not yet analysed')}")
            def_lines.append("")
        ai_definitions_str = "\n".join(def_lines)
    else:
        ai_definitions_str = "(No AI-inferred definitions yet)"

    if user_history:
        history_by_code: dict[str, list[str]] = {}
        for code, quote in user_history:
            if code not in history_by_code:
                history_by_code[code] = []
            display_quote = quote[:200] + "..." if len(quote) > 200 else quote
            history_by_code[code].append(display_quote)

        history_lines = []
        for code, quotes in history_by_code.items():
            history_lines.append(f"**{code}** ({len(quotes)} segments):")
            for i, quote in enumerate(quotes[:5], 1):
                history_lines.append(f'  {i}. "{quote}"')
            if len(quotes) > 5:
                history_lines.append(f"  ... and {len(quotes) - 5} more")
            history_lines.append("")
        history_str = "\n".join(history_lines)
    else:
        history_str = "(No coding history yet)"

    return SELF_CONSISTENCY_PROMPT_TEMPLATE.format(
        document_context_section=document_context_section,
        user_definitions=user_definitions_str,
        ai_definitions=ai_definitions_str,
        user_history=history_str,
        new_quote=new_quote,
        proposed_code=proposed_code,
    )
