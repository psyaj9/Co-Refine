/**
 * FacetScatterPlot — D3-driven 2D scatter plot.
 *
 * Overview mode: star shapes for code centroids, faded circles for facet segments.
 * Drill-down mode: only segments for the selected code, labelled with facet name.
 *   - Hover a dot to see the full segment text in a floating tooltip.
 */
import { useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";
import type { FacetData } from "@/shared/types";
import { starPath, buildScales, buildDrillColourMap } from "../lib/d3-scatter-utils";
import { useScatterTooltip } from "../hooks/useScatterTooltip";

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

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 20, right: 20, bottom: 40, left: 48 };

const DRILL_PALETTE = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
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
  const { tooltip, showTooltip, hideTooltip } = useScatterTooltip(containerRef);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const visibleFacets = useMemo(
    () => (drillCodeId ? facets.filter((f) => f.code_id === drillCodeId) : facets),
    [facets, drillCodeId],
  );

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
        })),
      ),
    [visibleFacets, colourMap],
  );

  const drillFacetColourMap = useMemo<Record<string, string>>(() => {
    if (!drillCodeId) return {};
    const facetIds = Array.from(new Set(visibleFacets.map((f) => f.facet_id)));
    return buildDrillColourMap(facetIds, DRILL_PALETTE);
  }, [drillCodeId, visibleFacets]);

  const centroids = useMemo<CodeCentroid[]>(() => {
    if (drillCodeId) return [];
    const byCode = new Map<string, { name: string; xs: number[]; ys: number[] }>();
    for (const f of facets) {
      if (!byCode.has(f.code_id)) byCode.set(f.code_id, { name: f.code_name, xs: [], ys: [] });
      const entry = byCode.get(f.code_id)!;
      for (const s of f.segments) { entry.xs.push(s.tsne_x); entry.ys.push(s.tsne_y); }
    }
    return Array.from(byCode.entries()).map(([codeId, { name, xs, ys }]) => ({
      codeId,
      codeName: name,
      x: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
      y: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0,
      colour: colourMap[codeId] ?? "#6b7280",
    }));
  }, [facets, drillCodeId, colourMap]);

  const { xScale, yScale } = useMemo(() => {
    const allX = allSegments.map((d) => d.x);
    const allY = allSegments.map((d) => d.y);
    return buildScales(allX, allY, plotW, plotH);
  }, [allSegments, plotW, plotH]);

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
          <g className="axes" />

          {allSegments.map((dot) => {
            const isHighlighted = highlightFacetId ? dot.facetId === highlightFacetId : true;
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
                  onMouseEnter={(e) => showTooltip(e, dot.text)}
                  onMouseLeave={hideTooltip}
                />
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

          {centroids.map((c) => (
            <g
              key={c.codeId}
              style={{ cursor: onStarClick ? "pointer" : "default" }}
              onClick={() => onStarClick?.(c.codeId)}
              role="button"
              aria-label={`Drill into code: ${c.codeName}`}
            >
              <title>{c.codeName}</title>
              <circle cx={xScale(c.x)} cy={yScale(c.y)} r={14} fill={c.colour} opacity={0.15} />
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
