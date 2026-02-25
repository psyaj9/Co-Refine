/**
 * Accessibility unit tests for the Toolbar component.
 * Validates ARIA toolbar pattern (arrow key nav, roles).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Toolbar from "@/components/Toolbar";

expect.extend(toHaveNoViolations);

/* Mock the store selectors used by Toolbar */
vi.mock("@/stores/store", () => ({
  useStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      viewMode: "document",
      setViewMode: vi.fn(),
      activeProjectId: "proj-1",
      activeDocumentId: "doc-1",
      showUploadPage: false,
      agentsRunning: false,
      batchAuditRunning: false,
      batchAuditProgress: null,
    }),
}));

vi.mock("@/api/client", () => ({
  default: { triggerBatchAudit: vi.fn() },
}));

describe("Toolbar – a11y", () => {
  it("has role=toolbar on the container", () => {
    render(<Toolbar />);
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Toolbar />);
    const results = await axe(container, {
      rules: { "landmark-no-duplicate-banner": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("supports arrow key navigation between buttons", async () => {
    render(<Toolbar />);
    const toolbar = screen.getByRole("toolbar");
    const buttons = toolbar.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(1);

    // Focus first button
    (buttons[0] as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(buttons[0]);

    // ArrowRight moves to next button
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("wraps focus with Home and End keys", async () => {
    render(<Toolbar />);
    const toolbar = screen.getByRole("toolbar");
    const buttons = toolbar.querySelectorAll("button");

    (buttons[0] as HTMLButtonElement).focus();

    // End jumps to last
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);

    // Home jumps back to first
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(buttons[0]);
  });
});
