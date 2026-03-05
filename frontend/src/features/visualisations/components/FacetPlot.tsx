/**
 * FacetPlot — Plotly-powered scatter wrapper supporting both 2D and 3D modes.
 *
 * Lazy-loaded by FacetExplorerTab via React.lazy to keep initial bundle lean.
 * Uses plotly.js-dist-min (smallest full-featured Plotly bundle) via the
 * react-plotly.js factory pattern.
 */
import PlotlyLib from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import type { Layout, Config, PlotMouseEvent, Datum, PlotData } from "plotly.js";

const Plot = createPlotlyComponent(PlotlyLib);

export interface FacetPlotTrace {
  name: string;
  x: number[];
  y: number[];
  z?: (number | null)[];
  /** Marker colour — hex string or "rgba(...)" */
  colour: string;
  /** Marker symbol: "circle" for segments, "diamond" for centroids */
  symbol?: "circle" | "diamond";
  markerSize?: number;
  textLabels?: string[];
  /** Arbitrary data attached per point for click handling */
  customdata?: unknown[][];
  /** Whether to show this series in the legend */
  showlegend?: boolean;
}

interface FacetPlotProps {
  traces: FacetPlotTrace[];
  mode: "2d" | "3d";
  onPointClick?: (customdata: unknown[] | undefined) => void;
  onLegendClick?: (legendItemName: string) => void;
  height?: number;
}

export default function FacetPlot({
  traces,
  mode,
  onPointClick,
  onLegendClick,
  height = 420,
}: FacetPlotProps) {
  const is3d = mode === "3d";

  const plotlyTraces: Partial<PlotData>[] = traces.map((t) => {
    if (is3d) {
      return {
        type: "scatter3d" as const,
        name: t.name,
        x: t.x,
        y: t.y,
        z: (t.z ?? t.x.map(() => 0)) as number[],
        mode: t.textLabels ? "text+markers" : "markers",
        text: t.textLabels,
        textposition: "top center",
        marker: {
          color: t.colour,
          size: t.markerSize ?? 5,
          symbol: t.symbol === "diamond" ? "diamond" : "circle",
          opacity: 0.85,
          line: { width: 0 },
        },
        customdata: t.customdata as Datum[][] | undefined,
        hovertemplate:
          t.symbol === "diamond"
            ? "<b>%{text}</b><extra></extra>"
            : "<b>%{customdata[1]}</b><br>%{customdata[2]}<extra></extra>",
        showlegend: t.showlegend ?? true,
      } satisfies Partial<PlotData>;
    } else {
      return {
        type: "scatter" as const,
        name: t.name,
        x: t.x,
        y: t.y,
        mode: t.textLabels ? "text+markers" : "markers",
        text: t.textLabels,
        textposition: "top center",
        marker: {
          color: t.colour,
          size: t.markerSize ?? 7,
          symbol: t.symbol === "diamond" ? "diamond" : "circle",
          opacity: 0.85,
          line: { width: 0 },
        },
        customdata: t.customdata as Datum[][] | undefined,
        hovertemplate:
          t.symbol === "diamond"
            ? "<b>%{text}</b><extra></extra>"
            : "<b>%{customdata[1]}</b><br>%{customdata[2]}<extra></extra>",
        showlegend: t.showlegend ?? true,
      } satisfies Partial<PlotData>;
    }
  });

  const layout: Partial<Layout> = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: "inherit", size: 11, color: "#94a3b8" },
    margin: { t: 10, b: 40, l: 40, r: 10 },
    showlegend: true,
    legend: {
      orientation: "h",
      y: -0.15,
      font: { size: 10 },
    },
    hovermode: "closest",
    ...(is3d
      ? {
          scene: {
            xaxis: { showticklabels: false, title: { text: "" }, gridcolor: "#334155" },
            yaxis: { showticklabels: false, title: { text: "" }, gridcolor: "#334155" },
            zaxis: { showticklabels: false, title: { text: "" }, gridcolor: "#334155" },
            bgcolor: "transparent",
          },
        }
      : {
          xaxis: { showticklabels: false, zeroline: false, gridcolor: "#334155" },
          yaxis: { showticklabels: false, zeroline: false, gridcolor: "#334155" },
        }),
  };

  const config: Partial<Config> = {
    displaylogo: false,
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["toImage", "sendDataToCloud"],
  };

  const handleClick = (event: Readonly<PlotMouseEvent>) => {
    const pt = event.points[0];
    if (!pt) return;
    const cd = pt.customdata as unknown as unknown[] | undefined;
    onPointClick?.(cd);
  };

  return (
    <div style={{ width: "100%", height }}>
      <Plot
        data={plotlyTraces}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onClick={handleClick}
        onLegendClick={(e) => {
          // Extract clicked trace name from the Plotly event
          const fig = e as unknown as { data: Partial<PlotData>[]; curveNumber: number };
          const traceName = (fig.data[fig.curveNumber] as { name?: string })?.name ?? "";
          onLegendClick?.(traceName);
          // Return false to prevent Plotly's default hide-on-click
          return false;
        }}
      />
    </div>
  );
}
