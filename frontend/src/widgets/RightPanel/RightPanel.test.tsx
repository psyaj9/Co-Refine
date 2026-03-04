import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import RightPanel from "@/components/RightPanel";
import { defaultStoreState, mockAlert } from "@/shared/__tests__/test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}, props: { onCollapse?: () => void } = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<RightPanel {...props} />);
}

describe("RightPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Alerts and AI Chat tabs", () => {
    setup();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
  });

  it("shows alert badge when there are visible alerts", () => {
    setup({
      alerts: [
        mockAlert({ type: "coding_audit" }),
        mockAlert({ type: "coding_audit" }),
      ],
    });
    expect(screen.getByLabelText(/2 unread alert/i)).toBeInTheDocument();
  });

  it("does not show badge when no visible alerts", () => {
    setup({ alerts: [] });
    expect(screen.queryByLabelText(/unread alert/i)).not.toBeInTheDocument();
  });

  it("caps badge at 9+", () => {
    setup({
      alerts: Array.from({ length: 15 }, (_, i) =>
        mockAlert({ type: "coding_audit", segment_id: `s-${i}` })
      ),
    });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("switches tabs", () => {
    const setRightPanelTab = vi.fn();
    setup({ setRightPanelTab });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /AI Chat/i }));
    expect(setRightPanelTab).toHaveBeenCalledWith("chat");
  });

  it("calls onCollapse when collapse button is clicked", () => {
    const onCollapse = vi.fn();
    setup({}, { onCollapse });
    fireEvent.click(screen.getByLabelText(/collapse right panel/i));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("does not render collapse button when onCollapse is not provided", () => {
    setup();
    expect(screen.queryByLabelText(/collapse right panel/i)).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
