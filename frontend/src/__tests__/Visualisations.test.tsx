import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import Visualisations from "@/components/Visualisations";

expect.extend(toHaveNoViolations);

// Mock recharts (not needed at this level but sub-components use it)
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => <div />,
  Legend: () => <div />,
}));

vi.mock("@/stores/store", () => ({
  useStore: vi.fn((sel) =>
    sel({
      codes: [],
      documents: [],
      segments: [],
      alerts: [],
      analyses: [],
    })
  ),
}));

describe("Visualisations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 3 sub-tabs", () => {
    render(<Visualisations />);
    expect(screen.getByText("Frequencies")).toBeInTheDocument();
    expect(screen.getByText(/Code.*Document/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Analytics/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Visualisations />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
