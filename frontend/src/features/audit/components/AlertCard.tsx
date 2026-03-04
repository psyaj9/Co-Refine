import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { alertStyle, alertIcon, alertTitle, alertBody } from "@/lib/alert-helpers";
import CodingAuditCard from "@/features/audit/components/CodingAuditCard";
import GhostPartnerActions from "@/features/audit/components/GhostPartnerActions";
import ConsistencyActions from "@/features/audit/components/ConsistencyActions";
import type { AlertPayload, CodeOut } from "@/types";

interface AlertCardProps {
  alert: AlertPayload;
  /** Index of this alert in the full (unfiltered) alerts array — required for store actions. */
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
  dismissAlert: (idx: number) => void;
}

/**
 * Single alert `<li>` item. Routes to type-specific card content and action buttons.
 * Parent computes `alertIdx` via `alerts.indexOf(alert)` to handle filtered lists.
 */
export default function AlertCard({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
  dismissAlert,
}: AlertCardProps) {
  const isCodingAudit = alert.type === "coding_audit";
  const hasSegmentText = !!(alert.segment_text || alert.data?.segment_text);

  return (
    <li className={cn("alert-slide rounded-lg border p-2.5 relative", alertStyle(alert.type))}>
      {/* Dismiss button — hidden for thinking indicators */}
      {alert.type !== "agent_thinking" && (
        <button
          onClick={() => dismissAlert(alertIdx)}
          className="absolute top-1.5 right-1.5 text-surface-400 hover:text-surface-600 transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={10} />
        </button>
      )}

      {/* Header: icon + title */}
      <div className="flex items-center gap-1.5 mb-1">
        {alertIcon(alert.type)}
        <span className="text-2xs font-semibold">{alertTitle(alert)}</span>
      </div>

      {/* Body: type-specific */}
      {isCodingAudit ? (
        <CodingAuditCard
          alert={alert}
          alertIdx={alertIdx}
          codes={codes}
          applySuggestedCode={applySuggestedCode}
          keepMyCode={keepMyCode}
        />
      ) : (
        <>
          {hasSegmentText ? (
            <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3 pr-4">
              &ldquo;{String(alert.segment_text || alert.data?.segment_text)}&rdquo;
            </blockquote>
          ) : (
            <p className="text-2xs text-surface-600 dark:text-surface-300 line-clamp-4 pr-4">
              {alertBody(alert)}
            </p>
          )}

          {alert.type === "ghost_partner" && (
            <GhostPartnerActions
              alert={alert}
              alertIdx={alertIdx}
              codes={codes}
              applySuggestedCode={applySuggestedCode}
              keepMyCode={keepMyCode}
              dismissAlert={dismissAlert}
            />
          )}

          {alert.type === "consistency" && (
            <ConsistencyActions
              alert={alert}
              alertIdx={alertIdx}
              codes={codes}
              applySuggestedCode={applySuggestedCode}
              keepMyCode={keepMyCode}
            />
          )}
        </>
      )}
    </li>
  );
}
