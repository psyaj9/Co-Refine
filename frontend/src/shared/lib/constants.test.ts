import { describe, it, expect } from "vitest";
import { COLOUR_PALETTE, getNextColour, AGENT_LABELS } from "@/shared/lib/constants";

describe("COLOUR_PALETTE", () => {
  it("contains 20 colours", () => {
    expect(COLOUR_PALETTE).toHaveLength(20);
  });

  it("all entries are valid hex colours", () => {
    for (const c of COLOUR_PALETTE) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("getNextColour", () => {
  it("returns first palette colour when none are used", () => {
    expect(getNextColour([])).toBe(COLOUR_PALETTE[0]);
  });

  it("skips already-used colours", () => {
    const used = [{ colour: COLOUR_PALETTE[0] }];
    expect(getNextColour(used)).toBe(COLOUR_PALETTE[1]);
  });

  it("returns random HSL when palette is exhausted", () => {
    const allUsed = COLOUR_PALETTE.map((colour) => ({ colour }));
    const result = getNextColour(allUsed);
    expect(result).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
  });
});

describe("AGENT_LABELS", () => {
  it("maps all known agent keys", () => {
    expect(AGENT_LABELS).toHaveProperty("coding_audit");
    expect(AGENT_LABELS).toHaveProperty("analysis");
    expect(AGENT_LABELS).toHaveProperty("ghost_partner");
    expect(AGENT_LABELS).toHaveProperty("consistency");
  });

  it("values are human-readable strings", () => {
    expect(AGENT_LABELS.coding_audit).toBe("Coding Audit");
    expect(AGENT_LABELS.analysis).toBe("Inductive Analysis");
  });
});
