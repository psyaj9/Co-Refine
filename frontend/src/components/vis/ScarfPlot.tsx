/**
 * Code Frequency Scarf Plot
 *
 * Canvas-based horizontal bars showing relative code frequencies (0–100%).
 * Colour from sequential Plasma colourmap. Click a code to highlight it and
 * show a comparison "subset" row below the global row.
 *
 * Inspired by collacode's BarCode.vue scarf plot.
 */

import { useCallback, useState } from "react";
import * as d3 from "d3";
import { useD3, plasmaScale, showTooltip, hideTooltip, DEFAULT_MARGIN, innerSize } from "@/lib/d3-utils";
import ColorLegend from "@/components/vis/ColorLegend";
import { useStore } from "@/stores/store";

export default function ScarfPlot() {
  const codes = useStore((s) => s.codes);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  // Sort codes by segment_count descending
  const sorted = [...codes].sort((a, b) => b.segment_count - a.segment_count);
  const total = sorted.reduce((s, c) => s + c.segment_count, 0);

  const margin = { ...DEFAULT_MARGIN, left: 120, top: 32, bottom: 48 };

  const render = useCallback(
    (
      canvas: d3.Selection<HTMLCanvasElement, unknown, null, undefined>,
      w: number,
      h: number,
    ) => {
      const node = canvas.node()!;
      const dpr = window.devicePixelRatio || 1;
      node.width = w * dpr;
      node.height = h * dpr;
      const ctx = node.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { iw, ih } = innerSize(w, h, margin);
      if (iw <= 0 || ih <= 0 || sorted.length === 0) return;

      // --- Global scarf (upper half) ---
      const globalH = selectedCodeId ? ih * 0.55 : ih;
      const barH = Math.max(2, Math.min(24, globalH / sorted.length - 1));
      const scale = plasmaScale([0, total || 1]);

      sorted.forEach((code, i) => {
        const y = margin.top + i * (barH + 1);
        if (y + barH > margin.top + globalH) return;
        const freq = total > 0 ? code.segment_count / total : 0;
        const barW = freq * iw;

        ctx.fillStyle = scale(code.segment_count);
        ctx.fillRect(margin.left, y, barW, barH);

        // Highlight selected
        if (code.id === selectedCodeId) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.strokeRect(margin.left - 1, y - 1, barW + 2, barH + 2);
          // Indicator dot
          ctx.beginPath();
          ctx.arc(margin.left + barW / 2, y + barH + 6, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        }

        // Label
        ctx.fillStyle = getComputedStyle(node).color || "#888";
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const label =
          code.label.length > 16 ? code.label.slice(0, 15) + "…" : code.label;
        ctx.fillText(label, margin.left - 8, y + barH / 2);

        // Percentage text at end
        ctx.textAlign = "left";
        ctx.fillText(
          `${(freq * 100).toFixed(1)}%`,
          margin.left + barW + 6,
          y + barH / 2,
        );
      });

      // --- Subset scarf (lower half) — only if a code is selected ---
      if (selectedCodeId) {
        const subsetY = margin.top + globalH + 20;
        const selCode = sorted.find((c) => c.id === selectedCodeId);
        if (selCode) {
          // Draw a single full-width bar for the selected code
          const freq = total > 0 ? selCode.segment_count / total : 0;
          ctx.fillStyle = selCode.colour || scale(selCode.segment_count);
          ctx.fillRect(margin.left, subsetY, freq * iw, 20);

          ctx.fillStyle = getComputedStyle(node).color || "#888";
          ctx.font = "11px Inter, system-ui, sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(selCode.label, margin.left - 8, subsetY + 10);
          ctx.textAlign = "left";
          ctx.fillText(
            `${selCode.segment_count} segments (${(freq * 100).toFixed(1)}%)`,
            margin.left + freq * iw + 6,
            subsetY + 10,
          );
        }
      }

      // Title
      ctx.fillStyle = getComputedStyle(node).color || "#888";
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Code Frequency (relative)", margin.left, margin.top - 10);
    },
    [sorted, total, selectedCodeId, margin],
  );

  const ref = useD3<HTMLCanvasElement>(render, [sorted, selectedCodeId]);

  // Click and hover handlers
  const handleInteraction = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const { ih } = innerSize(rect.width, rect.height, margin);
      const globalH = selectedCodeId ? ih * 0.55 : ih;
      const barH = Math.max(2, Math.min(24, globalH / sorted.length - 1));

      const idx = Math.floor((y - margin.top) / (barH + 1));
      const code = sorted[idx];

      if (e.type === "click" && code) {
        setSelectedCodeId((prev) => (prev === code.id ? null : code.id));
      }

      if (e.type === "mousemove" && code && idx >= 0 && idx < sorted.length) {
        const freq = total > 0 ? code.segment_count / total : 0;
        showTooltip(
          `<strong>${code.label}</strong>\n${code.segment_count} segments · ${(freq * 100).toFixed(1)}%`,
          e.nativeEvent,
        );
      }
    },
    [sorted, total, selectedCodeId, margin],
  );

  if (codes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No codes yet — create codes and apply them to segments to see the scarf plot.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <canvas
        ref={ref}
        className="flex-1 w-full cursor-pointer"
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onMouseLeave={hideTooltip}
      />
      <div className="px-4">
        <ColorLegend
          interpolator={d3.interpolatePlasma}
          minLabel="0"
          maxLabel={String(total)}
        />
      </div>
    </div>
  );
}
