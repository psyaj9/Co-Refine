import { useICRResolutions } from "../hooks/useICRResolutions";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, Clock, Pause } from "lucide-react";

const STATUS_CONFIG = {
  resolved: {
    label: "Resolved",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  unresolved: {
    label: "Unresolved",
    color: "text-surface-400",
    icon: Clock,
  },
  deferred: {
    label: "Deferred",
    color: "text-amber-500 dark:text-amber-400",
    icon: Pause,
  },
} as const;

const NEXT_STATUS: Record<string, "resolved" | "deferred" | "unresolved"> = {
  unresolved: "resolved",
  resolved: "deferred",
  deferred: "unresolved",
};

interface ResolutionTabProps {
  projectId: string;
}

export default function ResolutionTab({ projectId }: ResolutionTabProps) {
  const { resolutions, loading, error, reload, updateStatus } = useICRResolutions(projectId);

  if (loading) {
    return <p className="text-xs text-surface-400 animate-pulse p-4">Loading resolutions…</p>;
  }
  if (error) {
    return (
      <p className="text-xs text-red-500 p-4">
        Failed to load.{" "}
        <button type="button" className="underline" onClick={reload}>
          Retry
        </button>
      </p>
    );
  }
  if (resolutions.length === 0) {
    return (
      <p className="text-xs text-surface-400 p-4">
        No resolutions recorded yet. Resolve a disagreement from the Disagreements tab.
      </p>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {resolutions.map((r) => {
        const status = r.status as "resolved" | "unresolved" | "deferred";
        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unresolved;
        const Icon = cfg.icon;

        return (
          <div
            key={r.id}
            className="rounded-lg border panel-border bg-white dark:bg-surface-800 p-3 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium text-surface-700 dark:text-surface-200">
                  {r.disagreement_type.replace("_", " ")}
                  {r.span_text
                    ? ` — "${r.span_text.slice(0, 60)}${r.span_text.length > 60 ? "…" : ""}"`
                    : ` — chars ${r.span_start}–${r.span_end}`}
                </p>
                {r.resolution_note && (
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 break-words">
                    {r.resolution_note}
                  </p>
                )}
                {(r.resolved_by_name || r.resolved_by) && (
                  <p className="text-[10px] text-surface-400">
                    Resolved by {r.resolved_by_name ?? r.resolved_by}
                  </p>
                )}
              </div>

              {/* Status toggle */}
              <button
                type="button"
                aria-label={`Status: ${cfg.label}. Click to advance.`}
                onClick={() => updateStatus(r.id, NEXT_STATUS[status])}
                className={cn("flex items-center gap-1 text-[10px] font-medium flex-shrink-0", cfg.color)}
              >
                <Icon size={12} aria-hidden="true" />
                {cfg.label}
              </button>
            </div>

            {r.llm_analysis && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">
                  AI analysis
                </summary>
                <p className="mt-1 text-surface-600 dark:text-surface-300 whitespace-pre-wrap bg-surface-50 dark:bg-surface-700/50 rounded p-2">
                  {r.llm_analysis}
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
