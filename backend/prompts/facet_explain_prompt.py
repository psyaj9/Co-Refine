"""Prompt builder: asks the LLM to explain the semantic theme unifying a facet's segments."""


def build_facet_explain_prompt(
    facet_label: str,
    code_name: str,
    segment_texts: list[str],
) -> list[dict]:
    """Build a messages list for facet explanation.

    Args:
        facet_label: The facet's label (e.g. "Household activity mentions").
        code_name: The parent code's label (e.g. "Work").
        segment_texts: List of raw segment texts belonging to this facet (up to 8).

    Returns:
        A messages list suitable for call_llm().
    """
    texts_block = "\n".join(f"  - {t[:200]}" for t in segment_texts[:8])

    system = (
        "You are a qualitative research assistant analysing coded text segments. "
        "Respond ONLY with valid JSON matching the schema provided."
    )

    user = (
        f'Parent code: "{code_name}"\n'
        f'Facet label: "{facet_label}"\n\n'
        "The following text segments have been clustered together under this facet "
        "because they share a latent semantic pattern:\n\n"
        f"{texts_block}\n\n"
        "In 2–3 sentences, explain what common theme, pattern, or semantic feature "
        "connects these segments within the context of the parent code. "
        "Be specific and grounded in the texts above.\n\n"
        'Respond with JSON: {"explanation": "..."}'
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
