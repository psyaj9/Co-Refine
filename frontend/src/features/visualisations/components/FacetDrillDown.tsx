/**
 * FacetDrillDown — zoomed view for a single code.
 * Shows the scatter plot of just this code's segments (labelled by facet),
 * plus FacetCards for each facet with the AI explanation feature.
 * Hover a card to highlight its segments in the scatter plot.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import FacetScatterPlot from "./FacetScatterPlot";
import FacetCard from "./FacetCard";
import type { FacetData } from "@/types";

const FACET_PALETTE = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export interface FacetDrillDownProps {
  codeName: string;
  codeId: string;
  facets: FacetData[];
  colourMap: Record<string, string>;
  projectId: string;
  onBack: () => void;
  onLabelChange: (facetId: string, newLabel: string) => void;
}

export default function FacetDrillDown({
  codeName,
  codeId,
  facets,
  colourMap,
  projectId,
  onBack,
  onLabelChange,
}: FacetDrillDownProps) {
  const [highlightFacetId, setHighlightFacetId] = useState<string | null>(null);

  // Responsive width for left scatter column
  const scatterContainerRef = useRef<HTMLDivElement>(null);
  const [scatterWidth, setScatterWidth] = useState(520);

  useEffect(() => {
    const el = scatterContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setScatterWidth(Math.floor(w));
    });
    ro.observe(el);
    setScatterWidth(Math.floor(el.getBoundingClientRect().width) || 520);
    return () => ro.disconnect();
  }, []);

  const codeFacets = facets.filter((f) => f.code_id === codeId);
  const plotHeight = Math.min(Math.round(scatterWidth * 0.72), 480);

  const facetColourMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(codeFacets.map((f, i) => [f.facet_id, FACET_PALETTE[i % FACET_PALETTE.length]])),
    [codeFacets]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-brand-500 transition-colors"
          aria-label="Back to all codes"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          All codes
        </button>
        <span className="text-surface-300 dark:text-surface-600 text-xs">/</span>
        <span className="text-xs font-medium text-surface-700 dark:text-surface-200">
          {codeName}
        </span>
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Scatter — left side */}
        <div ref={scatterContainerRef} className="flex-1 min-w-0">
          <p className="text-[10px] text-surface-400 mb-2">
            Hover a facet card to highlight its segments. Dots are labelled with their facet sub-theme.
          </p>
          <FacetScatterPlot
            facets={codeFacets}
            colourMap={colourMap}
            drillCodeId={codeId}
            highlightFacetId={highlightFacetId}
            width={scatterWidth}
            height={plotHeight}
          />
        </div>

        {/* Facet cards — right side */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[480px] pr-1">
          <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">
            Facets ({codeFacets.length})
          </p>
          {codeFacets.length === 0 ? (
            <p className="text-xs text-surface-400">No facets found for this code.</p>
          ) : (
            codeFacets.map((facet) => (
              <FacetCard
                key={facet.facet_id}
                facet={facet}
                projectId={projectId}
                colour={facetColourMap[facet.facet_id] ?? "#6b7280"}
                isHighlighted={highlightFacetId === facet.facet_id}
                onMouseEnter={() => setHighlightFacetId(facet.facet_id)}
                onMouseLeave={() => setHighlightFacetId(null)}
                onLabelChange={onLabelChange}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
