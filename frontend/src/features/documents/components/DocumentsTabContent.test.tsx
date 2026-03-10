import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import DocumentsTabContent from "./DocumentsTabContent";
import { defaultStoreState, mockDocument } from "@/shared/__tests__/test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/shared/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/shared/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<DocumentsTabContent />);
}

describe("DocumentsTabContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders document list", () => {
    setup();
    expect(screen.getByText("Test Document")).toBeInTheDocument();
  });

  it("shows empty state with upload button when no documents", () => {
    setup({ documents: [] });
    expect(screen.getByText(/upload document/i)).toBeInTheDocument();
  });

  it("highlights active document", () => {
    setup({
      documents: [
        mockDocument({ id: "doc-1", title: "Doc A" }),
        mockDocument({ id: "doc-2", title: "Doc B" }),
      ],
      activeDocumentId: "doc-1",
    });
    const activeItem = screen.getByText("Doc A").closest("li");
    expect(activeItem).toHaveAttribute("aria-selected", "true");
  });

  it("calls setActiveDocument and loadSegments on click", () => {
    const setActiveDocument = vi.fn();
    const loadSegments = vi.fn();
    setup({
      documents: [mockDocument({ id: "doc-1", title: "Doc A" })],
      activeDocumentId: null,
      setActiveDocument,
      loadSegments,
    });
    fireEvent.click(screen.getByText("Doc A"));
    expect(setActiveDocument).toHaveBeenCalledWith("doc-1");
    expect(loadSegments).toHaveBeenCalledWith("doc-1");
  });

  it("shows search when more than 3 documents", () => {
    setup({
      documents: [
        mockDocument({ id: "d1", title: "A" }),
        mockDocument({ id: "d2", title: "B" }),
        mockDocument({ id: "d3", title: "C" }),
        mockDocument({ id: "d4", title: "D" }),
      ],
    });
    expect(screen.getByPlaceholderText(/filter/i)).toBeInTheDocument();
  });

  it("does not show search when 3 or fewer documents", () => {
    setup({
      documents: [mockDocument()],
    });
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container, {
      rules: { "nested-interactive": { enabled: false } },
    })).toHaveNoViolations();
  });
});
