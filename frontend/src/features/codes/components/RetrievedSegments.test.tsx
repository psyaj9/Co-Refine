import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetrievedSegments from "./RetrievedSegments";
import { defaultStoreState, mockSegment, mockCode, mockDocument } from "@/shared/__tests__/test-helpers";

vi.mock("@/shared/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/shared/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<RetrievedSegments />);
}

describe("RetrievedSegments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows instruction text when no active code", () => {
    setup({ retrievedCodeId: null, retrievedSegments: [] });
    expect(screen.getByText(/double-click a code/i)).toBeInTheDocument();
  });

  it("renders segments grouped by document", () => {
    setup({
      retrievedCodeId: "code-1",
      retrievedSegments: [
        mockSegment({ id: "s1", document_id: "doc-1", text: "Seg text" }),
      ],
      codes: [mockCode()],
      documents: [mockDocument()],
    });
    expect(screen.getByText(/Seg text/)).toBeInTheDocument();
    expect(screen.getByText("Test Document")).toBeInTheDocument();
  });

  it("calls clearRetrievedSegments on close", () => {
    const clearRetrievedSegments = vi.fn();
    setup({
      retrievedCodeId: "code-1",
      retrievedSegments: [mockSegment()],
      codes: [mockCode()],
      documents: [mockDocument()],
      clearRetrievedSegments,
    });
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(clearRetrievedSegments).toHaveBeenCalled();
  });
});
