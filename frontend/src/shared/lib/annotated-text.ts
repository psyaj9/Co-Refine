import { escapeHtml } from "@/shared/lib/utils";
import type { SegmentOut } from "@/shared/types";

/**
 * Merge overlapping segment ranges, tracking colours and flagged status.
 */
function mergeRangesWithColours(
  segments: SegmentOut[],
  flaggedIds: Set<string>
): { start: number; end: number; colour: string; flagged: boolean }[] {
  if (segments.length === 0) return [];

  const rangeMap = new Map<
    string,
    { start: number; end: number; colours: string[]; flagged: boolean }
  >();
  for (const seg of segments) {
    const key = `${seg.start_index}-${seg.end_index}`;
    if (!rangeMap.has(key)) {
      rangeMap.set(key, {
        start: seg.start_index,
        end: seg.end_index,
        colours: [],
        flagged: false,
      });
    }
    const entry = rangeMap.get(key)!;
    entry.colours.push(seg.code_colour);
    if (flaggedIds.has(seg.id)) entry.flagged = true;
  }

  const sorted = Array.from(rangeMap.values()).sort(
    (a, b) => a.start - b.start || a.end - b.end
  );
  const merged: { start: number; end: number; colour: string; flagged: boolean }[] = [];

  for (const range of sorted) {
    const colour = range.colours[0];
    if (merged.length > 0 && range.start <= merged[merged.length - 1].end) {
      const prev = merged[merged.length - 1];
      prev.end = Math.max(prev.end, range.end);
      if (range.flagged) prev.flagged = true;
    } else {
      merged.push({ start: range.start, end: range.end, colour, flagged: range.flagged });
    }
  }

  return merged;
}

/**
 * Build annotated HTML from full text + segments.
 * Flagged segments get a red highlight; others get indigo.
 */
export function buildAnnotatedText(
  fullText: string,
  segments: SegmentOut[],
  flaggedIds: Set<string> = new Set()
): string {
  if (segments.length === 0) return escapeHtml(fullText);

  const ranges = mergeRangesWithColours(segments, flaggedIds);
  const parts: string[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (cursor < range.start) {
      parts.push(escapeHtml(fullText.slice(cursor, range.start)));
    }
    const markStyle = range.flagged
      ? `background-color:rgba(239,68,68,0.12);border-bottom:2px solid rgba(239,68,68,0.55)`
      : `background-color:rgba(99,102,241,0.15);border-bottom:2px solid rgba(99,102,241,0.45)`;
    parts.push(
      `<mark data-start="${range.start}" data-end="${range.end}" style="${markStyle}">${escapeHtml(
        fullText.slice(range.start, range.end)
      )}</mark>`
    );
    cursor = range.end;
  }

  if (cursor < fullText.length) {
    parts.push(escapeHtml(fullText.slice(cursor)));
  }

  return parts.join("");
}
