/**
 * Accessibility tests for utility functions.
 */
import { describe, it, expect } from "vitest";
import { getContrastColor } from "@/shared/lib/utils";

describe("getContrastColor", () => {
  it("returns black for white background", () => {
    expect(getContrastColor("#ffffff")).toBe("#000000");
  });

  it("returns white for black background", () => {
    expect(getContrastColor("#000000")).toBe("#ffffff");
  });

  it("returns white for dark blue", () => {
    expect(getContrastColor("#1e3a5f")).toBe("#ffffff");
  });

  it("returns black for bright yellow", () => {
    expect(getContrastColor("#ffff00")).toBe("#000000");
  });

  it("handles short hex notation", () => {
    // #fff → white → should return black
    expect(getContrastColor("#fff")).toBe("#000000");
  });

  it("returns black for light colors like #e0e0e0", () => {
    expect(getContrastColor("#e0e0e0")).toBe("#000000");
  });

  it("returns white for medium-dark colors like #333333", () => {
    expect(getContrastColor("#333333")).toBe("#ffffff");
  });
});
