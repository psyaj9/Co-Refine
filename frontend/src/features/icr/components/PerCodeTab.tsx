import type { ICRPerCodeMetric } from "@/types";
import { cn } from "@/lib/utils";

function alphaColor(score: number | null): string {
  if (score === null) return "bg-surface-300 dark:bg-surface-600";
  if (score >= 0.8) return "bg-emerald-500";
  if (score >= 0.6) return "bg-amber-400";
  if (score >= 0.4) return "bg-orange-400";
  return "bg-red-500";
}

interface PerCodeTabProps {
  perCode: ICRPerCodeMetric[];
}

export default function PerCodeTab({ perCode }: PerCodeTabProps) {
  if (perCode.length === 0) {
    return (
      <p className="text-xs text-surface-400 p-4">No per-code metrics available.</p>
    );
  }

  const sorted = [...perCode].sort((a, b) => {
    const aScore = a.alpha ?? -Infinity;
    const bScore = b.alpha ?? -Infinity;
    return aScore - bScore; // ascending — worst first
  });

  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[11px] text-surface-400 mb-3">Sorted by Krippendorff's α — worst first.</p>
      {sorted.map((item) => {
        const score = item.alpha;
        const pct = score !== null ? Math.max(0, Math.min(100, (score ?? 0) * 100)) : 0;

        return (
          <div
            key={item.code_id}
            className="rounded-lg border panel-border p-3 bg-white dark:bg-surface-800 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-surface-700 dark:text-surface-200 truncate pr-2" title={item.code_label}>
                {item.code_label}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="tabular-nums text-surface-500 dark:text-surface-400">
                  {score !== null ? score.toFixed(3) : "—"}
                </span>
                <span className="text-[10px] italic text-surface-400">{item.interpretation}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="h-1.5 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${item.code_label} alpha ${score?.toFixed(3) ?? "n/a"}`}
            >
              <div
                className={cn("h-full rounded-full transition-all", alphaColor(score))}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center gap-3 text-[10px] text-surface-400">
              <span>{item.n_units} units</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
