/**
 * Code Assignment Histogram
 *
 * D3 SVG histogram showing the distribution of codes (or segments) per document.
 * Toggle between "codes per document" and "segments per document".
 *
 * Inspired by collacode's simple histogram / StackedBarChart.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { useD3, showTooltip, hideTooltip, innerSize } from "@/lib/d3-utils";
import { useStore } from "@/stores/store";

type Mode = "codes" | "segments";

export default function AssignmentHistogram() {
  const documentStats = useStore((s) => s.documentStats);
  const loadDocumentStats = useStore((s) => s.loadDocumentStats);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const [mode, setMode] = useState<Mode>("codes");

  useEffect(() => {
    if (activeProjectId) loadDocumentStats();
  }, [activeProjectId, loadDocumentStats]);

  const values = useMemo(
    () => documentStats.map((d) => (mode === "codes" ? d.code_count : d.segment_count)),
    [documentStats, mode],
  );

  const margin = { top: 40, right: 24, bottom: 52, left: 48 };

  const render = useCallback(
    (
      svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      w: number,
      h: number,
    ) => {
      svg.selectAll("*").remove();
      const { iw, ih } = innerSize(w, h, margin);
      if (iw <= 0 || ih <= 0 || values.length === 0) return;

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const xMax = (d3.max(values) || 1) + 1;
      const x = d3
        .scaleLinear()
        .domain([0, xMax])
        .range([0, iw]);

      const bins = d3
        .bin()
        .domain(x.domain() as [number, number])
        .thresholds(x.ticks(Math.min(20, xMax)))(values);

      const yMax = d3.max(bins, (b) => b.length) || 1;
      const y = d3.scaleLinear().domain([0, yMax]).nice().range([ih, 0]);

      // Bars
      g.selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", (d) => x(d.x0!) + 1)
        .attr("y", (d) => y(d.length))
        .attr("width", (d) => Math.max(0, x(d.x1!) - x(d.x0!) - 2))
        .attr("height", (d) => ih - y(d.length))
        .attr("fill", "#7c3aed")
        .attr("rx", 2)
        .attr("class", "opacity-80 hover:opacity-100 transition-opacity");

      // X axis
      g.append("g")
        .attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(Math.min(10, xMax)))
        .selectAll("text")
        .attr("fill", "currentColor")
        .attr("font-size", 10);

      // Y axis
      g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .attr("fill", "currentColor")
        .attr("font-size", 10);

      // Labels
      svg
        .append("text")
        .attr("x", margin.left + iw / 2)
        .attr("y", h - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "currentColor")
        .text(mode === "codes" ? "Unique codes per document" : "Segments per document");

      svg
        .append("text")
        .attr("transform", `translate(14,${margin.top + ih / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "currentColor")
        .text("Documents");

      // Title
      svg
        .append("text")
        .attr("x", margin.left)
        .attr("y", 22)
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("fill", "currentColor")
        .text("Distribution of Coding Activity");
    },
    [values, mode, margin],
  );

  const ref = useD3<SVGSVGElement>(render, [values, mode]);

  const handleHover = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGRectElement;
      if (target.tagName === "rect") {
        const d = d3.select(target).datum() as d3.Bin<number, number>;
        if (d) {
          showTooltip(
            `${mode === "codes" ? "Codes" : "Segments"}: ${d.x0}–${d.x1! - 1}\nDocuments: ${d.length}`,
            e.nativeEvent,
          );
        }
      } else {
        hideTooltip();
      }
    },
    [mode],
  );

  if (documentStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No documents yet — upload documents and code them to see the histogram.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 gap-1">
      <div className="flex gap-1 px-2">
        {(["codes", "segments"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              mode === m
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 font-medium"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            {m === "codes" ? "Codes per Doc" : "Segments per Doc"}
          </button>
        ))}
      </div>
      <svg
        ref={ref}
        className="flex-1 w-full"
        onMouseMove={handleHover}
        onMouseLeave={hideTooltip}
      />
    </div>
  );
}
