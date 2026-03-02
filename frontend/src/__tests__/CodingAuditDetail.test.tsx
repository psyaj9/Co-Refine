import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CodingAuditDetail from "@/components/CodingAuditDetail";
import { mockAlert, mockCode } from "./test-helpers";

describe("CodingAuditDetail", () => {
  const baseProps = {
    alert: mockAlert({
      type: "coding_audit",
      segment_id: "seg-1",
      code_label: "Theme A",
      data: {
        self_lens: {
          is_consistent: false,
          suggestion: "Consider re-coding",
          drift_warning: "Possible drift",
          alternative_codes: ["Alt Code"],
        },
      },
    }),
    alertIdx: 0,
    codes: [mockCode(), mockCode({ id: "c2", label: "Alt Code" })],
    applySuggestedCode: vi.fn(),
    keepMyCode: vi.fn(),
  };

  it("renders self-consistency section", () => {
    render(<CodingAuditDetail {...baseProps} />);
    expect(screen.getByText(/Self-Consistency/i)).toBeInTheDocument();
  });

  it("shows drift warning", () => {
    render(<CodingAuditDetail {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/toggle self-consistency/i));
    expect(screen.getByText(/Possible drift/i)).toBeInTheDocument();
  });

  it("shows alternative code buttons", () => {
    render(<CodingAuditDetail {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/toggle self-consistency/i));
    expect(screen.getByText(/Alt Code/i)).toBeInTheDocument();
  });

  it("returns null when no lens data", () => {
    const { container } = render(
      <CodingAuditDetail
        {...baseProps}
        alert={mockAlert({ type: "coding_audit", data: {} })}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  // Inter-rater lens tests — commented out while feature is disabled
  // it("shows inter-rater section when present", () => { ... });
  // it("calls applySuggestedCode for inter-rater apply button", () => { ... });
});
