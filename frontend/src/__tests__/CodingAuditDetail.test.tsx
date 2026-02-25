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

  it("shows inter-rater section when present", () => {
    const alertWithInter = mockAlert({
      type: "coding_audit",
      segment_id: "seg-1",
      code_label: "Theme A",
      data: {
        inter_rater_lens: {
          is_conflict: true,
          predicted_code: "Theme B",
          conflict_explanation: "Different interpretation",
        },
      },
    });
    render(
      <CodingAuditDetail
        {...baseProps}
        alert={alertWithInter}
      />
    );
    expect(screen.getByText(/Inter-Rater/i)).toBeInTheDocument();
  });

  it("calls applySuggestedCode for inter-rater apply button", () => {
    const applySuggestedCode = vi.fn();
    const alertWithInter = mockAlert({
      type: "coding_audit",
      segment_id: "seg-1",
      code_label: "Theme A",
      data: {
        inter_rater_lens: {
          is_conflict: true,
          predicted_code: "Theme B",
          conflict_explanation: "Different interpretation",
        },
      },
    });
    render(
      <CodingAuditDetail
        {...baseProps}
        alert={alertWithInter}
        codes={[mockCode(), mockCode({ id: "c2", label: "Theme B" })]}
        applySuggestedCode={applySuggestedCode}
      />
    );
    fireEvent.click(screen.getByLabelText(/toggle inter-rater/i));
    const applyBtn = screen.getByText(/Apply.*Theme B/i);
    fireEvent.click(applyBtn);
    expect(applySuggestedCode).toHaveBeenCalledWith("seg-1", "Theme B", 0);
  });
});
