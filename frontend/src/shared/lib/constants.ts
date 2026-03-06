/** Colour palette for new codes */
export const COLOUR_PALETTE = [
  "#F44336", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
  "#00BCD4", "#E91E63", "#8BC34A", "#FF5722", "#3F51B5",
  "#009688", "#FFC107", "#673AB7", "#CDDC39", "#795548",
  "#607D8B", "#03A9F4", "#FFEB3B", "#1B5E20", "#AD1457",
] as const;

/** Pick the next unused colour from the palette */
export function getNextColour(existingCodes: { colour: string }[]): string {
  const used = new Set(existingCodes.map((c) => c.colour));
  for (const colour of COLOUR_PALETTE) {
    if (!used.has(colour)) return colour;
  }
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`;
}

/** Human-readable labels for AI agent keys */
export const AGENT_LABELS: Record<string, string> = {
  coding_audit: "Coding Audit",
  analysis: "Inductive Analysis",
  ghost_partner: "Ghost Partner",
  consistency: "Self-Consistency",
};

/**
 * Plain-language explanations for each metric shown in alerts.
 * Designed for non-technical qualitative researchers.
 */
export const METRIC_EXPLANATIONS: Record<string, string> = {
  similarity:
    "How closely this segment matches past examples of the same code. Higher means a better fit (0 = no match, 1 = perfect match).",
  entropy:
    "How ambiguous this segment is — whether it could reasonably belong to several different codes. Higher means more ambiguity.",
  drift:
    "How much the meaning of this code has shifted over time — comparing your earliest uses with your most recent ones. A high value means your interpretation has evolved; consider reviewing the definition or splitting the code into two distinct concepts.",
  consistency:
    "How well this coding decision aligns with your own past decisions for this code. Higher is better.",
  severity_low:
    "The coding looks fine — no significant issues detected.",
  severity_medium:
    "Minor issues detected — you may want to double-check this decision.",
  severity_high:
    "The AI strongly recommends reviewing this decision — significant inconsistency or conflict detected.",
  escalation:
    "This decision was flagged for a second, more thorough AI review because the initial checks found something unexpected.",
  pseudo_centroid:
    "Not enough real data to compare against — the AI is using the code's written definition as a stand-in, so metrics may be less reliable.",
  sparse_data:
    "Very few segments have been coded with this code, so the AI has limited examples to learn from. Metrics will become more reliable as you code more.",
  predicted_confidence:
    "How confident the simulated second researcher is about their suggested code. Higher means more certain.",
  conflict_severity:
    "How significant the disagreement is between you and the simulated second researcher. Higher means a more meaningful disagreement.",
  intent_alignment:
    "How well the segment matches the intended meaning of the code, based on its definition — not just surface-level similarity.",
  self_consistency_lens:
    "Checks whether you are applying this code consistently with your own past coding decisions.",
  inter_rater_lens:
    "Simulates an independent second researcher coding the same segment to check if they would agree with your choice.",
  score_delta:
    "The difference between the AI's initial score and its revised score after escalation. Positive means the score increased; negative means it decreased.",
};
