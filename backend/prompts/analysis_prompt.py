"""
Analysis prompt builder — generates the prompt for code-level segment analysis.

This prompt asks the LLM to infer what operational definition a researcher is
implicitly using based on their actual coding patterns. It optionally compares
that inference against the researcher's stated definition to surface drift or
divergence.

Prompting approach: system message establishes the WHAT/WHEN/HOW/BOUNDARY
four-component framework with a worked example; the user message asks the LLM
to apply that framework step-by-step before synthesising a definition.

Used by features/audit/ when a segment reaches the threshold for analysis.
"""

_ANALYSIS_SYSTEM_PROMPT = """\
You are an expert Qualitative Research Methodologist specialising in inductive thematic analysis.

When analysing a researcher's coding patterns, you use the WHAT/WHEN/HOW/BOUNDARY framework:
- WHAT: What phenomenon or construct does this code capture?
- WHEN: Under what conditions does this code apply (what triggers it)?
- HOW: What is the interpretive lens — what theoretical framing explains why these quotes were grouped?
- BOUNDARY: What does this code explicitly exclude? What would NOT qualify?

WORKED EXAMPLE:
Code: "Coping Avoidance" (8 segments)
Quotes include: "I just kept busy", "I stopped watching the news", "We just didn't talk about it"

WHAT: Deliberate psychological distancing from a stressor.
WHEN: Applies when the participant describes actively redirecting attention or suppressing engagement with a difficult topic.
HOW: Phenomenological lens — the researcher is capturing first-person experience of avoidance, not attribution by others or third-party observation.
BOUNDARY: Excludes passive forgetting; excludes coping-through-action where activity is the goal rather than avoidance of something else (separate code).

Synthesised definition: "Instances where the participant describes intentionally avoiding engagement with a stressor — through distraction, silence, or withdrawal — as a self-protective strategy."
Lens: "Phenomenological — capturing first-person experience of deliberate avoidance, not externally attributed behaviour."

Always return valid JSON with exactly these keys: definition, lens, reasoning."""


def build_analysis_prompt(
    code_label: str,
    quotes: list[str],
    user_definition: str | None = None,
) -> list[dict]:
    """Build the analysis messages list for a given code and its segments.

    Uses a structured system message (WHAT/WHEN/HOW/BOUNDARY framework with
    a worked example) plus a user message that directs step-by-step reasoning
    before synthesising the final definition.

    If the researcher provided a definition, it becomes the baseline for
    comparison. Without one, the LLM infers the definition entirely from
    the coding patterns.

    Args:
        code_label: The label of the code being analysed (e.g. "Grief").
        quotes: List of text segments coded under this code.
        user_definition: The researcher's own definition, if provided.

    Returns:
        A messages list [system, user] ready to send to call_llm().
    """
    formatted_quotes = "\n".join([f'- "{q}"' for q in quotes])
    quote_count = len(quotes)

    if user_definition:
        user_definition_section = (
            f"The researcher's stated definition for this code:\n"
            f'"{user_definition}"\n\n'
            f"Use this as the canonical baseline. Your analysis should note where actual "
            f"coding patterns align with, extend, or diverge from this stated definition."
        )
    else:
        user_definition_section = (
            "(No researcher-supplied definition. Infer the definition entirely from the coding patterns.)"
        )

    user_message = (
        f"Analyse the following {quote_count} segment(s) coded under: \"{code_label}\"\n\n"
        f"{user_definition_section}\n\n"
        f"Segments:\n{formatted_quotes}\n\n"
        f"Using the WHAT/WHEN/HOW/BOUNDARY framework:\n"
        f"1. Work through WHAT, WHEN, HOW, and BOUNDARY for this code based on the observed patterns.\n"
        f"2. Synthesise these into a precise operational definition (2\u20133 sentences).\n"
        f"3. State the interpretive Lens in one sentence.\n"
        f"4. Explain your step-by-step reasoning.\n\n"
        f"Return JSON:\n"
        f'{{\"definition\": \"...\", \"lens\": \"...\", \"reasoning\": \"...\"}}'
    )

    return [
        {"role": "system", "content": _ANALYSIS_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
