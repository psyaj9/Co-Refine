import { describe, it, expect } from "vitest";
import { buildAnnotatedText } from "@/lib/annotated-text";
import type { SegmentOut } from "@/types";

function seg(overrides: Partial<SegmentOut> = {}): SegmentOut {
  return {
    id: "s1",
    document_id: "d1",
    text: "hello",
    start_index: 0,
    end_index: 5,
    code_id: "c1",
    code_label: "Theme",
    code_colour: "#6366F1",
    user_id: "u1",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildAnnotatedText", () => {
  it("returns escaped text when no segments", () => {
    expect(buildAnnotatedText("<b>hi</b>", [])).toBe(
      "&lt;b&gt;hi&lt;/b&gt;"
    );
  });

  it("wraps segment range in <mark> with indigo style", () => {
    const html = buildAnnotatedText("hello world", [seg()]);
    expect(html).toContain("<mark");
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-end="5"');
    expect(html).toContain("hello");
    expect(html).toContain("99,102,241"); // indigo rgba highlight
    expect(html).toContain(" world"); // remaining text
  });

  it("renders flagged segments with red style", () => {
    const html = buildAnnotatedText("hello world", [seg()], new Set(["s1"]));
    expect(html).toContain("239,68,68"); // red rgba
  });

  it("renders non-flagged segments with indigo style", () => {
    const html = buildAnnotatedText("hello world", [seg()], new Set());
    expect(html).toContain("99,102,241"); // indigo rgba
  });

  it("handles adjacent non-overlapping segments", () => {
    const segments = [
      seg({ id: "s1", start_index: 0, end_index: 5 }),
      seg({ id: "s2", start_index: 6, end_index: 11 }),
    ];
    const html = buildAnnotatedText("hello world", segments);
    // Should have two <mark> tags
    const marks = html.match(/<mark/g);
    expect(marks).toHaveLength(2);
  });

  it("merges overlapping segments", () => {
    const segments = [
      seg({ id: "s1", start_index: 0, end_index: 7 }),
      seg({ id: "s2", start_index: 3, end_index: 10 }),
    ];
    const html = buildAnnotatedText("0123456789abc", segments);
    // Overlapping ranges merge into one <mark>
    const marks = html.match(/<mark/g);
    expect(marks).toHaveLength(1);
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-end="10"');
  });

  it("escapes HTML within segments", () => {
    const html = buildAnnotatedText("<b>hey</b>more", [
      seg({ start_index: 0, end_index: 8 }),
    ]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
});
