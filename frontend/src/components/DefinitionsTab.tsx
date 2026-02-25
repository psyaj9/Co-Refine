import { useStore } from "@/stores/store";
import { GitCompare } from "lucide-react";

export default function DefinitionsTab() {
  const codes = useStore((s) => s.codes);
  const analyses = useStore((s) => s.analyses);

  const codesWithAnalyses = codes.filter((c) =>
    analyses.some((a) => a.code_id === c.id)
  );

  if (codesWithAnalyses.length === 0) {
    return (
      <div className="p-4 text-center mt-8">
        <GitCompare size={24} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
        <p className="text-xs text-surface-400 dark:text-surface-500 italic">
          AI-inferred definitions will appear here after coding enough segments.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-auto thin-scrollbar h-full space-y-3">
      {codesWithAnalyses.map((code) => {
        const analysis = analyses.find((a) => a.code_id === code.id);
        if (!analysis) return null;

        return (
          <div key={code.id} className="rounded-lg border panel-border p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                style={{ backgroundColor: code.colour }}
              />
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">
                {code.label}
              </span>
              <span className="text-2xs text-surface-400 ml-auto">
                {code.segment_count} seg{code.segment_count !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Side-by-side comparison: user definition vs AI-inferred */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-surface-50 dark:bg-surface-800 p-2">
                <p className="text-2xs uppercase tracking-wider text-surface-400 font-semibold mb-1">
                  Your Definition
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {code.definition || (
                    <span className="italic text-surface-400">Not defined</span>
                  )}
                </p>
              </div>
              <div className="rounded bg-brand-50 dark:bg-brand-900/10 p-2">
                <p className="text-2xs uppercase tracking-wider text-brand-500 dark:text-brand-400 font-semibold mb-1">
                  AI-Inferred
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {analysis.definition || "No AI definition yet"}
                </p>
              </div>
            </div>

            {analysis.lens && (
              <div className="mt-2 rounded bg-amber-50 dark:bg-amber-900/10 p-2">
                <p className="text-2xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
                  Interpretive Lens
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {analysis.lens}
                </p>
              </div>
            )}

            {analysis.reasoning && (
              <details className="mt-1.5">
                <summary className="text-2xs text-surface-400 cursor-pointer hover:text-surface-600">
                  View reasoning
                </summary>
                <p className="text-2xs text-surface-500 dark:text-surface-400 mt-1 pl-2 border-l-2 panel-border">
                  {analysis.reasoning}
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
