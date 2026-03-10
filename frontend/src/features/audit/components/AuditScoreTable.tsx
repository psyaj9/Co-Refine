import { cn } from "@/shared/lib/utils";

interface ScoreRow {
  label: string;
  before: number;
  after: number;
  delta: number;
  /** If true, a higher delta is bad (e.g. severity score). Default: higher = better. */
  invertDeltaColor?: boolean;
}

interface AuditScoreTableProps {
  rows: ScoreRow[];
}

const fmtDelta = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

/**
 * Reusable before/after score comparison grid.
 * Used by both the Reflection section and the Challenge section of CodingAuditDetail.
 */
export default function AuditScoreTable({ rows }: AuditScoreTableProps) {
  return (
    <div className="grid grid-cols-3 gap-1 text-[9px]">
      <div className="text-surface-400">Metric</div>
      <div className="text-surface-400">Before</div>
      <div className="text-surface-400">After (Δ)</div>

      {rows.map((row) => {
        const improved = row.invertDeltaColor ? row.delta < 0 : row.delta > 0;
        const worsened = row.invertDeltaColor ? row.delta > 0 : row.delta < 0;
        return (
          <>
            <div key={`${row.label}-label`} className="text-surface-500">
              {row.label}
            </div>
            <div key={`${row.label}-before`}>{row.before.toFixed(2)}</div>
            <div
              key={`${row.label}-after`}
              className={cn(
                improved ? "text-green-600" : worsened ? "text-red-600" : "",
              )}
            >
              {row.after.toFixed(2)} ({fmtDelta(row.delta)})
            </div>
          </>
        );
      })}
    </div>
  );
}
