import { useState } from "react";
import type { ICRDisagreement } from "@/types";
import { cn } from "@/lib/utils";
import { Bot, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  code_mismatch: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  boundary: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  coverage_gap: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700",
  split_merge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700",
  agreement: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
};

const STATUS_COLORS: Record<string, string> = {
  unresolved: "text-surface-400",
  resolved: "text-emerald-600 dark:text-emerald-400",
  deferred: "text-amber-500 dark:text-amber-400",
};

interface DisagreementCardProps {
  disagreement: ICRDisagreement;
  analysis: string | null;
  analyzingId: string | null;
  onAnalyze: (d: ICRDisagreement) => void;
  onResolve: (d: ICRDisagreement, note: string, chosenSegmentId: string | null) => void;
}

export default function DisagreementCard({
  disagreement,
  analysis,
  analyzingId,
  onAnalyze,
  onResolve,
}: DisagreementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [chosenId, setChosenId] = useState<string>("");

  const isAnalyzing = analyzingId === disagreement.unit_id;
  const resolvedAlready = disagreement.resolution_status === "resolved";

  function handleResolve() {
    onResolve(disagreement, note, chosenId || null);
  }

  return (
    <article
      className="border panel-border rounded-lg bg-white dark:bg-surface-800 overflow-hidden"
      aria-label={`Disagreement unit ${disagreement.unit_id}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 dark:bg-surface-700/50">
        <span
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
            TYPE_COLORS[disagreement.disagreement_type] ?? TYPE_COLORS.agreement
          )}
        >
          {disagreement.disagreement_type.replace("_", " ")}
        </span>
        <span className="text-[11px] text-surface-400 tabular-nums ml-auto">
          chars {disagreement.span_start}–{disagreement.span_end}
        </span>
        {disagreement.resolution_status && (
          <span className={cn("text-[10px] font-medium", STATUS_COLORS[disagreement.resolution_status] ?? STATUS_COLORS.unresolved)}>
            {disagreement.resolution_status}
          </span>
        )}
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((p) => !p)}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 ml-1"
        >
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      </div>

      {/* Assignments */}
      <div className="px-3 py-2 space-y-1">
        {disagreement.assignments.map((a) => (
          <div key={a.segment_id ?? a.coder_id} className="flex items-center gap-2 text-xs">
            <span className="font-medium text-surface-600 dark:text-surface-300 w-24 truncate" title={a.coder_name}>
              {a.coder_name}
            </span>
            {a.code_label ? (
              <span className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800">
                {a.code_label}
              </span>
            ) : (
              <span className="italic text-surface-300 dark:text-surface-500">—  no label</span>
            )}
          </div>
        ))}
        {disagreement.missing_coder_ids.length > 0 && (
          <p className="text-[10px] text-surface-400 pt-0.5">
            Not coded by: {disagreement.missing_coder_ids.join(", ")}
          </p>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t panel-border px-3 py-3 space-y-3">
          {/* AI analysis */}
          <div>
            {analysis ? (
              <div className="text-[11px] text-surface-600 dark:text-surface-300 whitespace-pre-wrap bg-surface-50 dark:bg-surface-700/50 rounded p-2">
                {analysis}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAnalyze(disagreement)}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
              >
                <Bot size={13} aria-hidden="true" />
                {isAnalyzing ? "Analysing…" : "Analyse with AI"}
              </button>
            )}
          </div>

          {/* Resolution form */}
          {!resolvedAlready && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-surface-600 dark:text-surface-300">
                Resolve
              </p>
              {disagreement.assignments.length > 0 && (
                <select
                  aria-label="Choose segment to keep"
                  value={chosenId}
                  onChange={(e) => setChosenId(e.target.value)}
                  className="w-full text-xs rounded border panel-border bg-white dark:bg-surface-700 text-surface-700 dark:text-surface-200 px-2 py-1.5"
                >
                  <option value="">— no specific segment —</option>
                  {disagreement.assignments.filter((a) => a.segment_id).map((a) => (
                    <option key={a.segment_id!} value={a.segment_id!}>
                      {a.coder_name}: {a.code_label}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                aria-label="Resolution note"
                placeholder="Resolution note (optional)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full text-xs rounded border panel-border bg-white dark:bg-surface-700 text-surface-700 dark:text-surface-200 px-2 py-1.5 resize-none"
              />
              <button
                type="button"
                onClick={handleResolve}
                className="flex items-center gap-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded px-3 py-1.5 font-medium"
              >
                <CheckCircle2 size={13} aria-hidden="true" />
                Mark resolved
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
