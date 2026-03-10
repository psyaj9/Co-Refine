import type { ICRMetric } from "@/types";
import { cn } from "@/lib/utils";

interface ICRMetricCardProps {
  label: string;
  metric: ICRMetric;
  description?: string;
}

function scoreColour(score: number | null): string {
  if (score === null) return "text-surface-400 dark:text-surface-500";
  if (score >= 0.80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 0.60) return "text-amber-500 dark:text-amber-400";
  if (score >= 0.40) return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
}

export default function ICRMetricCard({ label, metric, description }: ICRMetricCardProps) {
  return (
    <div className="rounded-lg border panel-border bg-white dark:bg-surface-800 p-4 space-y-1.5">
      <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
        {label}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums", scoreColour(metric.score))}>
        {metric.score !== null ? metric.score.toFixed(3) : "—"}
      </p>
      <p className="text-[11px] text-surface-500 dark:text-surface-400 italic">
        {metric.interpretation}
      </p>
      <p className="text-[11px] text-surface-400 dark:text-surface-500">
        {metric.n_units} unit{metric.n_units !== 1 ? "s" : ""}
        {description ? ` · ${description}` : ""}
      </p>
    </div>
  );
}
