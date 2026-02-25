import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HistoryTimeline from "@/components/history/HistoryTimeline";
import { defaultStoreState, mockEditEvent } from "./test-helpers";

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<HistoryTimeline />);
}

describe("HistoryTimeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no events", () => {
    setup({ editHistory: [] });
    expect(screen.getByText(/no edits recorded/i)).toBeInTheDocument();
  });

  it("renders timeline events", () => {
    setup({
      editHistory: [
        mockEditEvent({ id: "e1", action: "created", entity_type: "segment" }),
      ],
    });
    // Should show some event summary text
    expect(screen.getByText(/Applied/i)).toBeInTheDocument();
  });

  it("has scope toggle buttons", () => {
    setup({ editHistory: [mockEditEvent()] });
    expect(screen.getByText(/Document/i)).toBeInTheDocument();
    expect(screen.getByText(/Project/i)).toBeInTheDocument();
  });

  it("calls setHistoryScope on scope toggle", () => {
    const setHistoryScope = vi.fn();
    setup({ setHistoryScope, editHistory: [mockEditEvent()] });
    fireEvent.click(screen.getByText(/Project/i));
    expect(setHistoryScope).toHaveBeenCalledWith("project");
  });

  it("toggles event selection", () => {
    const setHistorySelectedEventId = vi.fn();
    setup({
      setHistorySelectedEventId,
      editHistory: [mockEditEvent({ id: "e1" })],
    });
    // Click the timeline entry
    const entry = screen.getByText(/Applied/i).closest("button");
    if (entry) fireEvent.click(entry);
    expect(setHistorySelectedEventId).toHaveBeenCalled();
  });
});
