import { describe, it, expect } from "vitest";
import {
  alertStyle,
  alertTitle,
  alertBody,
} from "@/lib/alert-helpers";
import type { AlertPayload } from "@/types";

const base: AlertPayload = {
  type: "coding_audit",
  data: {},
};

describe("alertStyle", () => {
  it("returns indigo classes for coding_audit", () => {
    expect(alertStyle("coding_audit")).toContain("indigo");
  });

  it("returns amber classes for consistency", () => {
    expect(alertStyle("consistency")).toContain("amber");
  });

  it("returns purple classes for ghost_partner", () => {
    expect(alertStyle("ghost_partner")).toContain("purple");
  });

  it("returns red classes for agent_error", () => {
    expect(alertStyle("agent_error")).toContain("red");
  });

  it("returns default surface classes for unknown type", () => {
    expect(alertStyle("unknown_type")).toContain("surface");
  });
});

describe("alertTitle", () => {
  it("returns code label for coding_audit", () => {
    expect(alertTitle({ ...base, code_label: "Theme" })).toBe("Theme");
  });

  it("appends (drift) when self_lens.is_consistent is false", () => {
    expect(
      alertTitle({
        ...base,
        code_label: "Theme",
        data: { self_lens: { is_consistent: false } },
      })
    ).toBe("Theme (drift)");
  });

  it("appends (conflict) when inter_rater_lens.is_conflict is true", () => {
    expect(
      alertTitle({
        ...base,
        code_label: "Theme",
        data: { inter_rater_lens: { is_conflict: true } },
      })
    ).toBe("Theme (conflict)");
  });

  it("returns Drift/Consistent for consistency type", () => {
    expect(alertTitle({ ...base, type: "consistency", is_consistent: false })).toBe(
      "Drift Detected"
    );
    expect(alertTitle({ ...base, type: "consistency", is_consistent: true })).toBe(
      "Consistent"
    );
  });

  it("returns Conflict/Agrees for ghost_partner", () => {
    expect(alertTitle({ ...base, type: "ghost_partner", is_conflict: true })).toBe(
      "Conflict"
    );
    expect(alertTitle({ ...base, type: "ghost_partner", is_conflict: false })).toBe(
      "Agrees"
    );
  });

  it("includes agent label for agent_thinking", () => {
    expect(
      alertTitle({ ...base, type: "agent_thinking", agent: "coding_audit" })
    ).toBe("Coding Audit...");
  });

  it("includes agent label for agent_error", () => {
    expect(
      alertTitle({ ...base, type: "agent_error", agent: "ghost_partner" })
    ).toBe("Ghost Partner failed");
  });

  it("returns code_label for analysis_updated", () => {
    expect(
      alertTitle({ ...base, type: "analysis_updated", code_label: "Theme A" })
    ).toBe("Theme A");
  });

  it("returns default for unknown type", () => {
    expect(alertTitle({ ...base, type: "batch_audit_started" as AlertPayload["type"] })).toBe(
      "Agent Alert"
    );
  });
});

describe("alertBody", () => {
  it("returns suggestion for coding_audit self_lens", () => {
    const alert: AlertPayload = {
      ...base,
      data: { self_lens: { suggestion: "Consider re-coding" } },
    };
    // Body now includes a plain-language opening line followed by the suggestion
    expect(alertBody(alert)).toContain("Consider re-coding");
  });

  it("returns reasoning for consistency", () => {
    const alert: AlertPayload = {
      ...base,
      type: "consistency",
      data: { reasoning: "Codes are consistent" },
    };
    expect(alertBody(alert)).toBe("Codes are consistent");
  });

  it("returns 'No details available' for empty ghost_partner", () => {
    expect(alertBody({ ...base, type: "ghost_partner", data: {} })).toBe(
      "No details available"
    );
  });

  it("returns error message for agent_error", () => {
    expect(
      alertBody({
        ...base,
        type: "agent_error",
        data: { message: "Timeout" },
      })
    ).toBe("Timeout");
  });

  it("returns 'is reviewing' for agent_thinking", () => {
    expect(
      alertBody({ ...base, type: "agent_thinking", agent: "coding_audit" })
    ).toContain("Coding Audit is reviewing");
  });

  it("returns definition for analysis_updated", () => {
    expect(
      alertBody({
        ...base,
        type: "analysis_updated",
        data: { definition: "New def" },
      })
    ).toBe("New def");
  });
});
