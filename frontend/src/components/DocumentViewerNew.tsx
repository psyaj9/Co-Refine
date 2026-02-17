import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useStore } from "@/stores/store";
import { useTextSelection } from "@/hooks/useTextSelection";
import type { SegmentOut } from "@/types";

/** A group of pills that share the same text range (start_index + end_index) */
interface PillGroup {
  /** Unique key for the range, e.g. "120-345" */
  rangeKey: string;
  /** Y-offset of the highlighted <mark> in the text column */
  anchorTop: number;
  /** Computed Y-offset for the first pill after stacking */
  renderedTop: number;
  /** All segments in this group */
  pills: SegmentOut[];
  /** Whether the group is expanded (shows all pills) or collapsed */
  expanded: boolean;
}

const PILL_HEIGHT = 22;      // px – each pill's rendered height
const PILL_GAP = 2;          // px – gap between pills inside a group
const GROUP_GAP = 12;        // px – extra gap between different groups
const MAX_VISIBLE_PILLS = 4; // collapse after this many

export default function DocumentViewer() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const segments = useStore((s) => s.segments);
  const setClickedSegments = useStore((s) => s.setClickedSegments);
  const loadSegments = useStore((s) => s.loadSegments);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const handleMouseUp = useTextSelection(textRef);

  const doc = documents.find((d) => d.id === activeDocumentId);

  useEffect(() => {
    if (activeDocumentId) loadSegments(activeDocumentId);
  }, [activeDocumentId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-start]") as HTMLElement | null;
      if (!mark) return;

      const start = Number(mark.dataset.start);
      const end = Number(mark.dataset.end);

      const matched = segments.filter(
        (seg) => seg.start_index < end && seg.end_index > start
      );
      if (matched.length > 0) {
        setClickedSegments(matched);
      }
    },
    [segments, setClickedSegments]
  );

  // Build annotated HTML with per-code colours
  const annotatedHtml = useMemo(() => {
    if (!doc) return "";
    return buildAnnotatedText(doc.full_text, segments);
  }, [doc, segments]);

  // Split text into lines for line numbers
  const lineCount = useMemo(() => {
    if (!doc) return 0;
    return doc.full_text.split("\n").length;
  }, [doc]);

  // Grouped pill positions — computed after marks render
  const [pillGroups, setPillGroups] = useState<PillGroup[]>([]);

  // Track which groups are expanded by rangeKey
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpand = useCallback((rangeKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(rangeKey)) next.delete(rangeKey);
      else next.add(rangeKey);
      return next;
    });
  }, []);

  // After annotated HTML renders, measure actual <mark> element positions,
  // group segments by range, and stack groups with inter-group gaps
  useEffect(() => {
    if (!textRef.current || segments.length === 0) {
      setPillGroups([]);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const textEl = textRef.current;
      if (!textEl) return;
      const textRect = textEl.getBoundingClientRect();

      // ---- Step 1: measure <mark> positions ----
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

      // ---- Step 2: map each segment to its mark's top ----
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
        if (topPx !== undefined) {
          segWithTop.push({ top: topPx, seg });
        }
      }

      // ---- Step 3: group by range (start_index-end_index) ----
      const groupMap = new Map<string, { anchorTop: number; pills: SegmentOut[] }>();
      for (const item of segWithTop) {
        const key = `${item.seg.start_index}-${item.seg.end_index}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { anchorTop: item.top, pills: [] });
        }
        groupMap.get(key)!.pills.push(item.seg);
      }

      // Sort pills within each group alphabetically
      for (const g of groupMap.values()) {
        g.pills.sort((a, b) => a.code_label.localeCompare(b.code_label));
      }

      // ---- Step 4: sort groups by anchorTop ----
      const sortedGroups = Array.from(groupMap.entries())
        .map(([rangeKey, g]) => ({ rangeKey, ...g }))
        .sort((a, b) => a.anchorTop - b.anchorTop);

      // ---- Step 5: stack groups with inter-group gaps ----
      const finalGroups: PillGroup[] = [];
      let lastBottom = -Infinity;

      for (const g of sortedGroups) {
        const isExpanded = expandedGroups.has(g.rangeKey);
        const visibleCount = isExpanded
          ? g.pills.length
          : Math.min(g.pills.length, MAX_VISIBLE_PILLS);
        const hasOverflow = g.pills.length > MAX_VISIBLE_PILLS;
        // Height: pills + gaps + optional "+N more" row
        const groupHeight =
          visibleCount * PILL_HEIGHT +
          (visibleCount - 1) * PILL_GAP +
          (hasOverflow && !isExpanded ? PILL_HEIGHT : 0);

        // Anchor the group to its mark position, but push down if it would overlap the previous group
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
  }, [annotatedHtml, segments, expandedGroups]);

  if (!doc) return null;

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Document header */}
      <div className="px-4 pt-3 pb-2 border-b panel-border panel-bg flex-shrink-0 z-10">
        <h2 className="text-sm font-bold text-surface-700 dark:text-surface-200">{doc.title}</h2>
        <p className="text-2xs text-surface-400">
          {doc.doc_type} · {doc.full_text.length.toLocaleString()} chars ·{" "}
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Scrollable body: line numbers + text + margin all scroll together */}
      <div className="flex-1 min-h-0 overflow-auto thin-scrollbar">
        <div className="flex min-h-full">
          {/* Line numbers gutter */}
          <div className="flex-shrink-0 pt-4 pb-4 select-none border-r panel-border bg-surface-50/50 dark:bg-surface-900/50">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="line-number leading-relaxed text-xs h-[1.625rem]">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap selection:bg-brand-100 dark:selection:bg-brand-700/30 cursor-text text-surface-700 dark:text-surface-200"
              dangerouslySetInnerHTML={{ __html: annotatedHtml }}
            />
          </div>

          {/* Margin area — grouped code pills with connector lines */}
          <div className="w-44 flex-shrink-0 border-l panel-border bg-surface-50/50 dark:bg-surface-900/50 relative">
            {pillGroups.length > 0 ? (
              <>
                {/* SVG connector lines layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                  {pillGroups.map((group) => {
                    // Draw a subtle connector line from the left edge to the anchor point
                    const firstPillColour = group.pills[0]?.code_colour || '#6366f1';
                    // Line goes from anchor Y on the left edge to the rendered group top
                    const anchorY = group.anchorTop + PILL_HEIGHT / 2;
                    const pillY = group.renderedTop + PILL_HEIGHT / 2;
                    // Only draw connector if group was pushed away from its anchor
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
                  const groupColour = group.pills[0]?.code_colour || '#6366f1';

                  return (
                    <div
                      key={group.rangeKey}
                      className="pill-group absolute left-0 right-1"
                      style={{
                        top: `${group.renderedTop}px`,
                        borderLeftColor: groupColour,
                      }}
                    >
                      {visiblePills.map((seg, i) => (
                        <div
                          key={seg.id}
                          className="ml-3 mr-0"
                          style={{
                            marginTop: i === 0 ? 0 : `${PILL_GAP}px`,
                          }}
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
                              if (matched.length > 0) setClickedSegments(matched);
                            }}
                            title={`${seg.code_label}: "${seg.text.slice(0, 50)}..."`}
                          >
                            {seg.code_label}
                          </div>
                        </div>
                      ))}

                      {/* "+N more" collapse / expand toggle */}
                      {hasOverflow && (
                        <div
                          className="ml-3 mr-0 mt-0.5"
                        >
                          <button
                            className="pill-overflow-btn"
                            onClick={() => toggleGroupExpand(group.rangeKey)}
                          >
                            {group.expanded
                              ? "Show less"
                              : `+${hiddenCount} more`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-2xs text-surface-400 dark:text-surface-600 italic px-1 pt-4">
                Code annotations will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function mergeRangesWithColours(segments: SegmentOut[]): { start: number; end: number; colour: string }[] {
  if (segments.length === 0) return [];

  // Group by unique start/end — use the first segment's colour
  const rangeMap = new Map<string, { start: number; end: number; colours: string[] }>();
  for (const seg of segments) {
    const key = `${seg.start_index}-${seg.end_index}`;
    if (!rangeMap.has(key)) {
      rangeMap.set(key, { start: seg.start_index, end: seg.end_index, colours: [] });
    }
    rangeMap.get(key)!.colours.push(seg.code_colour);
  }

  // Merge overlapping ranges
  const sorted = Array.from(rangeMap.values()).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number; colour: string }[] = [];

  for (const range of sorted) {
    // Mix colours: use the first one, or create a gradient effect
    const colour = range.colours[0];
    if (merged.length > 0 && range.start <= merged[merged.length - 1].end) {
      const prev = merged[merged.length - 1];
      prev.end = Math.max(prev.end, range.end);
      // Keep the existing colour for overlaps
    } else {
      merged.push({ start: range.start, end: range.end, colour });
    }
  }

  return merged;
}

function buildAnnotatedText(fullText: string, segments: SegmentOut[]): string {
  if (segments.length === 0) return escapeHtml(fullText);

  // Build event points for proper nesting of overlapping segments
  const events: { pos: number; type: "open" | "close"; seg: SegmentOut }[] = [];
  for (const seg of segments) {
    events.push({ pos: seg.start_index, type: "open", seg });
    events.push({ pos: seg.end_index, type: "close", seg });
  }
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    // Close before open at same position
    if (a.type === "close" && b.type === "open") return -1;
    if (a.type === "open" && b.type === "close") return 1;
    return 0;
  });

  // Merge ranges and apply one consistent highlight colour for all coded text
  const ranges = mergeRangesWithColours(segments);
  const parts: string[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (cursor < range.start) {
      parts.push(escapeHtml(fullText.slice(cursor, range.start)));
    }
    // Uniform indigo highlight — per-code colours still visible in the margin pills
    parts.push(
      `<mark data-start="${range.start}" data-end="${range.end}" style="background-color:rgba(99,102,241,0.15);border-bottom:2px solid rgba(99,102,241,0.45)">${escapeHtml(
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

function hexToRgba(hex: string, alpha: number): string {
  // Handle HSL colours
  if (hex.startsWith("hsl")) return hex.replace(")", `, ${alpha})`).replace("hsl", "hsla");

  // Handle hex
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
