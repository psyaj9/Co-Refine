import type { AlertPayload, CodeOut } from "@/types";

interface GhostPartnerActionsProps {
  alert: AlertPayload;
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
  dismissAlert: (idx: number) => void;
}

/**
 * Action buttons rendered when `alert.type === "ghost_partner"` and a coding conflict exists.
 * Lets the researcher keep their code or switch to the AI's predicted code.
 */
export default function GhostPartnerActions({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
  dismissAlert,
}: GhostPartnerActionsProps) {
  if (!alert.is_conflict) return null;

  const predictedCode = alert.data?.predicted_code as string | undefined;
  const codeExistsInProject = predictedCode && codes.some((c) => c.label === predictedCode);

  return (
    <div className="flex gap-1.5 mt-2">
      <button
        onClick={() => keepMyCode(alertIdx)}
        className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
      >
        Keep my code
      </button>

      {codeExistsInProject ? (
        <button
          onClick={() => applySuggestedCode(alert.segment_id!, predictedCode, alertIdx)}
          className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors"
        >
          Apply &ldquo;{predictedCode}&rdquo;
        </button>
      ) : predictedCode ? (
        <button
          onClick={() => dismissAlert(alertIdx)}
          className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          title="This code doesn't exist in your codebook yet"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
