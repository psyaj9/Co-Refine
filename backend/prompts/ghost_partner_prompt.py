GHOST_PARTNER_PROMPT_TEMPLATE = """
Role: You are a "Ghost Partner" — simulating how another researcher would code a piece of text based on established coding patterns and the project's codebook.

{document_context_section}

---

CODEBOOK (the researcher's codes with their definitions):
{codebook_section}

---

Partner's Coding History:
{partner_history}

---

SEGMENT TO CODE:
"{new_quote}"

The Active User wants to code this as: "{user_proposed_code}"

---

Your Task:
1. Review the codebook definitions to understand what each code means
2. Analyze the Partner's coding patterns for consistency with those definitions
3. Consider the surrounding context — sarcasm, subtext, narrative flow
4. Predict what code the Partner would assign based on the codebook + patterns
5. Flag any conflict with the Active User's choice

Return JSON:
{{
    "predicted_code": "The code the Partner would likely use",
    "confidence": "high/medium/low",
    "is_conflict": true or false,
    "reasoning": "Step-by-step explanation based on codebook definitions and Partner's patterns",
    "conflict_explanation": "Why the Partner would disagree, or empty string if no conflict"
}}
"""


def build_ghost_partner_prompt(
    partner_history: list[tuple[str, str]],
    new_quote: str,
    user_proposed_code: str,
    document_context: str = "",
    codebook: dict[str, str] | None = None,
) -> str:
    if not partner_history:
        history_str = "No coding history available for the Partner."
    else:
        history_lines = []
        for code, quote in partner_history:
            display_quote = quote[:200] + "..." if len(quote) > 200 else quote
            history_lines.append(f'- Code: "{code}" → Quote: "{display_quote}"')
        history_str = "\n".join(history_lines)

    if document_context:
        document_context_section = (
            f"SURROUNDING CONTEXT (>>> marks the highlighted segment <<<):\n"
            f'"""\n{document_context}\n"""'
        )
    else:
        document_context_section = "(No document context provided)"

    # --- Build codebook section ---
    if codebook:
        codebook_lines = []
        for code_label, definition in codebook.items():
            if definition:
                codebook_lines.append(f"- **{code_label}**: {definition}")
            else:
                codebook_lines.append(f"- **{code_label}**: (No definition provided)")
        codebook_section = "\n".join(codebook_lines)
    else:
        codebook_section = "(No codebook definitions available — predict based on patterns only)"

    return GHOST_PARTNER_PROMPT_TEMPLATE.format(
        document_context_section=document_context_section,
        codebook_section=codebook_section,
        partner_history=history_str,
        new_quote=new_quote,
        user_proposed_code=user_proposed_code,
    )
