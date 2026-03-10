import type { AlertPayload, CodeOut } from "@/shared/types";

interface ConsistencyActionsProps {
  alert: AlertPayload;
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
}

/**
 * Alternative-code suggestion buttons rendered when `alert.type === "consistency"`
 * and there are codebook-matched alternatives to apply.
 */
export default function ConsistencyActions({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
}: ConsistencyActionsProps) {
  const alternatives = Array.isArray(alert.data?.alternative_codes)
    ? (alert.data.alternative_codes as string[]).filter((ac) =>
        codes.some((c) => c.label === ac),
      )
    : [];

  if (alternatives.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <span className="text-2xs text-surface-500 dark:text-surface-400 font-medium">
        Suggested alternatives:
      </span>
      <div className="flex flex-wrap gap-1">
        {alternatives.map((ac) => (
          <button
            key={ac}
            onClick={() => applySuggestedCode(alert.segment_id!, ac, alertIdx)}
            className="rounded px-2 py-0.5 text-2xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
          >
            Apply &ldquo;{ac}&rdquo;
          </button>
        ))}
        <button
          onClick={() => keepMyCode(alertIdx)}
          className="rounded px-2 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
        >
          Keep current
        </button>
      </div>
    </div>
  );
}
