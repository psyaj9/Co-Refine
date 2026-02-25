import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import Toolbar from "@/components/Toolbar";
import { defaultStoreState } from "./test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<Toolbar />);
}

describe("Toolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders toolbar landmark", () => {
    setup();
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("shows action buttons when project is active", () => {
    setup();
    expect(screen.getByLabelText(/add document/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/document view/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/visualisations/i)).toBeInTheDocument();
  });

  it("hides action buttons when no project", () => {
    setup({ activeProjectId: null });
    expect(screen.queryByLabelText(/document view/i)).not.toBeInTheDocument();
  });

  it("toggles upload page on click", () => {
    const setShowUploadPage = vi.fn();
    setup({ setShowUploadPage });
    fireEvent.click(screen.getByLabelText(/add document/i));
    expect(setShowUploadPage).toHaveBeenCalled();
  });

  it("switches view mode on click", () => {
    const setViewMode = vi.fn();
    setup({ setViewMode });
    fireEvent.click(screen.getByLabelText(/visualisations/i));
    expect(setViewMode).toHaveBeenCalledWith("visualisation");
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows Edit History button when document and project are active", () => {
    setup({ activeDocumentId: "doc-1", activeProjectId: "proj-1" });
    expect(screen.getByLabelText(/edit history/i)).toBeInTheDocument();
  });

  it("hides Edit History on upload page", () => {
    setup({ showUploadPage: true });
    expect(screen.queryByLabelText(/edit history/i)).not.toBeInTheDocument();
  });
});
