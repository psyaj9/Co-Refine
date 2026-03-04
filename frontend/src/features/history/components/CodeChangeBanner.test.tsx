import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CodeChangeBanner from "@/components/history/CodeChangeBanner";
import { mockEditEvent } from "@/shared/__tests__/test-helpers";

describe("CodeChangeBanner", () => {
  it("renders event summary for segment creation", () => {
    render(<CodeChangeBanner event={mockEditEvent()} />);
    expect(screen.getByText(/Applied.*Theme A/i)).toBeInTheDocument();
  });

  it("shows old→new diff for code updates", () => {
    render(
      <CodeChangeBanner
        event={mockEditEvent({
          entity_type: "code",
          action: "updated",
          field_changed: "definition",
          old_value: "Old def",
          new_value: "New def",
        })}
      />
    );
    expect(screen.getByText(/Old def/)).toBeInTheDocument();
    expect(screen.getByText(/New def/)).toBeInTheDocument();
  });

  it("renders segment deletion summary", () => {
    render(
      <CodeChangeBanner
        event={mockEditEvent({ action: "deleted" })}
      />
    );
    expect(screen.getByText(/Removed.*Theme A/i)).toBeInTheDocument();
  });
});
