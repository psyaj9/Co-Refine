import type { AlertPayload } from "@/shared/types";
import { METRIC_EXPLANATIONS } from "@/shared/lib/constants";

interface TemporalDriftCardProps {
  alert: AlertPayload;
  alertIdx: number;
  dismissAlert: (idx: number) => void;
}

/**
 * Card body rendered when `alert.type === "temporal_drift_warning"`.
 * Shows the code's average drift value as a progress bar with plain-language guidance.
 */
export default function TemporalDriftCard({
  alert,
}: TemporalDriftCardProps) {
  const data = alert.data || {};
  const avgDrift = typeof data.avg_drift === "number" ? data.avg_drift : null;
  const threshold = typeof data.threshold === "number" ? data.threshold : 0.3;
  const sampleCount = typeof data.sample_count === "number" ? data.sample_count : null;
  const message = typeof data.message === "string" ? data.message : METRIC_EXPLANATIONS.drift;

  const pct = avgDrift !== null ? Math.round(avgDrift * 100) : null;

  return (
    <div className="space-y-2 mt-1">
      {/* Progress bar */}
      {pct !== null && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-2xs text-surface-500 dark:text-surface-400">
            <span>Semantic drift</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {pct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400 dark:bg-orange-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Temporal drift: ${pct}%`}
            />
          </div>
          <div
            className="w-0 border-l border-dashed border-orange-300 dark:border-orange-700 h-2 ml-[30%] relative -mt-0.5"
            title={`Threshold: ${Math.round(threshold * 100)}%`}
            style={{ marginLeft: `${Math.round(threshold * 100)}%` }}
          />
        </div>
      )}

      {/* Plain-language message */}
      <p className="text-2xs text-surface-600 dark:text-surface-300 leading-relaxed">
        {message}
      </p>

      {/* Sample count footnote */}
      {sampleCount !== null && (
        <p className="text-2xs text-surface-400 dark:text-surface-500">
          Based on {sampleCount} scored segment{sampleCount !== 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}
