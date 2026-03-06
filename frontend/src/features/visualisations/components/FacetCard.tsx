/**
 * FacetCard — displays a single facet's metadata, allows label editing,
 * and provides an "Explain" button that fetches an AI explanation.
 */
import { useState } from "react";
import { Pencil, Check, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { renameFacet, explainFacet } from "@/api/client";
import type { FacetData } from "@/types";

export interface FacetCardProps {
  facet: FacetData;
  projectId: string;
  colour: string;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLabelChange: (facetId: string, newLabel: string) => void;
}

export default function FacetCard({
  facet,
  projectId,
  colour,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  onLabelChange,
}: FacetCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(facet.facet_label);
  const [saving, setSaving] = useState(false);

  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  async function handleSaveLabel() {
    if (!draft.trim() || draft === facet.facet_label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await renameFacet(projectId, facet.facet_id, draft.trim());
      onLabelChange(facet.facet_id, draft.trim());
    } catch {
      setDraft(facet.facet_label);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleExplain() {
    if (explanation) {
      setExplainOpen((o) => !o);
      return;
    }
    setExplaining(true);
    setExplainError(null);
    setExplainOpen(true);
    try {
      const result = await explainFacet(projectId, facet.facet_id);
      setExplanation(result.explanation);
    } catch {
      setExplainError("Failed to generate explanation. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all text-sm",
        isHighlighted
          ? "border-brand-400 bg-surface-50 dark:bg-surface-800 shadow-sm"
          : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Colour swatch */}
        <span
          className="mt-0.5 h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: colour }}
          aria-hidden="true"
        />

        {/* Label / edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                className="flex-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-brand-400"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveLabel();
                  if (e.key === "Escape") { setDraft(facet.facet_label); setEditing(false); }
                }}
                autoFocus
                aria-label="Edit facet label"
              />
              <button
                onClick={() => void handleSaveLabel()}
                disabled={saving}
                aria-label="Save label"
                className="text-green-600 hover:text-green-700 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                onClick={() => { setDraft(facet.facet_label); setEditing(false); }}
                aria-label="Cancel edit"
                className="text-surface-400 hover:text-surface-600"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="font-medium text-surface-800 dark:text-surface-100 break-words">
                {facet.facet_label}
              </span>
              {facet.label_source === "ai" && (
                <span className="text-[10px] text-surface-400 flex-shrink-0">(AI)</span>
              )}
              <button
                onClick={() => { setDraft(facet.facet_label); setEditing(true); }}
                aria-label="Edit facet label"
                className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-brand-500 transition-opacity"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-surface-400 dark:text-surface-500 pl-5">
        <span>{facet.segment_count} segments</span>
        {facet.avg_similarity != null && (
          <span>avg sim {(facet.avg_similarity * 100).toFixed(0)}%</span>
        )}
      </div>

      {/* Explain button + result */}
      <div className="mt-2 pl-5">
        <button
          onClick={() => void handleExplain()}
          disabled={explaining}
          aria-label={explanation ? "Toggle explanation" : "Generate AI explanation"}
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 transition-colors",
            "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30",
            "hover:bg-brand-100 dark:hover:bg-brand-900/40 disabled:opacity-60"
          )}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          {explaining ? "Explaining…" : explanation ? "AI Explanation" : "Explain this facet"}
          {explanation && (
            explainOpen
              ? <ChevronUp className="w-3 h-3 ml-0.5" aria-hidden="true" />
              : <ChevronDown className="w-3 h-3 ml-0.5" aria-hidden="true" />
          )}
        </button>

        {explainOpen && (
          <div className="mt-1.5 rounded border border-brand-100 dark:border-brand-900/40 bg-brand-50/50 dark:bg-brand-950/20 p-2">
            {explaining && (
              <p className="text-[10px] text-surface-400 italic">Generating explanation…</p>
            )}
            {explainError && (
              <p className="text-[10px] text-red-500">{explainError}</p>
            )}
            {explanation && !explaining && (
              <p className="text-[10px] text-surface-600 dark:text-surface-300 leading-relaxed">
                {explanation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
