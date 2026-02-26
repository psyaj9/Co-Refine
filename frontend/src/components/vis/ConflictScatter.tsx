/**
 * Conflict Scatter Plot
 *
 * Each dot is a document. X = number of segments, Y = average conflict score.
 * Dots are rendered as mini pie charts: blue slice = AI agreed, red = disagreed.
 *
 * Inspired by collacode's ScatterPlot.vue with pie-glyph markers.
 */

import { useCallback, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { useD3, showTooltip, hideTooltip, innerSize } from "@/lib/d3-utils";
import { useStore } from "@/stores/store";

interface DocPoint {
  docId: string;
  title: string;
  segmentCount: number;
  avgConflict: number;
  agreeRatio: number; // 0–1: proportion AI agreed
}

export default function ConflictScatter() {
  const consistencyScores = useStore((s) => s.consistencyScores);
  const loadConsistencyScores = useStore((s) => s.loadConsistencyScores);
  const codes = useStore((s) => s.codes);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveDocument = useStore((s) => s.setActiveDocument);
  const setViewMode = useStore((s) => s.setViewMode);

  useEffect(() => {
    if (activeProjectId) loadConsistencyScores();
  }, [activeProjectId, loadConsistencyScores]);

  // Build code-id → label map for agreement detection
  const codeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    codes.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [codes]);

  // Build document lookup (used for title fallback)
  // const docMap = useMemo(() => {
  //   const m = new Map<string, string>();
  //   documents.forEach((d) => m.set(d.id, d.title));
  //   return m;
  // }, [documents]);

  // Build segment → document mapping from all fetched segments
  // But segments in store are per-document — we need to use consistency_scores' segment_id
  // and correlate with codes. We aggregate by code_id (since we don't have doc on score).
  // Actually we need document_stats for this. Let me use those instead.
  const documentStats = useStore((s) => s.documentStats);
  const loadDocumentStats = useStore((s) => s.loadDocumentStats);

  useEffect(() => {
    if (activeProjectId) loadDocumentStats();
  }, [activeProjectId, loadDocumentStats]);

  // Aggregate scores by segment → we need segment_id → doc_id mapping
  // For now, use document stats for segment counts and compute a rough conflict from scores grouped by code
  const points: DocPoint[] = useMemo(() => {
    if (documentStats.length === 0 || consistencyScores.length === 0) return [];

    // Group scores by code_id to compute per-code agreement
    const codeConflictMap = new Map<string, { total: number; agreed: number; conflictSum: number }>();
    for (const s of consistencyScores) {
      const codeLabel = codeLabelMap.get(s.code_id);
      if (!codeLabel || s.llm_predicted_code == null) continue;
      const entry = codeConflictMap.get(s.code_id) || { total: 0, agreed: 0, conflictSum: 0 };
      entry.total++;
      if (s.llm_predicted_code === codeLabel) entry.agreed++;
      entry.conflictSum += s.conflict_score ?? 0;
      codeConflictMap.set(s.code_id, entry);
    }

    // For each document, compute aggregate conflict from the codes it uses
    return documentStats.map((ds) => {
      let totalConflict = 0;
      let totalAgreed = 0;
      let totalScored = 0;

      // For each code applied to this document, pull in the code-level stats
      for (const codeLabel of ds.codes) {
        const code = codes.find((c) => c.label === codeLabel);
        if (!code) continue;
        const stats = codeConflictMap.get(code.id);
        if (!stats || stats.total === 0) continue;
        totalConflict += stats.conflictSum / stats.total;
        totalAgreed += stats.agreed;
        totalScored += stats.total;
      }

      const avgConflict = ds.codes.length > 0 ? totalConflict / ds.codes.length : 0;
      const agreeRatio = totalScored > 0 ? totalAgreed / totalScored : 0.5;

      return {
        docId: ds.document_id,
        title: ds.document_title,
        segmentCount: ds.segment_count,
        avgConflict: Math.min(1, Math.max(0, avgConflict)),
        agreeRatio,
      };
    }).filter((p) => p.segmentCount > 0);
  }, [documentStats, consistencyScores, codeLabelMap, codes]);

  const margin = { top: 40, right: 30, bottom: 48, left: 56 };
  const PIE_R = 14;

  const render = useCallback(
    (
      svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      w: number,
      h: number,
    ) => {
      svg.selectAll("*").remove();
      const { iw, ih } = innerSize(w, h, margin);
      if (iw <= 0 || ih <= 0 || points.length === 0) return;

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const xMax = d3.max(points, (p) => p.segmentCount) || 10;
      const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, iw]);
      const y = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

      // Axes
      g.append("g")
        .attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(6))
        .selectAll("text")
        .attr("fill", "currentColor")
        .attr("font-size", 10);

      g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")))
        .selectAll("text")
        .attr("fill", "currentColor")
        .attr("font-size", 10);

      // Axis labels
      svg
        .append("text")
        .attr("x", margin.left + iw / 2)
        .attr("y", h - 6)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "currentColor")
        .text("Segments per document");

      svg
        .append("text")
        .attr("transform", `translate(14,${margin.top + ih / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "currentColor")
        .text("Avg conflict score");

      // Title
      svg
        .append("text")
        .attr("x", margin.left)
        .attr("y", 20)
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("fill", "currentColor")
        .text("Document Conflict (AI Ghost Coder)");

      // Pie glyphs
      const pie = d3.pie<number>().sort(null);
      const arc = d3.arc<d3.PieArcDatum<number>>().innerRadius(0).outerRadius(PIE_R);

      points.forEach((p) => {
        const cx = x(p.segmentCount);
        const cy = y(p.avgConflict);
        const pieData = pie([p.agreeRatio, 1 - p.agreeRatio]);

        const pg = g
          .append("g")
          .attr("transform", `translate(${cx},${cy})`)
          .attr("class", "cursor-pointer")
          .attr("data-doc-id", p.docId);

        pg.selectAll("path")
          .data(pieData)
          .enter()
          .append("path")
          .attr("d", arc as any)
          .attr("fill", (_d, i) => (i === 0 ? "#3b82f6" : "#ef4444"))
          .attr("stroke", "var(--color-surface-200)")
          .attr("stroke-width", 0.5);
      });
    },
    [points, margin],
  );

  const ref = useD3<SVGSVGElement>(render, [points]);

  const handleHover = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = (e.target as Element).closest("[data-doc-id]");
      if (target) {
        const docId = target.getAttribute("data-doc-id")!;
        const p = points.find((pt) => pt.docId === docId);
        if (p) {
          showTooltip(
            `<strong>${p.title}</strong>\n` +
              `${p.segmentCount} segments\n` +
              `Conflict: ${(p.avgConflict * 100).toFixed(1)}%\n` +
              `AI agreed: ${(p.agreeRatio * 100).toFixed(0)}%`,
            e.nativeEvent,
          );
        }
      } else {
        hideTooltip();
      }
    },
    [points],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = (e.target as Element).closest("[data-doc-id]");
      if (target) {
        const docId = target.getAttribute("data-doc-id")!;
        setActiveDocument(docId);
        setViewMode("document");
      }
    },
    [setActiveDocument, setViewMode],
  );

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No conflict data yet — code some segments and run AI audits first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2">
      <svg
        ref={ref}
        className="flex-1 w-full"
        onMouseMove={handleHover}
        onMouseLeave={hideTooltip}
        onClick={handleClick}
      />
      <div className="flex gap-4 justify-center text-xs text-surface-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> AI agreed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> AI disagreed
        </span>
      </div>
    </div>
  );
}
