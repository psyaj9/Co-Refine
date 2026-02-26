/**
 * Reusable colour legend (gradient bar with min/max labels).
 * Supports sequential and diverging D3 colour scales.
 */

import { useCallback } from "react";
import * as d3 from "d3";
import { useD3 } from "@/lib/d3-utils";

interface Props {
  /** A D3 interpolator function, e.g. d3.interpolatePlasma */
  interpolator: (t: number) => string;
  /** Labels at the two extremes */
  minLabel?: string;
  maxLabel?: string;
  /** Optional centre label (for diverging scales) */
  midLabel?: string;
  /** Height in pixels */
  height?: number;
}

export default function ColorLegend({
  interpolator,
  minLabel = "0",
  maxLabel = "1",
  midLabel,
  height = 18,
}: Props) {
  const render = useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, w: number) => {
      svg.selectAll("*").remove();

      const marginX = 4;
      const barW = w - marginX * 2;
      const barY = 2;
      const barH = height - 4;

      // Define gradient
      const gradId = "colleg-grad";
      const defs = svg.append("defs");
      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("x1", "0%")
        .attr("x2", "100%");

      const stops = 32;
      for (let i = 0; i <= stops; i++) {
        const t = i / stops;
        grad
          .append("stop")
          .attr("offset", `${t * 100}%`)
          .attr("stop-color", interpolator(t));
      }

      svg
        .append("rect")
        .attr("x", marginX)
        .attr("y", barY)
        .attr("width", barW)
        .attr("height", barH)
        .attr("rx", 3)
        .attr("fill", `url(#${gradId})`);

      // Labels
      const labelY = barY + barH + 12;
      svg
        .append("text")
        .attr("x", marginX)
        .attr("y", labelY)
        .attr("font-size", 10)
        .attr("fill", "currentColor")
        .text(minLabel);

      svg
        .append("text")
        .attr("x", marginX + barW)
        .attr("y", labelY)
        .attr("font-size", 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text(maxLabel);

      if (midLabel) {
        svg
          .append("text")
          .attr("x", marginX + barW / 2)
          .attr("y", labelY)
          .attr("font-size", 10)
          .attr("fill", "currentColor")
          .attr("text-anchor", "middle")
          .text(midLabel);
      }
    },
    [interpolator, minLabel, maxLabel, midLabel, height],
  );

  const ref = useD3<SVGSVGElement>(render, [interpolator, minLabel, maxLabel, midLabel]);

  return (
    <svg
      ref={ref}
      className="w-full"
      style={{ height: height + 16 }}
    />
  );
}
