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

        return (
          <div key={def.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-surface-700 dark:text-surface-200">
                {def.label}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-surface-500 tabular-nums">
                  {def.type === "int" ? value : value.toFixed(2)}
                </span>
                {!isDefault && (
                  <button
                    onClick={() => onResetThreshold(def.key)}
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
