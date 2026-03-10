import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import AlertsTab from "./AlertsTab";
import { defaultStoreState, mockAlert, mockCode } from "@/shared/__tests__/test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/shared/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/shared/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<AlertsTab />);
}

describe("AlertsTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state message when no alerts", () => {
    setup({ alerts: [] });
    expect(screen.getByText(/AI agents are monitoring/i)).toBeInTheDocument();
  });

  it("renders visible alerts (filters out agents_started/agents_done)", () => {
    setup({
      alerts: [
        mockAlert({ type: "coding_audit", code_label: "Theme A" }),
        mockAlert({ type: "agents_started" }),
        mockAlert({ type: "agents_done" }),
      ],
    });
    // Only the coding_audit alert should produce a dismiss button
    const dismissButtons = screen.getAllByLabelText(/dismiss alert/i);
    expect(dismissButtons).toHaveLength(1);
  });

  it("calls dismissAlert when dismiss button clicked", () => {
    const dismissAlert = vi.fn();
    setup({
      alerts: [mockAlert({ type: "coding_audit", code_label: "Theme A" })],
      dismissAlert,
    });
    fireEvent.click(screen.getByLabelText(/dismiss alert/i));
    expect(dismissAlert).toHaveBeenCalled();
  });

  it("shows agent pipeline status when agents are running", () => {
    setup({
      agentsRunning: true,
      alerts: [mockAlert({ type: "agent_thinking", agent: "coding_audit" })],
    });
    expect(screen.getByText(/Coding Audit Pipeline/i)).toBeInTheDocument();
  });

  it("shows segment text blockquote for coding_audit", () => {
    setup({
      alerts: [
        mockAlert({
          type: "coding_audit",
          segment_text: "The fox jumped",
          code_label: "Theme A",
        }),
      ],
    });
    expect(screen.getByText(/The fox jumped/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows 'Keep my code' button for ghost_partner conflict", () => {
    setup({
      alerts: [
        mockAlert({
          type: "ghost_partner",
          is_conflict: true,
          segment_id: "seg-1",
          code_label: "Theme A",
          data: { conflict_explanation: "Disagree", predicted_code: "Theme B" },
        }),
      ],
      codes: [mockCode(), mockCode({ id: "code-2", label: "Theme B" })],
    });
    expect(screen.getByText(/Keep my code/i)).toBeInTheDocument();
  });
});
