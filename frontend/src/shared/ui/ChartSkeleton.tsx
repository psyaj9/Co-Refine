import { cn } from "@/shared/lib/utils";

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartSkeleton({ height = 200, className }: ChartSkeletonProps) {
  return (
    <div
      className={cn("w-full rounded-lg bg-surface-100 dark:bg-surface-800 animate-pulse", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <div className="h-full flex flex-col justify-end gap-1 p-3">
        {[0.6, 0.85, 0.45, 0.7, 0.55, 0.9].map((h, i) => (
          <div
            key={i}
            className="bg-surface-200 dark:bg-surface-700 rounded"
            style={{ height: `${h * 30}%`, width: `${60 + i * 5}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="rounded-lg border panel-border panel-bg p-4 animate-pulse">
      <div className="h-8 w-16 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
      <div className="h-3 w-24 bg-surface-100 dark:bg-surface-800 rounded" />
    </div>
  );
}
