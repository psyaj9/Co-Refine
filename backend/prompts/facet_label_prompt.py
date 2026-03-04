"""Prompt builder for AI-powered facet label suggestions."""


def build_facet_label_prompt(
    code_label: str,
    code_definition: str | None,
    facets: list[dict],
) -> list[dict]:
    """Build a messages list for facet label suggestion.

    Args:
        code_label: The parent code's label (e.g. "Grief").
        code_definition: The code's definition or lens text, if available.
        facets: List of dicts, each with:
            - facet_index: int
            - segments: list of str (3–5 representative segment texts)

    Returns:
        A messages list suitable for call_llm().
    """
    definition_block = (
        f"\nCode definition: {code_definition}" if code_definition else ""
    )

    facet_blocks = []
    for f in facets:
        texts = "\n".join(f"  - {t}" for t in f["segments"])
        facet_blocks.append(f"Group {f['facet_index']}:\n{texts}")

    facets_section = "\n\n".join(facet_blocks)

    system = (
        "You are a qualitative research assistant helping analyse sub-themes within a coding scheme. "
        "Respond ONLY with valid JSON matching the schema provided."
    )

    user = (
        f"Parent code: {code_label}{definition_block}\n\n"
        "The following groups of text segments have been clustered together by semantic similarity. "
        "Each group represents a latent sub-theme within the parent code.\n\n"
        f"{facets_section}\n\n"
        "For each group, suggest a concise 2–5 word descriptive label that captures the shared semantic "
        "theme. Explain your reasoning briefly (1 sentence).\n\n"
        "Respond with JSON:\n"
        '{"facets": [{"facet_index": 0, "suggested_label": "...", "reasoning": "..."}]}'
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
