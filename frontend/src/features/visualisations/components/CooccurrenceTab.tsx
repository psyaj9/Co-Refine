import { useCooccurrence } from "@/features/visualisations/hooks/useCooccurrence";
import { cn } from "@/lib/utils";

/** Map a raw co-occurrence count to a background colour.
 *  Diagonal cells (self-usage) get a neutral tint.
 *  Off-diagonal cells scale from white → teal by intensity relative to the max. */
function cellStyle(
  count: number,
  maxCount: number,
  isDiagonal: boolean,
): React.CSSProperties {
  if (isDiagonal) return { backgroundColor: "var(--color-surface-200, #e2e8f0)" };
  if (maxCount === 0) return {};
  const intensity = count / maxCount;
  return { backgroundColor: `rgba(20,184,166,${0.08 + intensity * 0.82})` };
}

interface CooccurrenceTabProps {
  projectId: string;
}

export default function CooccurrenceTab({ projectId }: CooccurrenceTabProps) {
  const { state, data, reload } = useCooccurrence(projectId);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-32 text-surface-400 text-xs">
        Loading co-occurrence matrix&hellip;
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <span className="text-xs text-red-500">Failed to load co-occurrence data.</span>
        <button onClick={reload} className="text-xs text-brand-600 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
        <span className="text-xs text-surface-500">No co-occurrence data yet.</span>
        <span className="text-xs text-surface-400">
          Apply codes to text spans in your documents to see which codes co-occur.
        </span>
      </div>
    );
  }

  const { codes, matrix, total_segments, co_occurrence_counts } = data;

  // Highest off-diagonal value — used to normalise colour scale
  let maxOffDiag = 0;
  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      if (i !== j && matrix[i][j] > maxOffDiag) maxOffDiag = matrix[i][j];
    }
  }

  // Top pairs sorted by count (descending)
  const topPairs = Object.entries(co_occurrence_counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <p className="text-2xs text-surface-500 dark:text-surface-400">
        Showing how often each pair of codes has been applied to the{" "}
        <strong>exact same text span</strong> across {total_segments} distinct span
        {total_segments !== 1 ? "s" : ""}. Diagonal = total usage count for that code.
      </p>

      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs text-surface-500 dark:text-surface-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "rgba(20,184,166,0.15)" }} />
          Low co-occurrence
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "rgba(20,184,166,0.9)" }} />
          High co-occurrence
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-surface-200 dark:bg-surface-700" />
          Self (usage count)
        </div>
      </div>

      {/* Scrollable matrix */}
      <div className="overflow-auto rounded-lg border border-panel-border">
        <table className="text-2xs border-collapse" aria-label="Code co-occurrence matrix">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-panel-bg min-w-[96px]" />
              {codes.map((col) => (
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
            {codes.map((row, i) => (
              <tr key={row}>
                <th
                  className="sticky left-0 z-10 bg-panel-bg px-2 py-1.5 text-left font-medium text-surface-600 dark:text-surface-300 max-w-[96px] whitespace-nowrap overflow-hidden text-ellipsis"
                  title={row}
                  scope="row"
                >
                  {row.length > 14 ? row.slice(0, 13) + "…" : row}
                </th>
                {codes.map((col, j) => {
                  const count = matrix[i][j];
                  const isDiagonal = i === j;
                  const style = cellStyle(count, maxOffDiag, isDiagonal);

                  return (
                    <td
                      key={col}
                      className={cn(
                        "text-center px-1.5 py-1.5 font-mono font-medium transition-colors",
                        isDiagonal
                          ? "text-surface-400 dark:text-surface-500"
                          : count > 0
                            ? "text-teal-900 dark:text-teal-100"
                            : "text-surface-300 dark:text-surface-600",
                      )}
                      style={style}
                      title={
                        isDiagonal
                          ? `${row}: used on ${count} span${count !== 1 ? "s" : ""}`
                          : `${row} ↔ ${col}: co-applied on ${count} span${count !== 1 ? "s" : ""}`
                      }
                    >
                      {count === 0 && !isDiagonal ? "–" : count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top co-occurring pairs */}
      {topPairs.length > 0 && (
        <div>
          <h3 className="text-2xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
            Strongest co-occurring pairs
          </h3>
          <ul className="space-y-1">
            {topPairs.map(([key, count]) => {
              const [codeA, codeB] = key.split("__");
              const pct =
                total_segments > 0
                  ? Math.round((count / total_segments) * 100)
                  : 0;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between text-2xs text-surface-700 dark:text-surface-200 bg-surface-50 dark:bg-surface-800 rounded px-2 py-1"
                >
                  <span className="truncate">
                    <span className="font-medium">{codeA}</span>
                    <span className="mx-1 text-surface-400">↔</span>
                    <span className="font-medium">{codeB}</span>
                  </span>
                  <span className="ml-3 flex-shrink-0 font-mono text-teal-700 dark:text-teal-300">
                    {count}
                    <span className="ml-1 text-surface-400">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
