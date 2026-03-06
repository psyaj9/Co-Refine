/**
 * FacetExplorerTab â€” orchestrates the facet visualisation.
 *
 * Overview (drillCodeId = null):
 *   - All-codes scatter plot: code centroids as â˜… stars, faded segment dots
 *   - Stars use the code's actual colour from the codebook
 *   - Click a star or legend item â†’ drill-down
 *
 * Drill-down (drillCodeId set):
 *   - Only segments for that code, labelled by facet sub-theme
 *   - Facet cards with inline label editing + AI explanation
 *
 * Transitions between views use scale+fade via animate-zoom-fade-in.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { BarChart2, RefreshCw } from "lucide-react";
import { useStore } from "@/stores/store";
import { fetchVisFacets } from "@/api/client";
import type { CodeOut, FacetData } from "@/types";
import FacetScatterPlot from "./FacetScatterPlot";
import FacetDrillDown from "./FacetDrillDown";

// â”€â”€ Colour mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Use the code's own colour from the codebook; PALETTE is the fallback.
const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7", "#e11d48", "#22c55e", "#eab308",
  "#3b82f6", "#d946ef", "#64748b",
];

function buildColourMap(
  facets: FacetData[],
  codes: CodeOut[],
): Record<string, string> {
  const codeIds = Array.from(new Set(facets.map((f) => f.code_id)));
  return Object.fromEntries(
    codeIds.map((id, i) => {
      const stored = codes.find((c) => c.id === id);
      return [id, stored?.colour ?? PALETTE[i % PALETTE.length]];
    }),
  );
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FacetExplorerTabProps {
  projectId: string;
}

type LoadState = "idle" | "loading" | "error" | "success";

export default function FacetExplorerTab({ projectId }: FacetExplorerTabProps) {
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const codes = useStore((s) => s.codes);

  const [facets, setFacets] = useState<FacetData[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [drillCodeId, setDrillCodeId] = useState<string | null>(null);

  // Responsive container width
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    // Set initial size
    setContainerWidth(Math.floor(el.getBoundingClientRect().width) || 640);
    return () => ro.disconnect();
  }, []);

  const colourMap = useMemo(() => buildColourMap(facets, codes), [facets, codes]);

  const load = useCallback(() => {
    setLoadState("loading");
    fetchVisFacets(projectId)
      .then(({ facets: data }) => {
        setFacets(data);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, visRefreshCounter]);

  // Reset drill-down when project changes
  useEffect(() => {
    setDrillCodeId(null);
  }, [projectId]);

  const handleLabelChange = useCallback((facetId: string, newLabel: string) => {
    setFacets((prev) =>
      prev.map((f) => (f.facet_id === facetId ? { ...f, facet_label: newLabel } : f))
    );
  }, []);

  const drillCode = drillCodeId
    ? facets.find((f) => f.code_id === drillCodeId)
    : null;

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loadState === "loading" && facets.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 text-surface-400 animate-spin" aria-hidden="true" />
        <span className="ml-2 text-sm text-surface-400">Loading facet dataâ€¦</span>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <BarChart2 className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">Failed to load facet data.</p>
        <button
          onClick={load}
          className="text-xs text-brand-500 underline hover:text-brand-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loadState === "success" && facets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <BarChart2 className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">
          No facets yet. Run an analysis to discover sub-themes.
        </p>
      </div>
    );
  }

  // â”€â”€ Drill-down view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (drillCodeId && drillCode) {
    return (
      <div key={drillCodeId} className="animate-zoom-fade-in">
        <FacetDrillDown
          codeName={drillCode.code_name}
          codeId={drillCodeId}
          facets={facets}
          colourMap={colourMap}
          projectId={projectId}
          onBack={() => setDrillCodeId(null)}
          onLabelChange={handleLabelChange}
        />
      </div>
    );
  }

  // â”€â”€ Overview view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const uniqueCodes = Array.from(
    new Map(facets.map((f) => [f.code_id, f.code_name])).entries()
  );

  const totalSegments = facets.reduce((n, f) => n + f.segment_count, 0);

  const plotHeight = Math.min(Math.round(containerWidth * 0.65), 520);

  return (
    <div key="overview" className="animate-zoom-fade-in flex flex-col gap-4">
      <div>
        <p className="text-xs text-surface-400">
          â˜… = code centroid Â· dots = coded segments Â· click a star or label below to drill in
        </p>
        <p className="text-[10px] text-surface-400 mt-0.5">
          {uniqueCodes.length} codes Â· {facets.length} facets Â· {totalSegments} segments
        </p>
      </div>

      {/* Responsive scatter plot container */}
      <div ref={containerRef} className="w-full">
        <FacetScatterPlot
          facets={facets}
          colourMap={colourMap}
          drillCodeId={null}
          onStarClick={(codeId) => setDrillCodeId(codeId)}
          width={containerWidth}
          height={plotHeight}
        />
      </div>

      {/* Legend â€” colours from codebook */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {uniqueCodes.map(([codeId, codeName]) => (
          <button
            key={codeId}
            onClick={() => setDrillCodeId(codeId)}
            className="flex items-center gap-1.5 text-[10px] text-surface-600 dark:text-surface-300 hover:text-brand-600 transition-colors"
            aria-label={`Drill into ${codeName}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: colourMap[codeId] }}
              aria-hidden="true"
            />
            {codeName}
          </button>
        ))}
      </div>
    </div>
  );
}

