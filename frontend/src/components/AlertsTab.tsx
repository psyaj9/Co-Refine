import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useStore } from "@/stores/store";
import { cn } from "@/lib/utils";
import { AGENT_LABELS } from "@/lib/constants";
import { alertStyle, alertIcon, alertTitle, alertBody } from "@/lib/alert-helpers";
import CodingAuditDetail from "@/components/CodingAuditDetail";

export default function AlertsTab(): React.ReactElement {
  const alerts = useStore((s) => s.alerts);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const dismissAlert = useStore((s) => s.dismissAlert);
  const applySuggestedCode = useStore((s) => s.applySuggestedCode);
  const keepMyCode = useStore((s) => s.keepMyCode);
  const codes = useStore((s) => s.codes);

  const visibleAlerts = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  );

  const agentSteps = agentsRunning
    ? (["coding_audit", "analysis"] as const).map((key) => {
        const label = AGENT_LABELS[key];
        const isThinking = alerts.some(
          (a) => a.type === "agent_thinking" && a.agent === key
        );
        const hasResult = alerts.some(
          (a) =>
            a.type === key ||
            (a.type === "analysis_updated" && key === "analysis") ||
            (a.type === "agent_error" && (a as unknown as Record<string, unknown>).agent === key)
        );
        const status: "pending" | "running" | "done" = hasResult
          ? "done"
          : isThinking
            ? "running"
            : "pending";
        return { key, label, status };
      })
    : [];

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
        <div className="mb-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={12} className="text-brand-500 animate-spin" aria-hidden="true" />
            <span className="text-2xs font-semibold text-brand-700 dark:text-brand-300">
              Agents analysing your coding…
            </span>
          </div>
          <div className="space-y-1" role="list" aria-label="Agent status">
            {agentSteps.map((step) => (
              <div key={step.key} className="flex items-center gap-2" role="listitem">
                {step.status === "running" ? (
                  <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
                ) : step.status === "done" ? (
                  <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "text-2xs",
                    step.status === "running"
                      ? "text-brand-600 dark:text-brand-400 font-medium"
                      : step.status === "done"
                        ? "text-green-600 dark:text-green-400"
                        : "text-surface-400 dark:text-surface-500"
                  )}
                >
                  {step.label}
                  {step.status === "running" && "…"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-2" aria-label="AI alerts">
        {visibleAlerts.map((alert, idx) => (
          <li
            key={idx}
            className={cn(
              "alert-slide rounded-lg border p-2.5 relative",
              alertStyle(alert.type)
            )}
          >
            {alert.type !== "agent_thinking" && (
              <button
                onClick={() => dismissAlert(alerts.indexOf(alert))}
                className="absolute top-1.5 right-1.5 text-surface-400 hover:text-surface-600 transition-colors"
                aria-label="Dismiss alert"
              >
                <X size={10} />
              </button>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              {alertIcon(alert.type)}
              <span className="text-2xs font-semibold">{alertTitle(alert)}</span>
            </div>

            {alert.type === "coding_audit" &&
            (alert.segment_text || alert.data?.segment_text) ? (
              <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3 pr-4">
                &ldquo;{String(alert.segment_text || alert.data?.segment_text)}&rdquo;
              </blockquote>
            ) : (
              <p className="text-2xs text-surface-600 dark:text-surface-300 line-clamp-4 pr-4">
                {alertBody(alert)}
              </p>
            )}

            {alert.type === "coding_audit" && (
              <CodingAuditDetail
                alert={alert}
                alertIdx={alerts.indexOf(alert)}
                codes={codes}
                applySuggestedCode={applySuggestedCode}
                keepMyCode={keepMyCode}
              />
            )}

            {alert.type === "ghost_partner" && alert.is_conflict && (
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => keepMyCode(alerts.indexOf(alert))}
                  className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                >
                  Keep my code
                </button>
                {alert.data?.predicted_code &&
                codes.some(
                  (c) => c.label === (alert.data.predicted_code as string)
                ) ? (
                  <button
                    onClick={() =>
                      applySuggestedCode(
                        alert.segment_id!,
                        alert.data.predicted_code as string,
                        alerts.indexOf(alert)
                      )
                    }
                    className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    Apply &ldquo;{String(alert.data.predicted_code)}&rdquo;
                  </button>
                ) : alert.data?.predicted_code ? (
                  <button
                    onClick={() => dismissAlert(alerts.indexOf(alert))}
                    className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    title="This code doesn't exist in your codebook yet"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            )}

            {alert.type === "consistency" &&
              Array.isArray(alert.data?.alternative_codes) &&
              (alert.data.alternative_codes as string[]).length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-2xs text-surface-500 dark:text-surface-400 font-medium">
                    Suggested alternatives:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(alert.data.alternative_codes as string[])
                      .filter((ac) => codes.some((c) => c.label === ac))
                      .map((ac) => (
                        <button
                          key={ac}
                          onClick={() =>
                            applySuggestedCode(
                              alert.segment_id!,
                              ac,
                              alerts.indexOf(alert)
                            )
                          }
                          className="rounded px-2 py-0.5 text-2xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          Apply &ldquo;{ac}&rdquo;
                        </button>
                      ))}
                    <button
                      onClick={() => keepMyCode(alerts.indexOf(alert))}
                      className="rounded px-2 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                    >
                      Keep current
                    </button>
                  </div>
                </div>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}
