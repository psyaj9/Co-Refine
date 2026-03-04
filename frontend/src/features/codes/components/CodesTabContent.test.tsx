import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import CodesTabContent from "@/components/CodesTabContent";
import { defaultStoreState, mockCode } from "@/shared/__tests__/test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  triggerAnalysis: vi.fn().mockResolvedValue({ status: "ok" }),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<CodesTabContent />);
}

describe("CodesTabContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders code list", () => {
    setup();
    expect(screen.getByText("Theme A")).toBeInTheDocument();
  });

  it("shows add code form", () => {
    setup();
    expect(screen.getByPlaceholderText(/new code/i)).toBeInTheDocument();
  });

  it("calls addCode on form submit", () => {
    const addCode = vi.fn().mockResolvedValue(undefined);
    setup({ addCode, codes: [] });
    const input = screen.getByPlaceholderText(/new code/i);
    fireEvent.change(input, { target: { value: "New Theme" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(addCode).toHaveBeenCalled();
  });

  it("shows search when more than 3 codes", () => {
    setup({
      codes: [
        mockCode({ id: "c1", label: "A" }),
        mockCode({ id: "c2", label: "B" }),
        mockCode({ id: "c3", label: "C" }),
        mockCode({ id: "c4", label: "D" }),
      ],
    });
    expect(screen.getByPlaceholderText(/filter code/i)).toBeInTheDocument();
  });

  it("highlights active code", () => {
    setup({ activeCodeId: "code-1" });
    const item = screen.getByText("Theme A").closest('[role="option"]');
    expect(item?.className).toContain("brand");
  });

  it("calls setActiveCode on code click", () => {
    const setActiveCode = vi.fn();
    setup({ setActiveCode, activeCodeId: null });
    fireEvent.click(screen.getByText("Theme A"));
    expect(setActiveCode).toHaveBeenCalledWith("code-1");
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container, {
      rules: {
        "nested-interactive": { enabled: false },
        "listitem": { enabled: false },
        "aria-required-children": { enabled: false },
        "aria-required-parent": { enabled: false },
      },
    })).toHaveNoViolations();
  });
});
