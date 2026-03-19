_SCORING_RULES_SECTION = """\
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
- Ground your reasoning on the deterministic evidence provided — do not ignore it"""


_WRITING_RULES_SECTION = """\
WRITING RULES — ALL TEXT FIELDS MUST FOLLOW THESE:
- Write for a qualitative researcher, NOT a data scientist. Never mention embeddings, similarity scores, percentages, or cosine distance in user-facing text fields.
- headline: ≤15 words. A plain-English verdict the researcher can act on immediately. Examples:
    "Consistent with your past coding of this concept."
    "This quote doesn't quite match how you have used this code before."
    "Minor drift detected — your interpretation of this code has shifted slightly."
- finding: 1–2 sentences only. Explain WHY this is or isn't consistent in plain language. Reference the content of the segment and the meaning of the code — not numbers.
- definition_note: 1 sentence. Only write this if there is a meaningful gap between this segment and the code definition. Use an empty string "" if the segment matches the definition well.
- drift_warning: 1 sentence describing what has shifted and how. Use an empty string "" if there is no meaningful drift.
- action: 1 sentence, imperative mood. Tell the researcher exactly what to do next. Examples:
    "Keep coding as-is — this is a strong example of the code."
    "Review your last few uses of this code to check if your interpretation has shifted."
    "Consider switching to 'X', which better fits the framing here."
- evidence_note: 1 sentence. Summarise in plain language how the quantitative evidence informed this assessment, without naming any technical metrics."""


_OUTPUT_FORMAT_SECTION = """\
Return JSON with EXACTLY this structure:
{{
    "self_lens": {{
        "is_consistent": true or false,
        "consistency_score": 0.78,
        "intent_alignment_score": 0.81,
        "headline": "Consistent with your past coding of this concept.",
        "finding": "This quote closely mirrors how you have applied this code before — the language and the framing match your established pattern.",
        "definition_note": "",
        "drift_warning": "",
        "action": "Keep coding as-is — this is a strong example of the code.",
        "alternative_codes": ["Better-fitting codes NOT already applied to this segment, if any"],
        "evidence_note": "The strong semantic match and stable pattern over time confirm this fits your established use of the code."
    }},
    "overall_severity_score": 0.22,
    "overall_severity": "low"
}}"""


_FEW_SHOT_EXAMPLES_SECTION = """\
FEW-SHOT WORKED EXAMPLES — study these before scoring:

--- EXAMPLE A: Strong consistency ---
USER INPUT (abbreviated):
  Segment: "The shock of losing him wiped out any sense of future."
  Proposed code: "Anticipatory Grief"
  Centroid similarity: 0.81  |  Temporal drift: 0.04
  History: 12 segments, all capturing loss of imagined futures or feared bereavement.

ASSISTANT REASONING (internal, not returned):
  Step 1 (SCOPE): "Wiped out any sense of future" directly captures anticipatory grief — the loss of an imagined future, not just present pain. In scope.
  Step 2 (EVIDENCE): Similarity 0.81 → scoring rules require consistency_score ≥ 0.65. Temporal drift 0.04 → stable application, no drift concern.
  Step 3 (HISTORY): All 12 prior segments share the "anticipated future taken away" theme. This segment fits perfectly.
  Step 4 (DRIFT): Drift 0.04 — negligible. No shift in the code's application.
  Step 5 (ALTERNATIVES): No better-fitting code apparent. "Anticipatory Grief" is the correct frame.
  Step 6 (VERDICT): Strong, consistent application. High consistency score, low severity.

ASSISTANT OUTPUT:
{"self_lens": {"is_consistent": true, "consistency_score": 0.87, "intent_alignment_score": 0.89, "headline": "Consistent with your past coding of this concept.", "finding": "This segment captures the loss of imagined futures — the defining feature of how you have applied Anticipatory Grief throughout your coding.", "definition_note": "", "drift_warning": "", "action": "Keep coding as-is — this is a strong example of the code.", "alternative_codes": [], "evidence_note": "The strong semantic match and stable pattern over time confirm this fits your established use of the code."}, "overall_severity_score": 0.13, "overall_severity": "low"}

--- EXAMPLE B: Borderline drift ---
USER INPUT (abbreviated):
  Segment: "Her paperwork was a reminder of what she no longer had."
  Proposed code: "Anticipatory Grief"
  Centroid similarity: 0.43  |  Temporal drift: 0.34
  History: 12 segments as above, plus 3 recent segments about material loss (possessions, paperwork, finances).

ASSISTANT REASONING (internal, not returned):
  Step 1 (SCOPE): "Reminder of what she no longer had" is about present absence, not anticipated future loss. Borderline — could fit, but is more retrospective than anticipatory.
  Step 2 (EVIDENCE): Similarity 0.43 → scoring rules require consistency_score ≤ 0.45. Drift 0.34 → above the 0.3 threshold, meaningful drift present.
  Step 3 (HISTORY): Original segments captured feared future loss. Recent 3 segments (incl. this one) are about tangible/material reminders of past loss. The code's application is widening.
  Step 4 (DRIFT): Drift 0.34 — the researcher has been extending this code to retrospective/material loss, which differs from its original anticipatory framing.
  Step 5 (ALTERNATIVES): "Grief Reminders" or "Bereavement Triggers" might better capture material-cue experiences. But no such code exists in the codebook.
  Step 6 (VERDICT): Inconsistent application. Low similarity, meaningful drift. Medium severity. Recommend reviewing recent uses.

ASSISTANT OUTPUT:
{"self_lens": {"is_consistent": false, "consistency_score": 0.41, "intent_alignment_score": 0.38, "headline": "This quote doesn\u2019t quite match how you have used this code before.", "finding": "Your earlier uses of Anticipatory Grief captured the fear of losing a future; this segment is about a material object evoking a past loss, which is a different emotional register.", "definition_note": "Your application here edges toward retrospective grief rather than anticipatory grief — consider whether this aligns with your intended scope.", "drift_warning": "Your recent uses of this code have shifted toward material and retrospective loss cues, which differs from the anticipatory framing of earlier segments.", "action": "Review your last few uses of this code to check if your interpretation has shifted — you may want to create a separate code for grief reminders.", "alternative_codes": [], "evidence_note": "The lower semantic match and notable drift in recent coding patterns suggest the application of this code has broadened beyond its original scope."}, "overall_severity_score": 0.59, "overall_severity": "medium"}"""


_SYSTEM_PROMPT = "\n\n".join([
    "You are an expert Qualitative Research Auditor reviewing a new coding decision for SELF-CONSISTENCY — did the researcher apply this code consistently with their own past decisions?",
    _FEW_SHOT_EXAMPLES_SECTION,
    _SCORING_RULES_SECTION,
    _WRITING_RULES_SECTION,
    _OUTPUT_FORMAT_SECTION,
])


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

Your Task — work through these steps internally before writing your JSON:

Step 1 (SCOPE): Does the segment fall within the conceptual boundary of "{proposed_code}"? Refer to the researcher's definition if present, otherwise the AI-inferred definition.
Step 2 (EVIDENCE): What do the deterministic scores tell you? Apply the scoring rules exactly — check whether similarity and drift values require specific score ranges.
Step 3 (HISTORY): Does the coding history contain similar material coded the same way? Note any segments that clearly match or clearly diverge.
Step 4 (DRIFT): Has the researcher's application of this code shifted over time? Compare early vs. recent history entries.
Step 5 (ALTERNATIVES): Are there better-fitting codes from the codebook that are NOT already applied to this segment?
Step 6 (VERDICT): Synthesise steps 1–5 into your final scores and produce the JSON response.

HARD CONSTRAINT: NEVER include any of these codes in alternative_codes: {co_applied_label_list}
These codes are already applied to this segment — suggesting them adds no value.
"""


def _build_deterministic_evidence_section(
    centroid_similarity: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
    proposed_code: str = "",
) -> str:
    if centroid_similarity is None:
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
    centroid_similarity: float | None = None,
    temporal_drift: float | None = None,
    is_pseudo_centroid: bool = False,
    segment_count: int | None = None,
) -> list[dict]:
    document_context_section = (
        f'"""\n{document_context}\n"""' if document_context else "(No surrounding context)"
    )

    deterministic_evidence_section = _build_deterministic_evidence_section(
        centroid_similarity=centroid_similarity,
        temporal_drift=temporal_drift,
        is_pseudo_centroid=is_pseudo_centroid,
        segment_count=segment_count,
        proposed_code=proposed_code,
    )

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

    if user_code_definitions:
        user_def_lines = [
            f"**{code}**: {defn}" if defn else f"**{code}**: (No definition provided)"
            for code, defn in user_code_definitions.items()
        ]
        user_definitions_str = "\n".join(user_def_lines)
    else:
        user_definitions_str = "(No researcher-supplied definitions yet)"

    if code_definitions:
        def_lines = []
        for code, analysis in code_definitions.items():
            def_lines.append(f"**{code}**:")
            def_lines.append(f"  - Definition: {analysis.get('definition', 'Not yet analysed')}")
            def_lines.append(f"  - Lens: {analysis.get('lens', 'Not yet analysed')}")
        ai_definitions_str = "\n".join(def_lines)
    else:
        ai_definitions_str = "(No AI-inferred definitions yet)"

    if user_history:
        history_lines = [
            f'  - Code: "{code}" → "{quote[:200] + "..." if len(quote) > 200 else quote}"'
            for code, quote in user_history
        ]
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
