import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Convert hex (or hsl) colour to rgba string with given alpha */
export function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("hsl"))
    return hex.replace(")", `, ${alpha})`).replace("hsl", "hsla");
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Escape HTML special characters for safe innerHTML */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * WCAG-compliant contrast color selector.
 * Returns "#000000" or "#ffffff" depending on which provides
 * better contrast against the given background color (≥ 4.5:1).
 */
export function getContrastColor(hex: string): "#000000" | "#ffffff" {
  let clean = hex.replace("#", "");
  // Expand 3-char hex to 6-char (e.g. "fff" → "ffffff")
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  // Convert sRGB to relative luminance (WCAG 2.x formula)
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Contrast ratio against white vs black
  // White luminance = 1.0, Black luminance = 0.0
  const contrastWithWhite = (1.0 + 0.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0.0 + 0.05);

  return contrastWithBlack > contrastWithWhite ? "#000000" : "#ffffff";
}
