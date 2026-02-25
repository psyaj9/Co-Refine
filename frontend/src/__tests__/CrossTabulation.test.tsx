import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CrossTabulation from "@/components/vis/CrossTabulation";
import { defaultStoreState, mockCode, mockDocument, mockSegment } from "./test-helpers";

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<CrossTabulation />);
}

describe("CrossTabulation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no codes", () => {
    setup({ codes: [], documents: [] });
    expect(screen.getByText(/need documents and codes/i)).toBeInTheDocument();
  });

  it("renders table with documents as rows, codes as columns", () => {
    setup({
      codes: [mockCode({ id: "c1", label: "Code A" }), mockCode({ id: "c2", label: "Code B" })],
      documents: [mockDocument({ id: "d1", title: "Doc 1" })],
      segments: [
        mockSegment({ id: "s1", document_id: "d1", code_id: "c1" }),
        mockSegment({ id: "s2", document_id: "d1", code_id: "c1" }),
        mockSegment({ id: "s3", document_id: "d1", code_id: "c2" }),
      ],
    });
    expect(screen.getByText("Code A")).toBeInTheDocument();
    expect(screen.getByText("Code B")).toBeInTheDocument();
    expect(screen.getByText("Doc 1")).toBeInTheDocument();
    // Count cells with segment counts
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // Code A count
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1); // Code B count
  });
});
