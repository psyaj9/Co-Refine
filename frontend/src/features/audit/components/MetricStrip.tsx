import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/features/audit/components/MetricTooltip";
import { alertMetrics } from "@/lib/alert-helpers";
import type { AlertPayload } from "@/types";

interface MetricStripProps {
  alert: AlertPayload;
}

/** Enriched metrics strip shown beneath the body of a coding_audit alert card. */
export default function MetricStrip({ alert }: MetricStripProps) {
  const m = alertMetrics(alert);
  const hasMetrics = m.centroidSimilarity != null || m.severity != null;
  if (!hasMetrics) return null;

  return (
    <div className="mt-1.5 rounded border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10 px-2 py-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {m.centroidSimilarity != null && (
          <MetricTooltip explanation={METRIC_EXPLANATIONS.similarity}>
            <span className="text-[9px] text-surface-500 dark:text-surface-400">
              Similarity:{" "}
              <span className="font-medium text-surface-700 dark:text-surface-200">
                {m.centroidSimilarity.toFixed(3)}
              </span>
            </span>
          </MetricTooltip>
        )}
        {m.temporalDrift != null && m.temporalDrift > 0.3 && (
          <MetricTooltip explanation={METRIC_EXPLANATIONS.drift}>
            <span className="text-[9px] text-amber-600 dark:text-amber-400">
              Drift: <span className="font-medium">{m.temporalDrift.toFixed(3)}</span> ⚠
            </span>
          </MetricTooltip>
        )}
        {m.isPseudoCentroid && (
          <MetricTooltip explanation={METRIC_EXPLANATIONS.pseudo_centroid}>
            <span className="text-[9px] text-surface-400 italic">pseudo-centroid</span>
          </MetricTooltip>
        )}
        {m.segmentCount != null && m.segmentCount < 3 && (
          <MetricTooltip explanation={METRIC_EXPLANATIONS.sparse_data}>
            <span className="text-[9px] text-surface-400 italic">
              sparse ({m.segmentCount} seg{m.segmentCount !== 1 ? "s" : ""})
            </span>
          </MetricTooltip>
        )}
      </div>

      {m.severity && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "text-[9px] px-1 py-0 rounded font-medium",
              m.severity === "high"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : m.severity === "medium"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            )}
          >
            {m.severity}
          </span>
          {m.wasEscalated && (
            <MetricTooltip explanation={METRIC_EXPLANATIONS.escalation}>
              <span className="text-[9px] text-amber-600 dark:text-amber-400 italic flex items-center gap-0.5">
                <ShieldAlert size={7} aria-hidden="true" />
                escalated{m.escalationReason ? `: ${m.escalationReason}` : ""}
              </span>
            </MetricTooltip>
          )}
        </div>
      )}
    </div>
  );
}
