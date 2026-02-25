import { useCallback, useEffect, useState } from "react";
import type { SegmentOut } from "@/types";

/** A group of pills sharing the same text range (start_index + end_index). */
export interface PillGroup {
  rangeKey: string;
  anchorTop: number;
  renderedTop: number;
  pills: SegmentOut[];
  expanded: boolean;
}

export const PILL_HEIGHT = 22;
export const PILL_GAP = 2;
export const GROUP_GAP = 12;
export const MAX_VISIBLE_PILLS = 4;

interface MarginPillsProps {
  segments: SegmentOut[];
  textRef: React.RefObject<HTMLDivElement | null>;
  annotatedHtml: string;
  onClickSegments: (segs: SegmentOut[]) => void;
}

export default function MarginPills({
  segments,
  textRef,
  annotatedHtml,
  onClickSegments,
}: MarginPillsProps) {
  const [pillGroups, setPillGroups] = useState<PillGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpand = useCallback((rangeKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(rangeKey)) next.delete(rangeKey);
      else next.add(rangeKey);
      return next;
    });
  }, []);

  // Measure marks and compute pill positions
  useEffect(() => {
    if (!textRef.current || segments.length === 0) {
      setPillGroups([]);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const textEl = textRef.current;
      if (!textEl) return;
      const textRect = textEl.getBoundingClientRect();

      // Measure <mark> positions
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

      // Map segments to measured positions
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

      // Group by range
      const groupMap = new Map<string, { anchorTop: number; pills: SegmentOut[] }>();
      for (const item of segWithTop) {
        const key = `${item.seg.start_index}-${item.seg.end_index}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { anchorTop: item.top, pills: [] });
        }
        groupMap.get(key)!.pills.push(item.seg);
      }
      for (const g of groupMap.values()) {
        g.pills.sort((a, b) => a.code_label.localeCompare(b.code_label));
      }

      // Sort groups and stack with gaps
      const sortedGroups = Array.from(groupMap.entries())
        .map(([rangeKey, g]) => ({ rangeKey, ...g }))
        .sort((a, b) => a.anchorTop - b.anchorTop);

      const finalGroups: PillGroup[] = [];
      let lastBottom = -Infinity;

      for (const g of sortedGroups) {
        const isExpanded = expandedGroups.has(g.rangeKey);
        const visibleCount = isExpanded
          ? g.pills.length
          : Math.min(g.pills.length, MAX_VISIBLE_PILLS);
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

  if (pillGroups.length === 0) {
    return (
      <p className="text-2xs text-surface-400 dark:text-surface-600 italic px-1 pt-4">
        Code annotations will appear here
      </p>
    );
  }

  return (
    <>
      {/* SVG connector lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        {pillGroups.map((group) => {
          const firstPillColour = group.pills[0]?.code_colour || "#6366f1";
          const anchorY = group.anchorTop + PILL_HEIGHT / 2;
          const pillY = group.renderedTop + PILL_HEIGHT / 2;
          const drift = Math.abs(group.renderedTop - group.anchorTop);
          if (drift < 4) return null;
          return (
            <path
              key={group.rangeKey}
              d={`M 0 ${anchorY} C 8 ${anchorY}, 8 ${pillY}, 16 ${pillY}`}
              stroke={firstPillColour}
              strokeWidth="1.5"
              strokeOpacity="0.35"
              fill="none"
            />
          );
        })}
      </svg>

      {/* Pill groups */}
      {pillGroups.map((group) => {
        const visiblePills = group.expanded
          ? group.pills
          : group.pills.slice(0, MAX_VISIBLE_PILLS);
        const hiddenCount = group.pills.length - MAX_VISIBLE_PILLS;
        const hasOverflow = group.pills.length > MAX_VISIBLE_PILLS;
        const groupColour = group.pills[0]?.code_colour || "#6366f1";

        return (
          <div
            key={group.rangeKey}
            className="pill-group absolute left-0 right-1"
            style={{ top: `${group.renderedTop}px`, borderLeftColor: groupColour }}
          >
            {visiblePills.map((seg, i) => (
              <div
                key={seg.id}
                className="ml-3 mr-0"
                style={{ marginTop: i === 0 ? 0 : `${PILL_GAP}px` }}
              >
                <div
                  className="margin-pill text-white"
                  style={{ backgroundColor: seg.code_colour }}
                  onClick={() => {
                    const matched = segments.filter(
                      (s) =>
                        s.code_id === seg.code_id &&
                        s.start_index === seg.start_index &&
                        s.end_index === seg.end_index
                    );
                    if (matched.length > 0) onClickSegments(matched);
                  }}
                  title={`${seg.code_label}: "${seg.text.slice(0, 50)}..."`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Code: ${seg.code_label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const matched = segments.filter(
                        (s) =>
                          s.code_id === seg.code_id &&
                          s.start_index === seg.start_index &&
                          s.end_index === seg.end_index
                      );
                      if (matched.length > 0) onClickSegments(matched);
                    }
                  }}
                >
                  {seg.code_label}
                </div>
              </div>
            ))}

            {hasOverflow && (
              <div className="ml-3 mr-0 mt-0.5">
                <button
                  className="pill-overflow-btn"
                  onClick={() => toggleGroupExpand(group.rangeKey)}
                  aria-expanded={group.expanded}
                >
                  {group.expanded ? "Show less" : `+${hiddenCount} more`}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
