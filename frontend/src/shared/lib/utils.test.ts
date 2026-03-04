import { describe, it, expect } from "vitest";
import { cn, hexToRgba, escapeHtml, getContrastColor } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("deduplicates Tailwind classes via twMerge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("hexToRgba", () => {
  it("converts 6-char hex to rgba", () => {
    expect(hexToRgba("#FF0000", 0.5)).toBe("rgba(255,0,0,0.5)");
  });

  it("handles hex without hash", () => {
    expect(hexToRgba("00FF00", 1)).toBe("rgba(0,255,0,1)");
  });

  it("converts hsl to hsla", () => {
    expect(hexToRgba("hsl(120, 50%, 50%)", 0.3)).toBe(
      "hsla(120, 50%, 50%, 0.3)"
    );
  });

  it("returns zeros for invalid hex", () => {
    expect(hexToRgba("#xyz", 1)).toBe("rgba(0,0,0,1)");
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("getContrastColor", () => {
  it("returns white for dark backgrounds", () => {
    expect(getContrastColor("#000000")).toBe("#ffffff");
    expect(getContrastColor("#1B5E20")).toBe("#ffffff");
  });

  it("returns black for light backgrounds", () => {
    expect(getContrastColor("#FFFFFF")).toBe("#000000");
    expect(getContrastColor("#FFEB3B")).toBe("#000000");
  });

  it("handles 3-char hex", () => {
    expect(getContrastColor("#fff")).toBe("#000000");
    expect(getContrastColor("#000")).toBe("#ffffff");
  });
});
