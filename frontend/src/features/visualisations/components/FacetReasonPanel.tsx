/**
 * FacetReasonPanel — floating overlay inside the scatter container.
 * Shows facet metadata, top segment previews, and an on-demand AI explanation.
 */
import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { fetchFacetExplanation } from "@/shared/api/client";
import type { FacetData } from "@/types";

interface FacetReasonPanelProps {
  projectId: string;
  facet: FacetData;
  onClose: () => void;
}

export default function FacetReasonPanel({ projectId, facet, onClose }: FacetReasonPanelProps) {
  const [explainState, setExplainState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [explanation, setExplanation] = useState<string>("");

  const handleExplain = async () => {
    setExplainState("loading");
    try {
      const result = await fetchFacetExplanation(projectId, facet.facet_id);
      setExplanation(result.explanation);
      setExplainState("done");
    } catch {
      setExplainState("error");
    }
  };

  const avgPct =
    facet.avg_similarity != null ? Math.round(facet.avg_similarity * 100) : null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Facet details: ${facet.facet_label}`}
      className="absolute top-3 right-3 z-20 w-72 rounded-lg border panel-border bg-white dark:bg-surface-900 shadow-lg p-3 flex flex-col gap-2 text-xs"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {facet.label_source === "ai" && (
              <Sparkles className="w-3 h-3 text-brand-500 shrink-0" aria-hidden="true" />
            )}
            <span className="font-semibold text-surface-800 dark:text-surface-100 truncate">
              {facet.facet_label}
            </span>
          </div>
          <span className="text-surface-400 text-[10px]">
            under <span className="font-medium">{facet.code_name}</span>
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close facet details"
          className="shrink-0 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Stats pills */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
          {facet.segment_count} segment{facet.segment_count !== 1 ? "s" : ""}
        </span>
        {avgPct != null && (
          <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
            avg sim {avgPct}%
          </span>
        )}
        {facet.label_source === "ai" && (
          <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
            AI label
          </span>
        )}
        {facet.label_source === "user" && (
          <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
            renamed
          </span>
        )}
      </div>

      {/* Segment previews */}
      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
        <p className="text-surface-400 uppercase tracking-wide text-[10px] font-semibold">
          Segment previews
        </p>
        {facet.segments.slice(0, 6).map((seg) => (
          <p
            key={seg.segment_id}
            className="text-surface-600 dark:text-surface-300 line-clamp-2 leading-snug"
          >
            "{seg.text_preview}"
          </p>
        ))}
        {facet.segments.length === 0 && (
          <p className="text-surface-400 italic">No segment previews available.</p>
        )}
      </div>

      {/* AI explain section */}
      {explainState === "idle" && (
        <button
          onClick={handleExplain}
          className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors text-[11px] font-medium"
          aria-label="Ask AI to explain what unifies this facet"
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          Explain this facet
        </button>
      )}

      {explainState === "loading" && (
        <div className="flex items-center gap-1.5 text-surface-400 text-[11px]">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          Generating explanation…
        </div>
      )}

      {explainState === "done" && (
        <div className="flex flex-col gap-1">
          <p className="text-surface-400 uppercase tracking-wide text-[10px] font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-400" aria-hidden="true" />
            AI explanation
          </p>
          <p className="text-surface-700 dark:text-surface-200 leading-relaxed">{explanation}</p>
          <button
            onClick={() => setExplainState("idle")}
            className="text-surface-400 hover:text-surface-600 text-[10px] self-start"
          >
            Regenerate
          </button>
        </div>
      )}

      {explainState === "error" && (
        <div className="flex flex-col gap-1">
          <p className="text-red-500 text-[11px]">Explanation failed.</p>
          <button
            onClick={() => setExplainState("idle")}
            className="text-brand-500 underline text-[10px] self-start"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
