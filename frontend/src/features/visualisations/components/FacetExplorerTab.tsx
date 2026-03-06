import { BarChart2, RefreshCw } from "lucide-react";
import { useFacetExplorer } from "@/features/visualisations/hooks/useFacetExplorer";
import FacetScatterPlot from "./FacetScatterPlot";
import FacetDrillDown from "./FacetDrillDown";

interface FacetExplorerTabProps {
  projectId: string;
}

export default function FacetExplorerTab({ projectId }: FacetExplorerTabProps) {
  const {
    facets,
    loadState,
    drillCodeId,
    setDrillCodeId,
    colourMap,
    containerRef,
    containerWidth,
    load,
    handleLabelChange,
  } = useFacetExplorer(projectId);

  if (loadState === "loading" && facets.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 text-surface-400 animate-spin" aria-hidden="true" />
        <span className="ml-2 text-sm text-surface-400">Loading facet data&hellip;</span>
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

  const drillCode = drillCodeId
    ? facets.find((f) => f.code_id === drillCodeId)
    : null;

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

  const uniqueCodes = Array.from(
    new Map(facets.map((f) => [f.code_id, f.code_name])).entries()
  );
  const totalSegments = facets.reduce((n, f) => n + f.segment_count, 0);
  const plotHeight = Math.min(Math.round(containerWidth * 0.65), 520);

  return (
    <div key="overview" className="animate-zoom-fade-in flex flex-col gap-4">
      <div>
        <p className="text-xs text-surface-400">
          &#9733; = code centroid &middot; dots = coded segments &middot; click a star or label below to drill in
        </p>
        <p className="text-[10px] text-surface-400 mt-0.5">
          {uniqueCodes.length} codes &middot; {facets.length} facets &middot; {totalSegments} segments
        </p>
      </div>

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