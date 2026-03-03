_SYSTEM_PROMPT = """\
You are an expert Qualitative Research Auditor reviewing a new coding decision for SELF-CONSISTENCY — did the researcher apply this code consistently with their own past decisions?

SCORING RULES — YOU MUST FOLLOW THESE EXACTLY:

1. consistency_score: Float 0.0–1.0.
   MUST be consistent with the embedding similarity score provided below:
     if similarity >= 0.75 → score should be >= 0.65
     if similarity <= 0.40 → score should be <= 0.45
   Deviation > ±0.15 from the similarity score requires explicit justification in reasoning.

2. intent_alignment_score: Float 0.0–1.0.
   How well the quote matches the INTENDED meaning of the proposed code.
   Semantic judgment, not just pattern matching. Can diverge from consistency_score.

3. overall_severity_score: Float 0.0–1.0.
   Computed as: 1 - consistency_score
   May adjust ±0.05 for context but MUST justify deviation.

4. overall_severity: String. MUST match overall_severity_score:
   >= 0.65 → "high", 0.35–0.64 → "medium", < 0.35 → "low"

Guidelines:
- Only flag TRUE inconsistencies — minor variation is normal in qualitative coding
- Produce ALL numeric scores as floats between 0.0 and 1.0
- Ground your reasoning on the deterministic evidence provided — do not ignore it

Return JSON with EXACTLY this structure:
{{
    "self_lens": {{
        "is_consistent": true or false,
        "consistency_score": 0.78,
        "intent_alignment_score": 0.81,
        "reasoning": "Why this is or isn't consistent with established patterns",
        "definition_match": "How well this segment matches the code definition",
        "drift_warning": "How their interpretation seems to be shifting, or empty string",
        "alternative_codes": ["Better-fitting codes NOT already applied to this segment, if any"],
        "suggestion": "Brief constructive suggestion for the researcher"
    }},
    "overall_severity_score": 0.42,
    "overall_severity": "medium",
    "score_grounding_note": "Brief note explaining how you used the embedding evidence"
}}"""


_USER_PROMPT_TEMPLATE = """\
SURROUNDING CONTEXT (>>> marks the highlighted segment <<<):
{document_context_section}

---

{deterministic_evidence_section}

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
Perform a SELF-CONSISTENCY analysis and return the result as a single JSON response.

**SELF-CONSISTENCY:**
1. Does this segment match the researcher's own definition of "{proposed_code}" (or the AI-inferred definition if none)?
2. Compare against the coding history — has this code been applied to similar material before?
3. Is there any drift or inconsistency in how this code is being applied over time?
4. Are there better-fitting codes from the codebook? (NEVER suggest codes already applied to this segment)

Additional:
- HARD CONSTRAINT: NEVER include any of these codes in alternative_codes: {co_applied_label_list}
  These codes are already applied to this segment — suggesting them adds no value.
"""


def _build_deterministic_evidence_section(
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
    proposed_code: str = "",
) -> str:
    """Build the DETERMINISTIC EMBEDDING SCORES block for the prompt."""
    if centroid_similarity is None and not codebook_prob_dist:
        return (
            "**DETERMINISTIC EMBEDDING SCORES: NOT AVAILABLE**\n"
            "This code has no prior segments — no embedding evidence exists.\n"
            "Use your best judgment based on codebook definitions and context.\n"
            "Be CONSERVATIVE: avoid over-flagging with sparse data."
        )

    lines = ["**DETERMINISTIC EMBEDDING SCORES (ground your judgment on these):**"]

    # Cold-start warning
    if segment_count is not None and segment_count < 3:
        lines.append(
            f"⚠ LIMITED DATA: Only {segment_count} segment(s) exist for this code. "
            "Embedding scores may be unreliable. Weight codebook definitions more heavily."
        )

    if is_pseudo_centroid:
        lines.append(
            "⚠ PSEUDO-CENTROID: Using code definition embedding as fallback (no real segment data)."
        )

    if centroid_similarity is not None:
        lines.append(
            f"- Semantic similarity of this segment to the \"{proposed_code}\" code centroid: "
            f"**{centroid_similarity:.4f}**"
        )
        lines.append(
            "  (range 0–1; higher = more similar to past examples of this code)"
        )

    if codebook_prob_dist:
        lines.append("- Softmax probability distribution across codebook:")
        for code, prob in sorted(codebook_prob_dist.items(), key=lambda x: -x[1]):
            lines.append(f"    - {code}: {prob:.3f}")
        lines.append("  These probabilities are FACTUAL, not your opinion.")

    if entropy is not None:
        lines.append(
            f"- Distribution entropy: **{entropy:.4f}** (range 0–1; higher = more ambiguous)"
        )

    if temporal_drift is not None:
        lines.append(
            f"- Temporal drift for \"{proposed_code}\": **{temporal_drift:.4f}** "
            "(range 0–1; >0.3 = meaningful drift)"
        )

    return "\n".join(lines)


def build_coding_audit_prompt(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
    # Stage 1 parameters (None = no grounding available)
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> list[dict]:
    """Build the coding audit prompt as a list of messages (system + user).

    When Stage 1 scores are provided, they are injected as FACTS that the
    LLM must ground its judgment on. When they are None, the prompt tells
    the LLM to be conservative (cold-start handling).

    Returns list[dict] with 'role' and 'content' keys.
    """
    # Document context section
    document_context_section = (
        f'"""\n{document_context}\n"""' if document_context else "(No surrounding context)"
    )

    # Deterministic evidence section
    deterministic_evidence_section = _build_deterministic_evidence_section(
        centroid_similarity=centroid_similarity,
        codebook_prob_dist=codebook_prob_dist,
        entropy=entropy,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
        proposed_code=proposed_code,
    )

    # Co-applied codes section
    all_applied = list({proposed_code} | set(existing_codes_on_span or []))
    if existing_codes_on_span:
        co_codes = ", ".join(f'"{c}"' for c in existing_codes_on_span)
        co_applied_section = (
            f"CODES ALREADY APPLIED TO THIS SEGMENT: {co_codes}\n"
            f"HARD CONSTRAINT: These codes are already applied to the exact same text span. "
            f"You MUST NOT include any of them in alternative_codes or predicted_codes. "
            f"If the most likely independent-researcher prediction matches one of these, "
            f"set is_conflict=false and move to the next-best prediction."
        )
    else:
        co_applied_section = "(No other codes applied to this segment)"

    co_applied_label_list = ", ".join(f'"{c}"' for c in all_applied) if all_applied else "(none)"

    # Researcher-supplied definitions (canonical codebook) with softmax probabilities
    if user_code_definitions:
        user_def_lines = []
        for code, defn in user_code_definitions.items():
            prob_str = ""
            if codebook_prob_dist and code in codebook_prob_dist:
                prob_str = f" [embedding P={codebook_prob_dist[code]:.3f}]"
            if defn:
                user_def_lines.append(f"**{code}**{prob_str}: {defn}")
            else:
                user_def_lines.append(f"**{code}**{prob_str}: (No definition provided)")
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

    user_content = _USER_PROMPT_TEMPLATE.format(
        document_context_section=document_context_section,
        deterministic_evidence_section=deterministic_evidence_section,
        user_definitions=user_definitions_str,
        ai_definitions=ai_definitions_str,
        history_count=len(user_history),
        user_history=history_str,
        new_quote=new_quote,
        proposed_code=proposed_code,
        co_applied_section=co_applied_section,
        co_applied_label_list=co_applied_label_list,
    )

    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


# ---------------------------------------------------------------------------
# Self-Consistency Reflection Loop (Feature 6)
# ---------------------------------------------------------------------------

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
    import json as _json

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


# ---------------------------------------------------------------------------
# Human Challenge Prompt (Feature 6 — 3rd cycle)
# ---------------------------------------------------------------------------

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
    import json as _json

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
