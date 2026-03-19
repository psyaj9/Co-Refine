"""
Analysis prompt builder — generates the prompt for code-level segment analysis.

This prompt asks the LLM to infer what operational definition a researcher is
implicitly using based on their actual coding patterns. It optionally compares
that inference against the researcher's stated definition to surface drift or
divergence.

Used by features/audit/ when a segment reaches the threshold for analysis.
"""

# The main analysis template. Uses .format() placeholders so it stays readable
# while still being parameterised. Note the doubled {{ }} for literal braces
# in the JSON schema block.
ANALYSIS_PROMPT_TEMPLATE = """
Role: You are an expert Qualitative Researcher specialising in thematic analysis and codebook development.

Task: Review the following quotes that the user has tagged with the code: '{code_label}'.

{user_definition_section}

Quotes:
{formatted_quotes}

Your analysis should:
1. Identify the latent theme connecting these quotes
2. Infer the operational definition the user is implicitly applying based on their coding patterns
3. Compare your inferred definition with the researcher's own definition (if provided) — note any divergence, emergent sub-themes, or drift
4. Explain the "Interpretive Lens" — why did they include these specific quotes?

Return your analysis in JSON format:
{{
    "definition": "A precise, operational definition of the code based on the patterns observed. If the researcher supplied a definition, note where practice aligns or diverges from it.",
    "lens": "The interpretive framework or perspective the researcher appears to be using",
    "reasoning": "Your step-by-step reasoning explaining how you arrived at this definition and lens"
}}
"""


def build_analysis_prompt(
    code_label: str,
    quotes: list[str],
    user_definition: str | None = None,
) -> str:
    """Build the analysis prompt string for a given code and its segments.

    If the researcher provided a definition, it becomes the baseline for
    comparison. Without one, the LLM infers the definition entirely from
    the coding patterns.

    Args:
        code_label: The label of the code being analysed (e.g. "Grief").
        quotes: List of text segments coded under this code.
        user_definition: The researcher's own definition, if provided.

    Returns:
        A formatted prompt string ready to send to the LLM.
    """
    formatted_quotes = "\n".join([f'- "{q}"' for q in quotes])

    if user_definition:
        # Give the LLM the researcher's stated definition as a reference point
        # so it can comment on alignment and divergence specifically
        user_definition_section = (
            f"The researcher's own definition for this code:\n"
            f'"{user_definition}"\n\n'
            f"Use this as the baseline — your analysis should supplement it by\n"
            f"identifying how their actual coding patterns align with, extend, or\n"
            f"diverge from this stated definition."
        )
    else:
        user_definition_section = (
            "(No researcher-supplied definition. Infer the definition entirely from the coding patterns.)"
        )

    return ANALYSIS_PROMPT_TEMPLATE.format(
        code_label=code_label,
        user_definition_section=user_definition_section,
        formatted_quotes=formatted_quotes,
    )
