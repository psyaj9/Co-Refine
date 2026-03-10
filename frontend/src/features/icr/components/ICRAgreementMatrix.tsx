import type { ICRAgreementMatrix as ICRAgreementMatrixType } from "@/shared/types";
import { cn } from "@/shared/lib/utils";

interface ICRAgreementMatrixProps {
  matrix: ICRAgreementMatrixType;
}

function cellColor(value: number, max: number): string {
  if (max === 0) return "bg-surface-100 dark:bg-surface-700";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-500 text-white";
  if (ratio >= 0.5) return "bg-emerald-300 text-emerald-900 dark:bg-emerald-600 dark:text-white";
  if (ratio >= 0.2) return "bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-white";
  if (ratio > 0) return "bg-red-200 text-red-800 dark:bg-red-700 dark:text-white";
  return "bg-surface-100 dark:bg-surface-700 text-surface-400";
}

export default function ICRAgreementMatrix({ matrix }: ICRAgreementMatrixProps) {
  const { code_labels, matrix: data } = matrix;

  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-surface-400 p-4">No agreement matrix data available.</p>
    );
  }

  // Determine if this is a code×code or coder×coder matrix
  const rowLabels = code_labels ?? [];
  const colLabels = code_labels ?? [];
  const max = Math.max(...data.flat());

  return (
    <div className="overflow-auto">
      <table className="text-[11px] border-collapse" aria-label="Agreement matrix">
        <thead>
          <tr>
            <th className="w-4" />
            {colLabels.map((label, j) => (
              <th
                key={j}
                className="text-center font-medium text-surface-500 dark:text-surface-400 px-1.5 py-1 max-w-[72px]"
                title={label}
              >
                <div className="truncate max-w-[64px]">{label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="text-right font-medium text-surface-500 dark:text-surface-400 pr-2 py-1 max-w-[80px]">
                <div className="truncate max-w-[72px]" title={rowLabels[i]}>{rowLabels[i]}</div>
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "text-center tabular-nums px-1.5 py-1 rounded min-w-[32px]",
                    i === j ? "font-bold" : "",
                    cellColor(cell, max)
                  )}
                  title={`${rowLabels[i]} × ${colLabels[j]}: ${cell}`}
                  aria-label={`${rowLabels[i]} vs ${colLabels[j]}: ${cell}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-surface-400 mt-2 pl-1">
        Cell value = number of co-coded segments. Diagonal indicates self-overlap.
      </p>
    </div>
  );
}
