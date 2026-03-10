/**
 * Pure D3/math utilities for FacetScatterPlot.
 * No React dependencies — safe to use in useMemo calls.
 */
import * as d3 from "d3";

/** SVG path string for a 5-pointed star centred at (cx, cy). */
export function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return `M${pts.map(([x, y]) => `${x},${y}`).join("L")}Z`;
}

export interface ScatterScales {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
}

/**
 * Build D3 linear scales with 22% padding around the data spread.
 * Falls back to [-1, 1] when there is no data.
 */
export function buildScales(
  allX: number[],
  allY: number[],
  plotW: number,
  plotH: number,
): ScatterScales {
  if (!allX.length) {
    return {
      xScale: d3.scaleLinear().domain([-1, 1]).range([0, plotW]),
      yScale: d3.scaleLinear().domain([-1, 1]).range([plotH, 0]),
    };
  }

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
}

/** Assign each item in the array a colour from the given palette (wraps around). */
export function buildDrillColourMap(ids: string[], palette: string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id, i) => [id, palette[i % palette.length]]));
}
