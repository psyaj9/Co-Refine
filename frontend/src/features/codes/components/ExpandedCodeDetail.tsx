import { Pencil, Check, X, Tag, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import RetrievedSegments from "./RetrievedSegments";
import type { CodeOut, AnalysisOut } from "@/shared/types";

interface ExpandedCodeDetailProps {
  code: CodeOut;
  isEditingDef: boolean;
  editDefText: string;
  setEditDefText: (v: string) => void;
  setEditingDefCodeId: (id: string | null) => void;
  updateCodeDefinition: (id: string, def: string) => Promise<void>;
  loadRetrievedSegments: (codeId: string) => Promise<void>;
  setExpandedCodeId: (id: string | null) => void;
  handleAnalyse: (codeId: string) => void;
  retrievedCodeId: string | null;
  analyses: AnalysisOut[];
}

export default function ExpandedCodeDetail({
  code,
  isEditingDef,
  editDefText,
  setEditDefText,
  setEditingDefCodeId,
  updateCodeDefinition,
  loadRetrievedSegments,
  setExpandedCodeId,
  handleAnalyse,
  retrievedCodeId,
  analyses,
}: ExpandedCodeDetailProps): React.ReactElement {
  const analysis = analyses.find((a) => a.code_id === code.id);

  return (
    <div className="ml-6 mr-1 mt-1 mb-2 space-y-1.5 tab-content-enter">
      {/* ── Definition panel ─── */}
      <div className="rounded bg-surface-50 dark:bg-surface-800 p-2">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-2xs uppercase tracking-wider text-surface-400 font-semibold">
            Your Definition
          </p>
          {!isEditingDef && (
            <button
              onClick={() => {
                setEditingDefCodeId(code.id);
                setEditDefText(code.definition || "");
              }}
              className="text-surface-400 hover:text-brand-600 transition-colors"
              title="Edit definition"
              aria-label={`Edit definition for ${code.label}`}
            >
              <Pencil size={9} aria-hidden="true" />
            </button>
          )}
        </div>
        {isEditingDef ? (
          <div className="space-y-1">
            <textarea
              value={editDefText}
              onChange={(e) => setEditDefText(e.target.value)}
              className="w-full rounded border panel-border px-2 py-1 text-2xs bg-transparent dark:text-surface-300 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
              rows={3}
              autoFocus
              aria-label="Code definition"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setEditingDefCodeId(null)}
                className="rounded p-1 text-surface-400 hover:text-surface-600 transition-colors"
                aria-label="Cancel editing"
              >
                <X size={10} aria-hidden="true" />
              </button>
              <button
                onClick={async () => {
                  await updateCodeDefinition(code.id, editDefText.trim());
                  setEditingDefCodeId(null);
                }}
                className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700 transition-colors"
                aria-label="Save definition"
              >
                <Check size={10} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-2xs text-surface-500 dark:text-surface-400 line-clamp-3">
            {code.definition || (
              <span className="italic text-surface-400">
                No definition — click pencil to add
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── AI-inferred analysis ─── */}
      {analysis && (
        <div className="rounded bg-brand-50 dark:bg-brand-900/10 p-2">
          <p className="text-2xs uppercase tracking-wider text-brand-500 dark:text-brand-400 font-semibold mb-0.5 flex items-center gap-1">
            <Sparkles size={8} aria-hidden="true" />
            AI-Inferred
          </p>
          <p className="text-2xs text-surface-600 dark:text-surface-300">
            {analysis.definition || "No AI definition yet"}
          </p>
          {analysis.lens && (
            <div className="mt-1.5 rounded bg-amber-50 dark:bg-amber-900/10 p-1.5">
              <p className="text-2xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
                Interpretive Lens
              </p>
              <p className="text-2xs text-surface-600 dark:text-surface-300">
                {analysis.lens}
              </p>
            </div>
          )}
          {analysis.reasoning && (
            <details className="mt-1">
              <summary className="text-2xs text-surface-400 cursor-pointer hover:text-surface-600">
                View reasoning
              </summary>
              <p className="text-2xs text-surface-500 dark:text-surface-400 mt-1 pl-2 border-l-2 panel-border">
                {analysis.reasoning}
              </p>
            </details>
          )}
        </div>
      )}

      {/* ── Action buttons ─── */}
      <div className="flex gap-1">
        <button
          onClick={() => {
            loadRetrievedSegments(code.id);
            setExpandedCodeId(code.id);
          }}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium transition-colors",
            retrievedCodeId === code.id
              ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
              : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600",
          )}
          title="View all segments for this code"
        >
          <Tag size={9} aria-hidden="true" />
          Segments
        </button>
        <button
          onClick={() => handleAnalyse(code.id)}
          className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 transition-colors"
          title="Run AI analysis"
        >
          <BookOpen size={9} aria-hidden="true" />
          Analyse
        </button>
      </div>

      {/* ── Retrieved segments ─── */}
      {retrievedCodeId === code.id && (
        <div className="rounded border panel-border overflow-hidden">
          <div className="max-h-72 overflow-y-auto thin-scrollbar">
            <RetrievedSegments />
          </div>
        </div>
      )}
    </div>
  );
}
