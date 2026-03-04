import {
  CheckCircle2,
  Loader2,
  X,
  Zap,
  Brain,
  ShieldAlert,
  TrendingUp,
  AlertTriangle as AlertTriangleIcon,
  RotateCw,
} from "lucide-react";
import { useStore } from "@/stores/store";
import { cn } from "@/lib/utils";
import { AGENT_LABELS, METRIC_EXPLANATIONS } from "@/lib/constants";
import { alertStyle, alertIcon, alertTitle, alertBody, alertMetrics } from "@/lib/alert-helpers";
import MetricTooltip from "@/components/MetricTooltip";
import CodingAuditDetail from "@/components/CodingAuditDetail";

const STAGES = [
  { key: 1, label: "Embedding Analysis", Icon: Zap, description: "Computing semantic similarity & codebook distribution" },
  { key: 2, label: "LLM Audit", Icon: Brain, description: "Self-consistency & inter-rater review",
    substages: [
      { key: "initial", label: "Initial Judgment", description: "First-pass audit with LLM" },
      { key: "reflected", label: "Reflection", description: "Second-pass self-review with fresh examples" },
    ] },
  { key: 3, label: "Escalation Review", Icon: ShieldAlert, description: "Re-evaluating with stronger model" },
] as const;

function SeverityBadge({ severity, score }: { severity: string | null; score: number | null }) {
  if (!severity) return null;
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const explanationKey = `severity_${severity}` as keyof typeof METRIC_EXPLANATIONS;
  const explanation = METRIC_EXPLANATIONS[explanationKey] || "";
  return (
    <MetricTooltip explanation={explanation}>
      <span className={cn("text-2xs px-1.5 py-0.5 rounded font-medium", colors[severity] || colors.low)}>
        {severity}{score != null ? ` (${score.toFixed(2)})` : ""}
      </span>
    </MetricTooltip>
  );
}

export default function AlertsTab(): React.ReactElement {
  const alerts = useStore((s) => s.alerts);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const auditStage = useStore((s) => s.auditStage);
  const dismissAlert = useStore((s) => s.dismissAlert);
  const applySuggestedCode = useStore((s) => s.applySuggestedCode);
  const keepMyCode = useStore((s) => s.keepMyCode);
  const codes = useStore((s) => s.codes);

  const visibleAlerts = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done" && a.type !== "deterministic_scores"
  );

  // Analysis agent status (derived from alerts, separate from 3-stage pipeline)
  const analysisStatus: "pending" | "running" | "done" = alerts.some(
    (a) => a.type === "analysis_updated" || (a.type === "agent_error" && (a as unknown as Record<string, unknown>).agent === "analysis")
  )
    ? "done"
    : alerts.some((a) => a.type === "agent_thinking" && a.agent === "analysis")
      ? "running"
      : "pending";

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
              Coding Audit Pipeline
            </span>
            <span className="text-2xs text-surface-400 dark:text-surface-500 ml-auto">
              Stage {auditStage.current}/3
            </span>
          </div>

          {/* 3-Stage Progress Bar (Stage 2 split into sub-stages) */}
          <div className="flex gap-0.5 mb-2" role="progressbar" aria-valuenow={auditStage.current} aria-valuemin={0} aria-valuemax={3} aria-label="Audit pipeline progress">
            {STAGES.map((stage) => {
              const isActive = auditStage.current === stage.key;
              const isDone = auditStage.current > stage.key;
              // Stage 3 only lights up if escalation was triggered
              const isHidden = stage.key === 3 && !auditStage.escalation?.was_escalated && auditStage.current < 3;
              if (isHidden) return null;

              // Stage 2 gets split into two sub-bars
              if (stage.key === 2 && "substages" in stage) {
                return stage.substages.map((sub) => {
                  const subDone = isDone || (isActive && (
                    sub.key === "initial" ? (auditStage.substage === "reflecting" || auditStage.substage === "reflected") :
                    sub.key === "reflected" ? auditStage.substage === "reflected" : false
                  ));
                  const subActive = isActive && !subDone && (
                    sub.key === "initial" ? auditStage.substage === "initial" :
                    sub.key === "reflected" ? auditStage.substage === "reflecting" : false
                  );
                  return (
                    <div
                      key={`2-${sub.key}`}
                      className={cn(
                        "h-1.5 rounded-full flex-1 transition-all duration-500",
                        subDone
                          ? "bg-green-500"
                          : subActive
                            ? "bg-brand-500 animate-pulse"
                            : "bg-surface-200 dark:bg-surface-700"
                      )}
                    />
                  );
                });
              }

              return (
                <div
                  key={stage.key}
                  className={cn(
                    "h-1.5 rounded-full flex-1 transition-all duration-500",
                    isDone
                      ? "bg-green-500"
                      : isActive
                        ? "bg-brand-500 animate-pulse"
                        : "bg-surface-200 dark:bg-surface-700"
                  )}
                />
              );
            })}
          </div>

          {/* Stage Details */}
          <div className="space-y-1" role="list" aria-label="Pipeline stages">
            {STAGES.map((stage) => {
              const isActive = auditStage.current === stage.key;
              const isDone = auditStage.current > stage.key;
              const isHidden = stage.key === 3 && !auditStage.escalation?.was_escalated && auditStage.current < 3;
              if (isHidden) return null;
              const StageIcon = stage.Icon;

              // Stage 2: show sub-stages instead of single line
              if (stage.key === 2 && "substages" in stage && isActive) {
                return (
                  <div key={stage.key} className="space-y-0.5">
                    <div className="flex items-center gap-2" role="listitem">
                      <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
                      <StageIcon size={9} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      <span className="text-2xs text-brand-600 dark:text-brand-400 font-medium">
                        {stage.label}…
                      </span>
                    </div>
                    <div className="ml-5 space-y-0.5">
                      {stage.substages.map((sub) => {
                        const subDone = sub.key === "initial"
                          ? (auditStage.substage === "reflecting" || auditStage.substage === "reflected")
                          : auditStage.substage === "reflected";
                        const subActive = !subDone && (
                          sub.key === "initial" ? auditStage.substage === "initial" :
                          sub.key === "reflected" ? auditStage.substage === "reflecting" : false
                        );
                        return (
                          <div key={sub.key} className="flex items-center gap-1.5">
                            {subDone ? (
                              <CheckCircle2 size={8} className="text-green-500 flex-shrink-0" aria-hidden="true" />
                            ) : subActive ? (
                              <Loader2 size={8} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
                            ) : (
                              <span className="w-2 h-2 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
                            )}
                            {sub.key === "reflected" && <RotateCw size={7} className={cn(subActive ? "text-brand-500" : subDone ? "text-green-500" : "text-surface-400")} aria-hidden="true" />}
                            <span className={cn(
                              "text-[10px]",
                              subActive ? "text-brand-600 dark:text-brand-400 font-medium" : subDone ? "text-green-600 dark:text-green-400" : "text-surface-400 dark:text-surface-500"
                            )}>
                              {sub.label}{subActive ? "…" : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Reflection score delta summary */}
                    {auditStage.reflection?.was_reflected && (
                      <div className="ml-5 mt-0.5 rounded border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 px-1.5 py-0.5">
                        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">Reflection delta: </span>
                        <span className="text-[9px] text-surface-500 dark:text-surface-400">
                          consistency {auditStage.reflection.score_delta.consistency_score >= 0 ? "+" : ""}{auditStage.reflection.score_delta.consistency_score.toFixed(2)},
                          {" "}intent {auditStage.reflection.score_delta.intent_alignment_score >= 0 ? "+" : ""}{auditStage.reflection.score_delta.intent_alignment_score.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={stage.key} className="flex items-center gap-2" role="listitem">
                  {isDone ? (
                    <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" aria-hidden="true" />
                  ) : isActive ? (
                    <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
                  )}
                  <StageIcon size={9} className={cn(
                    isActive ? "text-brand-600 dark:text-brand-400" : isDone ? "text-green-600 dark:text-green-400" : "text-surface-400"
                  )} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-2xs",
                      isActive ? "text-brand-600 dark:text-brand-400 font-medium" : isDone ? "text-green-600 dark:text-green-400" : "text-surface-400 dark:text-surface-500"
                    )}>
                      {stage.label}
                      {isActive && "…"}
                    </span>
                    {isActive && (
                      <p className="text-[9px] text-surface-400 dark:text-surface-500 leading-tight">{stage.description}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Inductive Analysis (separate from 3-stage pipeline) */}
            <div className="flex items-center gap-2" role="listitem">
              {analysisStatus === "done" ? (
                <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" aria-hidden="true" />
              ) : analysisStatus === "running" ? (
                <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
              )}
              <span className={cn(
                "text-2xs",
                analysisStatus === "running" ? "text-brand-600 dark:text-brand-400 font-medium" : analysisStatus === "done" ? "text-green-600 dark:text-green-400" : "text-surface-400 dark:text-surface-500"
              )}>
                {AGENT_LABELS.analysis}
                {analysisStatus === "running" && "…"}
              </span>
            </div>
          </div>

          {/* Confidence Summary Card */}
          {auditStage.confidence && (auditStage.confidence.centroid_similarity != null || auditStage.confidence.consistency_score != null) && (
            <div className="mt-2 rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5">
              <span className="text-2xs font-semibold text-surface-500 dark:text-surface-400">Confidence Metrics</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                {auditStage.confidence.centroid_similarity != null && (
                  <MetricTooltip explanation={METRIC_EXPLANATIONS.similarity}>
                    <div className="flex items-center gap-1">
                      <TrendingUp size={8} className="text-surface-400" aria-hidden="true" />
                      <span className="text-2xs text-surface-500 dark:text-surface-400">Similarity:</span>
                      <span className="text-2xs font-medium text-surface-700 dark:text-surface-200">{auditStage.confidence.centroid_similarity.toFixed(3)}</span>
                    </div>
                  </MetricTooltip>
                )}
                {auditStage.confidence.consistency_score != null && (
                  <MetricTooltip explanation={METRIC_EXPLANATIONS.consistency}>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={8} className="text-surface-400" aria-hidden="true" />
                      <span className="text-2xs text-surface-500 dark:text-surface-400">Consistency:</span>
                      <span className="text-2xs font-medium text-surface-700 dark:text-surface-200">{auditStage.confidence.consistency_score.toFixed(2)}</span>
                    </div>
                  </MetricTooltip>
                )}
              </div>
              {auditStage.confidence.overall_severity && (
                <div className="mt-1">
                  <SeverityBadge severity={auditStage.confidence.overall_severity} score={auditStage.confidence.overall_severity_score} />
                </div>
              )}
              {auditStage.escalation?.was_escalated && (
                <MetricTooltip explanation={METRIC_EXPLANATIONS.escalation}>
                  <div className="mt-1 flex items-center gap-1">
                    <AlertTriangleIcon size={8} className="text-amber-500" aria-hidden="true" />
                    <span className="text-2xs text-amber-600 dark:text-amber-400 italic">
                      Escalated: {auditStage.escalation.reason || "stage divergence detected"}
                    </span>
                  </div>
                </MetricTooltip>
              )}
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2" aria-label="AI alerts">
        {visibleAlerts.map((alert, idx) => (
          <li
            key={`${alert.type}-${alert.segment_id ?? idx}`}
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
              <div className="mt-2 space-y-1">
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {alertBody(alert)}
                </p>
                {/* Enriched metrics strip */}
                {(() => {
                  const m = alertMetrics(alert);
                  const hasMetrics = m.centroidSimilarity != null || m.entropy != null || m.severity != null;
                  if (!hasMetrics) return null;
                  return (
                    <div className="mt-1.5 rounded border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10 px-2 py-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {m.centroidSimilarity != null && (
                          <MetricTooltip explanation={METRIC_EXPLANATIONS.similarity}>
                            <span className="text-[9px] text-surface-500 dark:text-surface-400">
                              Similarity: <span className="font-medium text-surface-700 dark:text-surface-200">{m.centroidSimilarity.toFixed(3)}</span>
                            </span>
                          </MetricTooltip>
                        )}
                        {m.entropy != null && (
                          <MetricTooltip explanation={METRIC_EXPLANATIONS.entropy}>
                            <span className="text-[9px] text-surface-500 dark:text-surface-400">
                              Entropy: <span className={cn("font-medium", m.entropy > 0.6 ? "text-amber-600 dark:text-amber-400" : "text-surface-700 dark:text-surface-200")}>{m.entropy.toFixed(3)}</span>
                              {m.entropy > 0.6 && <span className="text-amber-500 ml-0.5">⚠</span>}
                            </span>
                          </MetricTooltip>
                        )}
                        {m.temporalDrift != null && m.temporalDrift > 0.3 && (
                          <MetricTooltip explanation={METRIC_EXPLANATIONS.drift}>
                            <span className="text-[9px] text-amber-600 dark:text-amber-400">
                              Drift: <span className="font-medium">{m.temporalDrift.toFixed(3)}</span> ⚠
                            </span>
                          </MetricTooltip>
                        )}
                        {m.isPseudoCentroid && (
                          <MetricTooltip explanation={METRIC_EXPLANATIONS.pseudo_centroid}>
                            <span className="text-[9px] text-surface-400 italic">pseudo-centroid</span>
                          </MetricTooltip>
                        )}
                        {m.segmentCount != null && m.segmentCount < 3 && (
                          <MetricTooltip explanation={METRIC_EXPLANATIONS.sparse_data}>
                            <span className="text-[9px] text-surface-400 italic">sparse ({m.segmentCount} seg{m.segmentCount !== 1 ? "s" : ""})</span>
                          </MetricTooltip>
                        )}
                      </div>
                      {m.severity && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={cn(
                            "text-[9px] px-1 py-0 rounded font-medium",
                            m.severity === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            m.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          )}>
                            {m.severity}
                          </span>
                          {m.wasEscalated && (
                            <MetricTooltip explanation={METRIC_EXPLANATIONS.escalation}>
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 italic flex items-center gap-0.5">
                                <ShieldAlert size={7} aria-hidden="true" />
                                escalated{m.escalationReason ? `: ${m.escalationReason}` : ""}
                              </span>
                            </MetricTooltip>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <CodingAuditDetail
                  alert={alert}
                  alertIdx={alerts.indexOf(alert)}
                  codes={codes}
                  applySuggestedCode={applySuggestedCode}
                  keepMyCode={keepMyCode}
                />
              </div>
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
