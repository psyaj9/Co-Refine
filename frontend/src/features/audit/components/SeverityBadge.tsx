import { cn } from "@/lib/utils";
import { METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/features/audit/components/MetricTooltip";

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface SeverityBadgeProps {
  severity: string | null;
  score: number | null;
}

export default function SeverityBadge({ severity, score }: SeverityBadgeProps) {
  if (!severity) return null;
  const explanationKey = `severity_${severity}` as keyof typeof METRIC_EXPLANATIONS;
  const explanation = METRIC_EXPLANATIONS[explanationKey] || "";
  return (
    <MetricTooltip explanation={explanation}>
      <span
        className={cn(
          "text-2xs px-1.5 py-0.5 rounded font-medium",
          SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.low,
        )}
      >
        {severity}
        {score != null ? ` (${score.toFixed(2)})` : ""}
      </span>
    </MetricTooltip>
  );
}
