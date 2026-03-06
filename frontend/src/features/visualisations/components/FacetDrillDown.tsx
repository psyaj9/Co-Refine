/**
 * FacetDrillDown — zoomed view for a single code.
 * Shows the scatter plot of just this code's segments (labelled by facet),
 * plus FacetCards for each facet with the AI explanation feature.
 */
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import FacetScatterPlot from "./FacetScatterPlot";
import FacetCard from "./FacetCard";
import type { FacetData } from "@/types";

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

  const codeFacets = facets.filter((f) => f.code_id === codeId);

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
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-surface-400 mb-2">
            Hover a facet card to highlight its segments. Dots are labelled with their facet sub-theme.
          </p>
          <div className="w-full">
            <FacetScatterPlot
              facets={codeFacets}
              colourMap={colourMap}
              drillCodeId={codeId}
              highlightFacetId={highlightFacetId}
              width={520}
              height={380}
            />
          </div>
        </div>

        {/* Facet cards — right side */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[420px] pr-1">
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
                colour={colourMap[facet.code_id] ?? "#6b7280"}
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
