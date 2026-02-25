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
