import { useMemo } from "react";
import { useStore } from "@/stores/store";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/utils";

export default function CrossTabulation() {
  const codes = useStore((s) => s.codes);
  const documents = useStore((s) => s.documents);
  const segments = useStore((s) => s.segments);

  const matrix = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const doc of documents) {
      result[doc.id] = {};
      for (const code of codes) {
        result[doc.id][code.id] = 0;
      }
    }
    for (const seg of segments) {
      if (result[seg.document_id] && result[seg.document_id][seg.code_id] !== undefined) {
        result[seg.document_id][seg.code_id]++;
      }
    }
    return result;
  }, [documents, codes, segments]);

  if (codes.length === 0 || documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-surface-400 italic">
          Need documents and codes for cross-tabulation.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto thin-scrollbar h-full tab-content-enter">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
        Code × Document Matrix
      </h3>
      <div className="overflow-auto" role="region" aria-label="Cross-tabulation table">
        <table className="text-2xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface-50 dark:bg-surface-800 p-1.5 text-left text-surface-500 font-semibold border panel-border min-w-[120px]">
                Document
              </th>
              {codes.map((code) => (
                <th
                  key={code.id}
                  className="p-1.5 text-center font-semibold border panel-border min-w-[60px]"
                  title={code.label}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: code.colour }}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[60px] text-surface-600 dark:text-surface-300">
                      {code.label}
                    </span>
                  </div>
                </th>
              ))}
              <th className="p-1.5 text-center font-semibold border panel-border text-surface-500 min-w-[40px]">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const rowTotal = codes.reduce(
                (sum, c) => sum + (matrix[doc.id]?.[c.id] || 0),
                0
              );
              return (
                <tr
                  key={doc.id}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <td className="sticky left-0 bg-white dark:bg-panel-dark p-1.5 text-left text-surface-600 dark:text-surface-300 font-medium border panel-border truncate max-w-[120px]">
                    {doc.title}
                  </td>
                  {codes.map((code) => {
                    const count = matrix[doc.id]?.[code.id] || 0;
                    return (
                      <td
                        key={code.id}
                        className={cn(
                          "p-1.5 text-center border panel-border tabular-nums",
                          count > 0
                            ? "text-surface-700 dark:text-surface-200 font-medium"
                            : "text-surface-300 dark:text-surface-600"
                        )}
                        style={
                          count > 0
                            ? { backgroundColor: hexToRgba(code.colour, 0.1) }
                            : undefined
                        }
                      >
                        {count || "–"}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center border panel-border font-semibold text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
            {/* Column totals */}
            <tr className="bg-surface-50 dark:bg-surface-800 font-semibold">
              <td className="sticky left-0 bg-surface-50 dark:bg-surface-800 p-1.5 border panel-border text-surface-500">
                Σ
              </td>
              {codes.map((code) => {
                const colTotal = documents.reduce(
                  (sum, d) => sum + (matrix[d.id]?.[code.id] || 0),
                  0
                );
                return (
                  <td
                    key={code.id}
                    className="p-1.5 text-center border panel-border text-surface-600 dark:text-surface-300"
                  >
                    {colTotal}
                  </td>
                );
              })}
              <td className="p-1.5 text-center border panel-border text-surface-700 dark:text-surface-200">
                {segments.length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
