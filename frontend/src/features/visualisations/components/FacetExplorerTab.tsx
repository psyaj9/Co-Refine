/**
 * FacetExplorerTab — orchestrates the facet visualisation.
 *
 * Overview (drillCodeId = null):
 *   - All-codes scatter plot: code centroids as ★ stars, facet segments as faded dots
 *   - Click a star → drill-down
 *
 * Drill-down (drillCodeId set):
 *   - Only segments for that code, labelled by facet sub-theme
 *   - Facet cards with inline label editing + AI explanation
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { BarChart2, RefreshCw } from "lucide-react";
import { useStore } from "@/stores/store";
import { fetchVisFacets } from "@/api/client";
import type { FacetData } from "@/types";
import FacetScatterPlot from "./FacetScatterPlot";
import FacetDrillDown from "./FacetDrillDown";

// ── Colour palette for codes ──────────────────────────────────────────────────
const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7", "#e11d48", "#22c55e", "#eab308",
  "#3b82f6", "#d946ef", "#64748b",
];

function buildColourMap(facets: FacetData[]): Record<string, string> {
  const codeIds = Array.from(new Set(facets.map((f) => f.code_id)));
  return Object.fromEntries(codeIds.map((id, i) => [id, PALETTE[i % PALETTE.length]]));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface FacetExplorerTabProps {
  projectId: string;
}

type LoadState = "idle" | "loading" | "error" | "success";

export default function FacetExplorerTab({ projectId }: FacetExplorerTabProps) {
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);

  const [facets, setFacets] = useState<FacetData[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [drillCodeId, setDrillCodeId] = useState<string | null>(null);

  const colourMap = useMemo(() => buildColourMap(facets), [facets]);

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

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loadState === "loading" && facets.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 text-surface-400 animate-spin" aria-hidden="true" />
        <span className="ml-2 text-sm text-surface-400">Loading facet data…</span>
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

  // ── Drill-down view ────────────────────────────────────────────────────────

  if (drillCodeId && drillCode) {
    return (
      <FacetDrillDown
        codeName={drillCode.code_name}
        codeId={drillCodeId}
        facets={facets}
        colourMap={colourMap}
        projectId={projectId}
        onBack={() => setDrillCodeId(null)}
        onLabelChange={handleLabelChange}
      />
    );
  }

  // ── Overview view ──────────────────────────────────────────────────────────

  const uniqueCodes = Array.from(
    new Map(facets.map((f) => [f.code_id, f.code_name])).entries()
  );

  const totalSegments = facets.reduce((n, f) => n + f.segment_count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-surface-400">
          ★ = code centroid · dots = coded segments · click a star to drill in
        </p>
        <p className="text-[10px] text-surface-400 mt-0.5">
          {uniqueCodes.length} codes · {facets.length} facets · {totalSegments} segments
        </p>
      </div>

      {/* Scatter plot */}
      <div className="w-full overflow-x-auto">
        <FacetScatterPlot
          facets={facets}
          colourMap={colourMap}
          drillCodeId={null}
          onStarClick={(codeId) => setDrillCodeId(codeId)}
          width={640}
          height={420}
        />
      </div>

      {/* Legend */}
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
