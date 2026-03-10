import { useCallback, useState } from "react";
import type { SegmentOut } from "@/shared/types";
import { useMarginPillLayout } from "../hooks/useMarginPillLayout";

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const pillGroups = useMarginPillLayout(segments, textRef, annotatedHtml, expandedGroups);

  const toggleGroupExpand = useCallback((rangeKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(rangeKey)) next.delete(rangeKey);
      else next.add(rangeKey);
      return next;
    });
  }, []);

  if (pillGroups.length === 0) {
    return (
      <p className="text-2xs text-surface-400 dark:text-surface-600 italic px-1 pt-4">
        Code annotations will appear here
      </p>
    );
  }

  return (
    <>
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
                        s.end_index === seg.end_index,
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
                          s.end_index === seg.end_index,
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
