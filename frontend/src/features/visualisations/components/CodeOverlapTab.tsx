import { useEffect, useState } from "react";
import { useStore } from "@/stores/store";
import { fetchVisOverlap } from "@/api/client";
import type { CodeOverlapData } from "@/types";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "error" | "success";

/** Map a similarity value [0, 1] to a background colour.
 *  Values below threshold → blue intensity scale; at/above threshold → amber warning. */
function cellStyle(
  value: number,
  threshold: number,
  isDiagonal: boolean,
): React.CSSProperties {
  if (isDiagonal) return { backgroundColor: "var(--color-surface-200, #e2e8f0)" };
  if (value >= threshold) {
    // Amber warning: opacity scales with how far above the threshold we are
    const intensity = Math.min(1, (value - threshold) / (1 - threshold));
    return { backgroundColor: `rgba(251,146,60,${0.25 + intensity * 0.65})` }; // orange-400 base
  }
  // Brand blue: opacity scales with value
  return { backgroundColor: `rgba(59,130,246,${value * 0.7})` }; // blue-500 base
}

interface CodeOverlapTabProps {
  projectId: string;
}

export default function CodeOverlapTab({ projectId }: CodeOverlapTabProps) {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<CodeOverlapData | null>(null);
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const liveMatrix = useStore((s) => s.overlapMatrix);

  useEffect(() => {
    setState("loading");
    fetchVisOverlap(projectId)
      .then((d) => {
        setData(d);
        setState("success");
      })
      .catch(() => setState("error"));
  }, [projectId, visRefreshCounter]);

  // Apply live WS update on top of fetched data when available
  const matrix = liveMatrix ?? data?.matrix ?? null;
  const labels = liveMatrix
    ? Object.keys(liveMatrix)
    : data?.code_labels ?? [];
  const threshold = data?.threshold ?? 0.85;

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-32 text-surface-400 text-xs">
        Loading overlap matrix…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <span className="text-xs text-red-500">Failed to load overlap data.</span>
        <button
          onClick={() => {
            setState("loading");
            fetchVisOverlap(projectId)
              .then((d) => { setData(d); setState("success"); })
              .catch(() => setState("error"));
          }}
          className="text-xs text-brand-600 underline"
        >
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

interface FlaggedPairsProps {
  matrix: Record<string, Record<string, number>>;
  labels: string[];
  threshold: number;
}

function FlaggedPairs({ matrix, labels, threshold }: FlaggedPairsProps) {
  const pairs: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const score = matrix[labels[i]]?.[labels[j]] ?? 0;
      if (score >= threshold) {
        pairs.push({ a: labels[i], b: labels[j], score });
      }
    }
  }

  if (pairs.length === 0) return null;

  pairs.sort((x, y) => y.score - x.score);

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
      <p className="text-2xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
        Potentially redundant pairs ({pairs.length})
      </p>
      <ul className="space-y-1">
        {pairs.map(({ a, b, score }) => (
          <li key={`${a}-${b}`} className="flex items-center justify-between gap-2">
            <span className="text-2xs text-amber-800 dark:text-amber-200 truncate">
              <span className="font-medium">{a}</span>
              <span className="mx-1 text-amber-500">↔</span>
              <span className="font-medium">{b}</span>
            </span>
            <span className="text-2xs font-mono font-semibold text-amber-700 dark:text-amber-300 flex-shrink-0">
              {score.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
