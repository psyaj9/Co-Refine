import { useEffect, useState } from "react";
import type { SegmentOut } from "@/shared/types";
import {
  PILL_HEIGHT,
  PILL_GAP,
  GROUP_GAP,
  MAX_VISIBLE_PILLS,
  type PillGroup,
} from "../components/MarginPills";

/**
 * Computes the layout (position + grouping) for margin pills via requestAnimationFrame.
 * Uses DOM measurements on mark[data-start] elements to anchor each pill group
 * to the corresponding highlighted text, with collision avoidance.
 */
export function useMarginPillLayout(
  segments: SegmentOut[],
  textRef: React.RefObject<HTMLDivElement | null>,
  annotatedHtml: string,
  expandedGroups: Set<string>,
): PillGroup[] {
  const [pillGroups, setPillGroups] = useState<PillGroup[]>([]);

  useEffect(() => {
    if (!textRef.current || segments.length === 0) {
      setPillGroups([]);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const textEl = textRef.current;
      if (!textEl) return;
      const textRect = textEl.getBoundingClientRect();

      // Map each unique (start, end) span → its top offset in the text container
      const marks = textEl.querySelectorAll<HTMLElement>("mark[data-start]");
      const markPositionMap = new Map<string, number>();
      marks.forEach((mark) => {
        const s = mark.dataset.start;
        const e = mark.dataset.end;
        if (s !== undefined && e !== undefined) {
          const key = `${s}-${e}`;
          if (!markPositionMap.has(key)) {
            markPositionMap.set(key, mark.getBoundingClientRect().top - textRect.top);
          }
        }
      });

      // Resolve each segment to a top-px position (exact match first, then overlap)
      const segWithTop: { top: number; seg: SegmentOut }[] = [];
      for (const seg of segments) {
        const exactKey = `${seg.start_index}-${seg.end_index}`;
        let topPx = markPositionMap.get(exactKey);
        if (topPx === undefined) {
          for (const [key, px] of markPositionMap) {
            const [ms, me] = key.split("-").map(Number);
            if (ms <= seg.start_index && me >= seg.end_index) {
              topPx = px;
              break;
            }
          }
        }
        if (topPx !== undefined) segWithTop.push({ top: topPx, seg });
      }

      // Group segments by exact span
      const groupMap = new Map<string, { anchorTop: number; pills: SegmentOut[] }>();
      for (const item of segWithTop) {
        const key = `${item.seg.start_index}-${item.seg.end_index}`;
        if (!groupMap.has(key)) groupMap.set(key, { anchorTop: item.top, pills: [] });
        groupMap.get(key)!.pills.push(item.seg);
      }
      for (const g of groupMap.values()) {
        g.pills.sort((a, b) => a.code_label.localeCompare(b.code_label));
      }

      const sortedGroups = Array.from(groupMap.entries())
        .map(([rangeKey, g]) => ({ rangeKey, ...g }))
        .sort((a, b) => a.anchorTop - b.anchorTop);

      // Collision avoidance: push groups down to maintain minimum gap
      const finalGroups: PillGroup[] = [];
      let lastBottom = -Infinity;

      for (const g of sortedGroups) {
        const isExpanded = expandedGroups.has(g.rangeKey);
        const visibleCount = isExpanded ? g.pills.length : Math.min(g.pills.length, MAX_VISIBLE_PILLS);
        const hasOverflow = g.pills.length > MAX_VISIBLE_PILLS;
        const groupHeight =
          visibleCount * PILL_HEIGHT +
          (visibleCount - 1) * PILL_GAP +
          (hasOverflow && !isExpanded ? PILL_HEIGHT : 0);

        const minTop = lastBottom > -Infinity ? lastBottom + GROUP_GAP : 0;
        const renderedTop = Math.max(g.anchorTop, minTop);

        finalGroups.push({
          rangeKey: g.rangeKey,
          anchorTop: g.anchorTop,
          renderedTop,
          pills: g.pills,
          expanded: isExpanded,
        });
        lastBottom = renderedTop + groupHeight;
      }

      setPillGroups(finalGroups);
    });

    return () => cancelAnimationFrame(rafId);
  }, [annotatedHtml, segments, expandedGroups, textRef]);

  return pillGroups;
}
