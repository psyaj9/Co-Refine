import { useStore } from "@/stores/store";
import AuditStageProgress from "@/features/audit/components/AuditStageProgress";
import AlertCard from "@/features/audit/components/AlertCard";
import type { AlertPayload } from "@/types";

/** Alert types that are internal pipeline signals — never rendered as cards. */
const HIDDEN_ALERT_TYPES = new Set(["agents_started", "agents_done", "deterministic_scores"]);

function deriveAnalysisStatus(alerts: AlertPayload[]): "pending" | "running" | "done" {
  if (
    alerts.some(
      (a) =>
        a.type === "analysis_updated" ||
        (a.type === "agent_error" &&
          (a as unknown as Record<string, unknown>).agent === "analysis"),
    )
  )
    return "done";
  if (alerts.some((a) => a.type === "agent_thinking" && a.agent === "analysis")) return "running";
  return "pending";
}

export default function AlertsTab(): React.ReactElement {
  const alerts = useStore((s) => s.alerts);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const auditStage = useStore((s) => s.auditStage);
  const dismissAlert = useStore((s) => s.dismissAlert);
  const applySuggestedCode = useStore((s) => s.applySuggestedCode);
  const keepMyCode = useStore((s) => s.keepMyCode);
  const codes = useStore((s) => s.codes);

  const visibleAlerts = alerts.filter((a) => !HIDDEN_ALERT_TYPES.has(a.type));
  const analysisStatus = deriveAnalysisStatus(alerts);

  if (visibleAlerts.length === 0 && !agentsRunning) {
    return (
      <div className="p-4" role="status">
        <p className="text-xs text-surface-400 dark:text-surface-500 italic text-center mt-8">
          AI agents are monitoring your coding. Alerts will appear here as you work.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-auto thin-scrollbar h-full tab-content-enter">
      {agentsRunning && (
        <AuditStageProgress auditStage={auditStage} analysisStatus={analysisStatus} />
      )}

      <ul className="space-y-2" aria-label="AI alerts">
        {visibleAlerts.map((alert) => (
          <AlertCard
            key={`${alert.type}-${alert.segment_id ?? alerts.indexOf(alert)}`}
            alert={alert}
            alertIdx={alerts.indexOf(alert)}
            codes={codes}
            applySuggestedCode={applySuggestedCode}
            keepMyCode={keepMyCode}
            dismissAlert={dismissAlert}
          />
        ))}
      </ul>
    </div>
  );
}
