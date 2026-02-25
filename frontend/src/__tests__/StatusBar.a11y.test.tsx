/**
 * Accessibility unit tests for the StatusBar component.
 * Validates icons are hidden from AT and no axe violations.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import StatusBar from "@/components/StatusBar";

expect.extend(toHaveNoViolations);

vi.mock("@/stores/store", () => ({
  useStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      activeProjectId: "proj-1",
      activeDocumentId: "doc-1",
      showUploadPage: false,
      projects: [{ id: "proj-1", name: "Test" }],
      documents: [{ id: "doc-1", title: "doc.txt" }],
      codes: [{ id: "c1", label: "CodeA", colour: "#ff0000", segment_count: 3 }],
      segments: [{ id: "s1" }],
      agentsRunning: false,
      viewMode: "document",
      alerts: [],
    }),
}));

describe("StatusBar – a11y", () => {
  it("has no axe violations", async () => {
    const { container } = render(<StatusBar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("marks icons as aria-hidden", () => {
    const { container } = render(<StatusBar />);
    const svgs = container.querySelectorAll("svg");
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
