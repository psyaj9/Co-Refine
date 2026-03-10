import { useState } from "react";
import { X, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { alertStyle, alertIcon, alertTitle, alertBody } from "@/shared/lib/alert-helpers";
import CodingAuditCard from "@/features/audit/components/CodingAuditCard";
import GhostPartnerActions from "@/features/audit/components/GhostPartnerActions";
import ConsistencyActions from "@/features/audit/components/ConsistencyActions";
import TemporalDriftCard from "@/features/audit/components/TemporalDriftCard";
import type { AlertPayload, CodeOut } from "@/shared/types";

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
  const [isOpen, setIsOpen] = useState(true);
  const isCodingAudit = alert.type === "coding_audit";
  const isTemporalDrift = alert.type === "temporal_drift_warning";
  const hasSegmentText = !!(alert.segment_text || alert.data?.segment_text);
  const isThinking = alert.type === "agent_thinking";

  return (
    <li className={cn("alert-slide rounded-lg border p-2.5", alertStyle(alert.type))}>
      {/* Header: collapse toggle + icon + title + dismiss */}
      <div className={cn("flex items-center gap-1.5", isOpen && "mb-1")}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse alert" : "Expand alert"}
        >
          {isOpen ? (
            <ChevronDown size={9} className="shrink-0 text-surface-400" aria-hidden="true" />
          ) : (
            <ChevronRightIcon size={9} className="shrink-0 text-surface-400" aria-hidden="true" />
          )}
          {alertIcon(alert.type)}
          <span className="text-2xs font-semibold truncate">{alertTitle(alert)}</span>
        </button>
        {!isThinking && (
          <button
            onClick={() => dismissAlert(alertIdx)}
            className="shrink-0 text-surface-400 hover:text-surface-600 transition-colors"
            aria-label="Dismiss alert"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Body: collapsible */}
      {isOpen && (
        isCodingAudit ? (
          <CodingAuditCard
            alert={alert}
            alertIdx={alertIdx}
            codes={codes}
            applySuggestedCode={applySuggestedCode}
            keepMyCode={keepMyCode}
          />
        ) : isTemporalDrift ? (
          <TemporalDriftCard
            alert={alert}
            alertIdx={alertIdx}
            dismissAlert={dismissAlert}
          />
        ) : (
          <>
            {hasSegmentText ? (
              <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3">
                &ldquo;{String(alert.segment_text || alert.data?.segment_text)}&rdquo;
              </blockquote>
            ) : (
              <p className="text-2xs text-surface-600 dark:text-surface-300 line-clamp-4">
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
        )
      )}
    </li>
  );
}
