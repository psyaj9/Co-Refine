import json as _json

from .audit_prompt import _build_deterministic_evidence_section


_CHALLENGE_SYSTEM_PROMPT = """\
You are the SAME Qualitative Research Auditor. The researcher has READ your reflected judgment \
and DISAGREES with part of it. They are providing their own expert reasoning.

Your task:
1. Take the researcher's feedback SERIOUSLY — they are the domain expert and sole coder.
2. Re-evaluate your reflected judgment in light of their feedback.
3. Cross-check against the deterministic embedding scores (FACTS).
4. If the researcher makes a valid point, revise your scores and reasoning accordingly.
5. If you still believe your reflected judgment is correct, explain why respectfully and with evidence.

The researcher's expertise and reflexive voice ALWAYS takes precedence over statistical patterns.

SCORING RULES — identical to previous passes:

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
        "reasoning": "Revised reasoning incorporating the researcher's feedback",
        "definition_match": "How well this segment matches the code definition",
        "drift_warning": "Any drift concern, or empty string",
        "alternative_codes": ["Better-fitting codes NOT already applied"],
        "suggestion": "Brief constructive suggestion"
    }},
    "overall_severity_score": 0.42,
    "overall_severity": "medium",
    "score_grounding_note": "How you balanced the researcher's feedback with the embedding evidence"
}}"""


_CHALLENGE_USER_TEMPLATE = """\
YOUR REFLECTED JUDGMENT (from pass 2):
```json
{reflected_judgment_json}
```

---

THE RESEARCHER'S CHALLENGE:
"{researcher_feedback}"

---

{deterministic_evidence_section}

---

DIVERSE EXAMPLES ({history_count} segments):
{history}

---

ORIGINAL SEGMENT UNDER AUDIT:
Segment: "{new_quote}"
Researcher's Proposed Code: "{proposed_code}"

{co_applied_section}

---

Reconsider your reflected judgment in light of the researcher's feedback.
Return your revised assessment as a single JSON response.
"""


def build_challenge_prompt(
    reflected_judgment: dict,
    researcher_feedback: str,
    history: list[tuple[str, str]],
    new_quote: str,
    proposed_code: str,
    existing_codes_on_span: list[str] | None = None,
    # Stage 1 deterministic scores
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> list[dict]:
    """Build the challenge prompt for pass 3 (human-triggered re-evaluation).

    Includes the researcher's feedback as a first-class input that the model
    must take seriously and incorporate into its revised judgment.
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

    # History
    if history:
        hist_lines = []
        for code, quote in history:
            display = quote[:200] + "..." if len(quote) > 200 else quote
            hist_lines.append(f'  - Code: "{code}" → "{display}"')
        history_str = "\n".join(hist_lines)
    else:
        history_str = "  (No examples available)"

    reflected_judgment_json = _json.dumps(reflected_judgment, indent=2, default=str)

    user_content = _CHALLENGE_USER_TEMPLATE.format(
        reflected_judgment_json=reflected_judgment_json,
        researcher_feedback=researcher_feedback,
        deterministic_evidence_section=deterministic_evidence_section,
        history_count=len(history),
        history=history_str,
        new_quote=new_quote,
        proposed_code=proposed_code,
        co_applied_section=co_applied_section,
    )

    return [
        {"role": "system", "content": _CHALLENGE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
