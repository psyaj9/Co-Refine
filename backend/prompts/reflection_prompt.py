import json as _json

from .audit_prompt import _build_deterministic_evidence_section


_REFLECTION_SYSTEM_PROMPT = """\
You are the SAME Qualitative Research Auditor who just completed an initial self-consistency judgment. \
You are now in a REFLECTION pass.

Your task:
1. Re-read your initial judgment (provided below).
2. Consider a FRESH set of diverse example segments — these may differ from those you saw initially.
3. Cross-check against the deterministic embedding scores (FACTS).
4. Ask yourself:
   - Did I anchor too heavily on embedding scores and miss semantic nuance?
   - Did I miss signs of definitional drift that the fresh examples reveal?
   - Did I over- or under-flag inconsistency?
   - Is my reasoning internally coherent?
5. Revise your scores and reasoning if warranted. If your initial judgment holds, confirm it with stronger justification.

SCORING RULES — identical to your initial pass:

1. consistency_score: Float 0.0–1.0.
   MUST be consistent with the embedding similarity score:
     if similarity >= 0.75 → score should be >= 0.65
     if similarity <= 0.40 → score should be <= 0.45
   Deviation > ±0.15 requires explicit justification.

2. intent_alignment_score: Float 0.0–1.0.

3. overall_severity_score: Float 0.0–1.0. Computed as: 1 - consistency_score (±0.05 with justification).

4. overall_severity: String. >= 0.65 → "high", 0.35–0.64 → "medium", < 0.35 → "low"

Return JSON with EXACTLY this structure:
{{
    "self_lens": {{
        "is_consistent": true or false,
        "consistency_score": 0.78,
        "intent_alignment_score": 0.81,
        "reasoning": "Revised reasoning after reflection (or confirmation of initial judgment)",
        "definition_match": "How well this segment matches the code definition",
        "drift_warning": "Any drift concern, or empty string",
        "alternative_codes": ["Better-fitting codes NOT already applied"],
        "suggestion": "Brief constructive suggestion for the researcher"
    }},
    "overall_severity_score": 0.42,
    "overall_severity": "medium",
    "score_grounding_note": "How you used the embedding evidence, and what changed (or didn't) vs your initial judgment"
}}"""


_REFLECTION_USER_TEMPLATE = """\
YOUR INITIAL JUDGMENT (from pass 1):
```json
{initial_judgment_json}
```

---

{deterministic_evidence_section}

---

FRESH DIVERSE EXAMPLES ({reflection_history_count} segments — may differ from your initial set):
{reflection_history}

---

ORIGINAL SEGMENT UNDER AUDIT:
Segment: "{new_quote}"
Researcher's Proposed Code: "{proposed_code}"

{co_applied_section}

---

Reflect on your initial judgment. Return your revised (or confirmed) assessment as a single JSON response.
If you change any score by more than ±0.05, explain WHY in your reasoning.
"""


def build_reflection_prompt(
    initial_judgment: dict,
    reflection_history: list[tuple[str, str]],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    existing_codes_on_span: list[str] | None = None,
    # Stage 1 deterministic scores
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> list[dict]:
    """Build the reflection prompt for pass 2 of the self-consistency loop.

    Shows the model its own initial judgment plus fresh MMR examples and
    deterministic scores, then asks it to reflect and revise or confirm.
    """
    deterministic_evidence_section = _build_deterministic_evidence_section(
        centroid_similarity=centroid_similarity,
        codebook_prob_dist=codebook_prob_dist,
        entropy=entropy,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
        proposed_code=proposed_code,
    )

    # Co-applied section
    all_applied = list({proposed_code} | set(existing_codes_on_span or []))
    if existing_codes_on_span:
        co_codes = ", ".join(f'"{c}"' for c in existing_codes_on_span)
        co_applied_section = (
            f"CODES ALREADY APPLIED: {co_codes}\n"
            f"HARD CONSTRAINT: NEVER include these in alternative_codes."
        )
    else:
        co_applied_section = "(No other codes applied to this segment)"

    # Reflection history
    if reflection_history:
        hist_lines = []
        for code, quote in reflection_history:
            display = quote[:200] + "..." if len(quote) > 200 else quote
            hist_lines.append(f'  - Code: "{code}" → "{display}"')
        reflection_history_str = "\n".join(hist_lines)
    else:
        reflection_history_str = "  (No additional examples available)"

    # Serialise initial judgment for inclusion
    initial_judgment_json = _json.dumps(initial_judgment, indent=2, default=str)

    user_content = _REFLECTION_USER_TEMPLATE.format(
        initial_judgment_json=initial_judgment_json,
        deterministic_evidence_section=deterministic_evidence_section,
        reflection_history_count=len(reflection_history),
        reflection_history=reflection_history_str,
        new_quote=new_quote,
        proposed_code=proposed_code,
        co_applied_section=co_applied_section,
    )

    return [
        {"role": "system", "content": _REFLECTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
