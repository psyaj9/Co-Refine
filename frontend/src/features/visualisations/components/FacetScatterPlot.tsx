/**
 * FacetScatterPlot — D3-driven 2D scatter plot.
 *
 * Overview mode: star shapes for code centroids, faded circles for facet segments.
 *   - No code labels on stars (legend at bottom covers that).
 * Drill-down mode: only segments for the selected code, labelled with facet name.
 *   - Hover a dot to see the full segment text in a floating tooltip.
 */
import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { FacetData } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CodeCentroid {
  codeId: string;
  codeName: string;
  x: number;
  y: number;
  colour: string;
}

interface SegmentDot {
  segmentId: string;
  facetId: string;
  facetLabel: string;
  codeId: string;
  x: number;
  y: number;
  colour: string;
  text: string;
}

interface Tooltip {
  /** Screen-relative X inside the container div */
  x: number;
  /** Screen-relative Y inside the container div */
  y: number;
  text: string;
}

export interface FacetScatterPlotProps {
  facets: FacetData[];
  /** Colour keyed by code_id — derived externally for consistency */
  colourMap: Record<string, string>;
  /** If set, only show segments for this code (drill-down mode) */
  drillCodeId?: string | null;
  /** Called when a star centroid is clicked in overview mode */
  onStarClick?: (codeId: string) => void;
  /** Highlighted facet id (hover in card list) */
  highlightFacetId?: string | null;
  width?: number;
  height?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SVG path for a 5-pointed star centred at (cx, cy). */
function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return `M${pts.map(([x, y]) => `${x},${y}`).join("L")}Z`;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 48 };

/**
 * Distinct colours used for per-facet colouring in drill-down mode.
 * Chosen for good contrast against both light and dark backgrounds.
 */
const DRILL_PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7", "#e11d48", "#22c55e", "#eab308",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FacetScatterPlot({
  facets,
  colourMap,
  drillCodeId,
  onStarClick,
  highlightFacetId,
  width = 640,
  height = 420,
}: FacetScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  /** Filter to relevant facets */
  const visibleFacets = useMemo(
    () => (drillCodeId ? facets.filter((f) => f.code_id === drillCodeId) : facets),
    [facets, drillCodeId]
  );

  /** Flatten all segments across visible facets */
  const allSegments = useMemo<SegmentDot[]>(
    () =>
      visibleFacets.flatMap((f) =>
        f.segments.map((s) => ({
          segmentId: s.segment_id,
          facetId: f.facet_id,
          facetLabel: f.facet_label,
          codeId: f.code_id,
          x: s.tsne_x,
          y: s.tsne_y,
          colour: colourMap[f.code_id] ?? "#6b7280",
          text: s.text_preview,
        }))
      ),
    [visibleFacets, colourMap]
  );

  /**
   * In drill-down mode, assign each facet its own colour from DRILL_PALETTE
   * so every sub-theme cluster is visually distinct.
   */
  const drillFacetColourMap = useMemo<Record<string, string>>(() => {
    if (!drillCodeId) return {};
    const facetIds = Array.from(new Set(visibleFacets.map((f) => f.facet_id)));
    return Object.fromEntries(
      facetIds.map((id, i) => [id, DRILL_PALETTE[i % DRILL_PALETTE.length]])
    );
  }, [drillCodeId, visibleFacets]);

  /** Compute code centroids only in overview mode */
  const centroids = useMemo<CodeCentroid[]>(() => {
    if (drillCodeId) return [];
    const byCode = new Map<string, { name: string; xs: number[]; ys: number[] }>();
    for (const f of facets) {
      if (!byCode.has(f.code_id)) {
        byCode.set(f.code_id, { name: f.code_name, xs: [], ys: [] });
      }
      const entry = byCode.get(f.code_id)!;
      for (const s of f.segments) {
        entry.xs.push(s.tsne_x);
        entry.ys.push(s.tsne_y);
      }
    }
    return Array.from(byCode.entries()).map(([codeId, { name, xs, ys }]) => ({
      codeId,
      codeName: name,
      x: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
      y: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0,
      colour: colourMap[codeId] ?? "#6b7280",
    }));
  }, [facets, drillCodeId, colourMap]);

  /** D3 scales — recalculate whenever visible data changes */
  const { xScale, yScale } = useMemo(() => {
    const allX = allSegments.map((d) => d.x);
    const allY = allSegments.map((d) => d.y);

    if (!allX.length) {
      return {
        xScale: d3.scaleLinear().domain([-1, 1]).range([0, plotW]),
        yScale: d3.scaleLinear().domain([-1, 1]).range([plotH, 0]),
      };
    }

    // Add 22% padding around actual data spread so points don't clump in centre
    const xBand = (d3.max(allX)! - d3.min(allX)!) * 0.22 || 1;
    const yBand = (d3.max(allY)! - d3.min(allY)!) * 0.22 || 1;

    return {
      xScale: d3
        .scaleLinear()
        .domain([d3.min(allX)! - xBand, d3.max(allX)! + xBand])
        .nice()
        .range([0, plotW]),
      yScale: d3
        .scaleLinear()
        .domain([d3.min(allY)! - yBand, d3.max(allY)! + yBand])
        .nice()
        .range([plotH, 0]),
    };
  }, [allSegments, plotW, plotH]);

  /** Draw axes with D3 */
  useEffect(() => {
    if (!svgRef.current) return;
    const g = d3.select(svgRef.current).select<SVGGElement>("g.axes");

    g.selectAll("*").remove();

    const xAxis = d3.axisBottom(xScale).ticks(5).tickSize(-plotH);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickSize(-plotW);

    g.append("g")
      .attr("transform", `translate(0,${plotH})`)
      .call(xAxis)
      .call((ag) => {
        ag.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3");
        ag.selectAll("text").attr("font-size", "10").attr("fill", "#9ca3af");
        ag.select(".domain").remove();
      });

    g.append("g")
      .call(yAxis)
      .call((ag) => {
        ag.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3");
        ag.selectAll("text").attr("font-size", "10").attr("fill", "#9ca3af");
        ag.select(".domain").remove();
      });
  }, [xScale, yScale, plotW, plotH]);

  const isDrillDown = Boolean(drillCodeId);

  function handleDotMouseEnter(e: React.MouseEvent<SVGCircleElement>, dot: SegmentDot) {
    if (!dot.text) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const TOOLTIP_W = 260;
    const TOOLTIP_H = 120; // approximate
    let x = e.clientX - rect.left + 12;
    let y = e.clientY - rect.top + 12;
    // Clamp so tooltip doesn't overflow the right/bottom edge
    if (x + TOOLTIP_W > rect.width) x = e.clientX - rect.left - TOOLTIP_W - 8;
    if (y + TOOLTIP_H > rect.height) y = e.clientY - rect.top - TOOLTIP_H - 8;
    setTooltip({ x, y, text: dot.text });
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        aria-label="Facet scatter plot"
        style={{ overflow: "visible" }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Axes (managed by D3 useEffect) */}
          <g className="axes" />

          {/* Segment dots */}
          {allSegments.map((dot) => {
            const isHighlighted = highlightFacetId ? dot.facetId === highlightFacetId : true;
            // In drill-down use per-facet distinct colour; in overview use code colour
            const dotColour = isDrillDown
              ? (drillFacetColourMap[dot.facetId] ?? dot.colour)
              : dot.colour;
            return (
              <g key={dot.segmentId}>
                <circle
                  cx={xScale(dot.x)}
                  cy={yScale(dot.y)}
                  r={isDrillDown ? 5 : 4}
                  fill={dotColour}
                  opacity={isHighlighted ? (isDrillDown ? 0.80 : 0.45) : 0.12}
                  stroke={dotColour}
                  strokeWidth={0.5}
                  style={{ cursor: dot.text ? "pointer" : "default" }}
                  onMouseEnter={(e) => handleDotMouseEnter(e, dot)}
                  onMouseLeave={() => setTooltip(null)}
                />
                {/* In drill-down, show truncated facet label near each dot */}
                {isDrillDown && isHighlighted && (
                  <text
                    x={xScale(dot.x) + 7}
                    y={yScale(dot.y) + 4}
                    fontSize={8}
                    fill={dotColour}
                    opacity={0.90}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {dot.facetLabel.length > 25
                      ? dot.facetLabel.slice(0, 23) + "…"
                      : dot.facetLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Code centroids as stars (overview mode only) — no code labels (see legend below chart) */}
          {centroids.map((c) => (
            <g
              key={c.codeId}
              style={{ cursor: onStarClick ? "pointer" : "default" }}
              onClick={() => onStarClick?.(c.codeId)}
              role="button"
              aria-label={`Drill into code: ${c.codeName}`}
            >
              <title>{c.codeName}</title>
              {/* Glow/halo */}
              <circle
                cx={xScale(c.x)}
                cy={yScale(c.y)}
                r={14}
                fill={c.colour}
                opacity={0.15}
              />
              {/* Star shape */}
              <path
                d={starPath(xScale(c.x), yScale(c.y), 10, 4.5)}
                fill={c.colour}
                stroke="white"
                strokeWidth={1}
                opacity={0.95}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Floating tooltip — renders full segment text on dot hover */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            maxWidth: 260,
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-900 dark:bg-surface-900 text-surface-100 shadow-xl px-3 py-2 text-xs leading-relaxed"
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
