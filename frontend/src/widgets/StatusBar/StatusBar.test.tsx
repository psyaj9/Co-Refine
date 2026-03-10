import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import StatusBar from "./StatusBar";
import { defaultStoreState } from "@/shared/__tests__/test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/shared/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/shared/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<StatusBar />);
}

describe("StatusBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows project name when project is active", () => {
    setup();
    expect(screen.getByText("Test Project")).toBeInTheDocument();
  });

  it("shows document, code, and segment counts", () => {
    setup({ documents: [{ id: "d1" }, { id: "d2" }], codes: [{ id: "c1" }], segments: [{ id: "s1" }] });
    expect(screen.getByText(/2 docs/)).toBeInTheDocument();
    expect(screen.getByText(/1 code\b/)).toBeInTheDocument();
    expect(screen.getByText(/1 segment/)).toBeInTheDocument();
  });

  it("shows 'No project selected' when no active project", () => {
    setup({ activeProjectId: null });
    expect(screen.getByText("No project selected")).toBeInTheDocument();
  });

  it("shows agent running indicator", () => {
    setup({
      agentsRunning: true,
      alerts: [{ type: "agent_thinking", agent: "coding_audit", data: {} }],
    });
    expect(screen.getByText(/Coding Audit/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders version string", () => {
    setup();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
  });
});
