/**
 * Code Co-occurrence Heatmap
 *
 * Canvas-based matrix showing how often two codes appear on the same document.
 * Color encodes co-occurrence count via Plasma scale.
 * SVG overlay for axis labels.
 *
 * Inspired by collacode's HeatMatrix.vue
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { showTooltip, hideTooltip, plasmaScale } from "@/lib/d3-utils";
import ColorLegend from "@/components/vis/ColorLegend";
import { useStore } from "@/stores/store";

export default function CooccurrenceMatrix() {
  const cooccurrence = useStore((s) => s.cooccurrence);
  const loadCooccurrence = useStore((s) => s.loadCooccurrence);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeProjectId) loadCooccurrence();
  }, [activeProjectId, loadCooccurrence]);

  // Build symmetric matrix from entries
  const { labels, matrix, maxVal } = useMemo(() => {
    if (cooccurrence.length === 0) return { labels: [] as string[], matrix: [] as number[][], maxVal: 0 };

    const labelSet = new Set<string>();
    cooccurrence.forEach((e) => {
      labelSet.add(e.code_a);
      labelSet.add(e.code_b);
    });
    const labels = Array.from(labelSet).sort();
    const idx = new Map(labels.map((l, i) => [l, i]));
    const n = labels.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    let maxVal = 0;

    cooccurrence.forEach((e) => {
      const i = idx.get(e.code_a)!;
      const j = idx.get(e.code_b)!;
      matrix[i][j] = e.count;
      matrix[j][i] = e.count; // symmetric
      maxVal = Math.max(maxVal, e.count);
    });

    return { labels, matrix, maxVal };
  }, [cooccurrence]);

  // Render
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || labels.length === 0) return;

    const { width: cw, height: ch } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const marginLeft = Math.min(140, Math.max(80, d3.max(labels, (l) => l.length * 6.5) || 80));
    const marginTop = marginLeft; // rotated labels
    const marginRight = 16;
    const marginBottom = 16;

    const n = labels.length;
    const availW = cw - marginLeft - marginRight;
    const availH = ch - marginTop - marginBottom;
    const cellSize = Math.max(4, Math.min(36, Math.min(availW, availH) / n));
    const gridW = cellSize * n;
    const gridH = cellSize * n;

    canvas.width = (marginLeft + gridW + marginRight) * dpr;
    canvas.height = (marginTop + gridH + marginBottom) * dpr;
    canvas.style.width = `${marginLeft + gridW + marginRight}px`;
    canvas.style.height = `${marginTop + gridH + marginBottom}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const color = plasmaScale([0, maxVal || 1]);

    // Draw cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = matrix[i][j];
        ctx.fillStyle = v > 0 ? color(v) : "rgba(128,128,128,0.06)";
        ctx.fillRect(marginLeft + j * cellSize, marginTop + i * cellSize, cellSize - 1, cellSize - 1);
      }
    }

    // Row labels
    ctx.fillStyle = getComputedStyle(canvas).color || "#888";
    ctx.font = `${Math.min(11, cellSize - 2)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const label = labels[i].length > 18 ? labels[i].slice(0, 17) + "…" : labels[i];
      ctx.fillText(label, marginLeft - 4, marginTop + i * cellSize + cellSize / 2);
    }

    // Column labels (rotated)
    ctx.save();
    ctx.textAlign = "left";
    for (let j = 0; j < n; j++) {
      const label = labels[j].length > 18 ? labels[j].slice(0, 17) + "…" : labels[j];
      const cx = marginLeft + j * cellSize + cellSize / 2;
      ctx.save();
      ctx.translate(cx, marginTop - 4);
      ctx.rotate(-Math.PI / 3);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }, [labels, matrix, maxVal]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // Hover
  const handleHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const n = labels.length;
      if (n === 0) return;

      const marginLeft = Math.min(140, Math.max(80, d3.max(labels, (l) => l.length * 6.5) || 80));
      const marginTop = marginLeft;
      const availW = rect.width - marginLeft - 16;
      const availH = rect.height - marginTop - 16;
      const cellSize = Math.max(4, Math.min(36, Math.min(availW, availH) / n));

      const mx = e.clientX - rect.left - marginLeft;
      const my = e.clientY - rect.top - marginTop;
      const col = Math.floor(mx / cellSize);
      const row = Math.floor(my / cellSize);

      if (row >= 0 && row < n && col >= 0 && col < n) {
        showTooltip(
          `<strong>${labels[row]} × ${labels[col]}</strong>\nCo-occurrence: ${matrix[row][col]} documents`,
          e.nativeEvent,
        );
      } else {
        hideTooltip();
      }
    },
    [labels, matrix],
  );

  if (cooccurrence.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No co-occurrence data yet — apply multiple codes to documents first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <div className="text-xs font-semibold text-surface-500 px-2">
        Code Co-occurrence Matrix (codes applied to the same document)
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto">
        <canvas
          ref={canvasRef}
          onMouseMove={handleHover}
          onMouseLeave={hideTooltip}
        />
      </div>
      <div className="px-4">
        <ColorLegend
          interpolator={d3.interpolatePlasma}
          minLabel="0"
          maxLabel={String(maxVal)}
        />
      </div>
    </div>
  );
}
