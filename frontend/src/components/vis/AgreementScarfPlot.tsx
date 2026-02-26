/**
 * Agreement Scarf Plot
 *
 * Horizontal bars per code coloured by a diverging RdYlBu scale.
 * Blue = full agreement (user & AI ghost coded the same), Red = full disagreement.
 *
 * Data comes from the /api/evaluation/agreement-summary endpoint.
 */

import { useCallback, useEffect } from "react";
import * as d3 from "d3";
import { useD3, showTooltip, hideTooltip, innerSize } from "@/lib/d3-utils";
import ColorLegend from "@/components/vis/ColorLegend";
import { useStore } from "@/stores/store";

export default function AgreementScarfPlot() {
  const agreementSummary = useStore((s) => s.agreementSummary);
  const loadAgreementSummary = useStore((s) => s.loadAgreementSummary);
  const activeProjectId = useStore((s) => s.activeProjectId);

  useEffect(() => {
    if (activeProjectId) loadAgreementSummary();
  }, [activeProjectId, loadAgreementSummary]);

  const sorted = [...agreementSummary].sort((a, b) => {
    const rateA = a.total > 0 ? a.agree_count / a.total : 0.5;
    const rateB = b.total > 0 ? b.agree_count / b.total : 0.5;
    return rateA - rateB; // worst agreement first
  });

  const margin = { top: 32, right: 60, bottom: 48, left: 120 };

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

      const barH = Math.max(2, Math.min(28, ih / sorted.length - 1));
      const color = d3.scaleSequential(d3.interpolateRdYlBu).domain([0, 1]);

      sorted.forEach((entry, i) => {
        const y = margin.top + i * (barH + 1);
        if (y + barH > margin.top + ih) return;

        const rate = entry.total > 0 ? entry.agree_count / entry.total : 0.5;
        // Bar width = full width (representing 100%), colour encodes agreement
        const barW = iw;

        ctx.fillStyle = color(rate);
        ctx.fillRect(margin.left, y, barW, barH);

        // Code label
        ctx.fillStyle = getComputedStyle(node).color || "#888";
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const label =
          entry.code_label.length > 16
            ? entry.code_label.slice(0, 15) + "…"
            : entry.code_label;
        ctx.fillText(label, margin.left - 8, y + barH / 2);

        // Agreement percentage
        ctx.textAlign = "left";
        ctx.fillText(
          `${(rate * 100).toFixed(0)}%`,
          margin.left + barW + 6,
          y + barH / 2,
        );
      });

      // Title
      ctx.fillStyle = getComputedStyle(node).color || "#888";
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        "User–AI Agreement per Code",
        margin.left,
        margin.top - 10,
      );
    },
    [sorted, margin],
  );

  const ref = useD3<HTMLCanvasElement>(render, [sorted]);

  const handleHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const { ih } = innerSize(rect.width, rect.height, margin);
      const barH = Math.max(2, Math.min(28, ih / sorted.length - 1));
      const idx = Math.floor((y - margin.top) / (barH + 1));
      const entry = sorted[idx];
      if (entry && idx >= 0 && idx < sorted.length) {
        const rate = entry.total > 0 ? entry.agree_count / entry.total : 0;
        showTooltip(
          `<strong>${entry.code_label}</strong>\n` +
            `Agreement: ${entry.agree_count}/${entry.total} (${(rate * 100).toFixed(1)}%)\n` +
            `Avg conflict severity: ${entry.avg_conflict_severity?.toFixed(2) ?? "—"}\n` +
            `Avg AI confidence: ${entry.avg_confidence?.toFixed(2) ?? "—"}`,
          e.nativeEvent,
        );
      } else {
        hideTooltip();
      }
    },
    [sorted, margin],
  );

  if (agreementSummary.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No AI agreement data yet — run a batch audit to generate ghost-coder predictions.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <canvas
        ref={ref}
        className="flex-1 w-full"
        onMouseMove={handleHover}
        onMouseLeave={hideTooltip}
      />
      <div className="px-4">
        <ColorLegend
          interpolator={d3.interpolateRdYlBu}
          minLabel="Disagree"
          maxLabel="Agree"
          midLabel="Mixed"
        />
      </div>
    </div>
  );
}
