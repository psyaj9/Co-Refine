import { useCodeOverlap } from "@/features/visualisations/hooks/useCodeOverlap";
import { FlaggedPairs } from "@/features/visualisations/components/FlaggedPairs";
import { cn } from "@/lib/utils";

/** Map a similarity value [0, 1] to a background colour.
 *  Values below threshold → blue intensity scale; at/above threshold → amber warning. */
function cellStyle(
  value: number,
  threshold: number,
  isDiagonal: boolean,
): React.CSSProperties {
  if (isDiagonal) return { backgroundColor: "var(--color-surface-200, #e2e8f0)" };
  if (value >= threshold) {
    const intensity = Math.min(1, (value - threshold) / (1 - threshold));
    return { backgroundColor: `rgba(251,146,60,${0.25 + intensity * 0.65})` };
  }
  return { backgroundColor: `rgba(59,130,246,${value * 0.7})` };
}

interface CodeOverlapTabProps {
  projectId: string;
}

export default function CodeOverlapTab({ projectId }: CodeOverlapTabProps) {
  const { state, matrix, labels, threshold, reload } = useCodeOverlap(projectId);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-32 text-surface-400 text-xs">
        Loading overlap matrix&hellip;
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <span className="text-xs text-red-500">Failed to load overlap data.</span>
        <button onClick={reload} className="text-xs text-brand-600 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!matrix || labels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
        <span className="text-xs text-surface-500">No overlap data yet.</span>
        <span className="text-xs text-surface-400">
          Run a batch audit to compute semantic similarity between your codes.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs text-surface-500 dark:text-surface-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "rgba(59,130,246,0.5)" }} />
          Low overlap
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "rgba(251,146,60,0.7)" }} />
          High overlap (≥ {threshold})
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-surface-200 dark:bg-surface-700" />
          Self
        </div>
      </div>

      {/* Scrollable matrix container */}
      <div className="overflow-auto rounded-lg border border-panel-border">
        <table className="text-2xs border-collapse" aria-label="Code semantic overlap matrix">
          <thead>
            <tr>
              {/* empty top-left corner */}
              <th className="sticky left-0 z-10 bg-panel-bg min-w-[96px]" />
              {labels.map((col) => (
                <th
                  key={col}
                  className="px-1.5 py-1.5 font-medium text-surface-600 dark:text-surface-300 text-center max-w-[72px] min-w-[56px] whitespace-nowrap overflow-hidden text-ellipsis"
                  title={col}
                  scope="col"
                >
                  {col.length > 10 ? col.slice(0, 9) + "…" : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((row) => (
              <tr key={row}>
                {/* Row header */}
                <th
                  className="sticky left-0 z-10 bg-panel-bg px-2 py-1.5 text-left font-medium text-surface-600 dark:text-surface-300 max-w-[96px] whitespace-nowrap overflow-hidden text-ellipsis"
                  title={row}
                  scope="row"
                >
                  {row.length > 14 ? row.slice(0, 13) + "…" : row}
                </th>
                {/* Cells */}
                {labels.map((col) => {
                  const value = matrix[row]?.[col] ?? null;
                  const isDiagonal = row === col;
                  const displayValue = isDiagonal ? "—" : value != null ? value.toFixed(2) : "N/A";
                  const style =
                    value != null
                      ? cellStyle(value, threshold, isDiagonal)
                      : { backgroundColor: "var(--color-surface-100, #f1f5f9)" };

                  return (
                    <td
                      key={col}
                      className={cn(
                        "text-center px-1.5 py-1.5 font-mono font-medium transition-colors",
                        isDiagonal
                          ? "text-surface-400 dark:text-surface-500"
                          : value != null && value >= threshold && !isDiagonal
                            ? "text-amber-900 dark:text-amber-200"
                            : "text-surface-700 dark:text-surface-200",
                      )}
                      style={style}
                      title={
                        isDiagonal
                          ? `${row} (self)`
                          : value != null
                            ? `${row} ↔ ${col}: ${value.toFixed(3)}${value >= threshold ? " — potential redundancy" : ""}`
                            : `${row} ↔ ${col}: not computed`
                      }
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Flagged pairs summary */}
      <FlaggedPairs matrix={matrix} labels={labels} threshold={threshold} />
    </div>
  );
}
