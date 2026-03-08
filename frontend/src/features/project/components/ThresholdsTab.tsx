import { useState, useCallback } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { ThresholdDefinition } from "@/types";

interface ThresholdsTabProps {
  thresholdDefs: ThresholdDefinition[];
  localThresholds: Record<string, number>;
  onSetThreshold: (key: string, value: number) => void;
  onResetThreshold: (key: string) => void;
}

export default function ThresholdsTab({
  thresholdDefs,
  localThresholds,
  onSetThreshold,
  onResetThreshold,
}: ThresholdsTabProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const commitDraft = useCallback(
    (def: ThresholdDefinition) => {
      const draft = draftValues[def.key];
      if (draft === undefined) return;
      const parsed = def.type === "int" ? parseInt(draft, 10) : parseFloat(draft);
      if (!isNaN(parsed)) {
        onSetThreshold(def.key, Math.min(def.max, Math.max(def.min, parsed)));
      }
      setDraftValues((prev) => {
        const next = { ...prev };
        delete next[def.key];
        return next;
      });
    },
    [draftValues, onSetThreshold],
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
        <Info size={14} className="mt-0.5 shrink-0" />
        Adjust thresholds that control when AI agents escalate, warn, or trigger
        analysis. Changes apply to this project only.
      </p>

      {thresholdDefs.map((def) => {
        const value = localThresholds[def.key] ?? def.default;
        const isDefault = value === def.default;
        const inputDisplay =
          draftValues[def.key] !== undefined
            ? draftValues[def.key]
            : def.type === "int"
              ? String(value)
              : value.toFixed(2);

        return (
          <div key={def.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-surface-700 dark:text-surface-200">
                {def.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  value={inputDisplay}
                  onChange={(e) =>
                    setDraftValues((prev) => ({ ...prev, [def.key]: e.target.value }))
                  }
                  onBlur={() => commitDraft(def)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitDraft(def); }}
                  aria-label={`${def.label} value`}
                  className="w-16 text-right text-xs font-mono tabular-nums bg-transparent border border-surface-200 dark:border-surface-700 rounded px-1.5 py-0.5 text-surface-600 dark:text-surface-300 focus:outline-none focus:border-brand-500 focus:text-surface-800 dark:focus:text-surface-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                {!isDefault && (
                  <button
                    onClick={() => {
                      onResetThreshold(def.key);
                      setDraftValues((prev) => {
                        const next = { ...prev };
                        delete next[def.key];
                        return next;
                      });
                    }}
                    className="text-surface-400 hover:text-brand-500 transition-colors"
                    title={`Reset to default (${def.default})`}
                    aria-label={`Reset ${def.label} to default`}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={value}
              onChange={(e) => {
                const v =
                  def.type === "int"
                    ? parseInt(e.target.value)
                    : parseFloat(e.target.value);
                onSetThreshold(def.key, v);
              }}
              className="w-full h-1.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer"
            />
            <p className="text-[10px] text-surface-400 dark:text-surface-500 leading-relaxed">
              {def.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
