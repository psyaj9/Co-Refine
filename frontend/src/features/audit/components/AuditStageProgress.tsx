import {
  CheckCircle2,
  Loader2,
  Zap,
  Brain,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_LABELS, METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/features/audit/components/MetricTooltip";
import SeverityBadge from "@/features/audit/components/SeverityBadge";
import type { AuditStage } from "@/shared/store/slices/auditSlice";

const STAGES = [
  {
    key: 1,
    label: "Embedding Analysis",
    Icon: Zap,
    description: "Computing semantic similarity & temporal drift",
  },
  {
    key: 2,
    label: "Reasoning Audit",
    Icon: Brain,
    description: "Deep self-consistency analysis",
  },
] as const;

interface AuditStageProgressProps {
  auditStage: AuditStage;
  analysisStatus: "pending" | "running" | "done";
}

export default function AuditStageProgress({ auditStage, analysisStatus }: AuditStageProgressProps) {
  return (
    <div className="mb-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={12} className="text-brand-500 animate-spin" aria-hidden="true" />
        <span className="text-2xs font-semibold text-brand-700 dark:text-brand-300">
          Coding Audit Pipeline
        </span>
        <span className="text-2xs text-surface-400 dark:text-surface-500 ml-auto">
          Stage {auditStage.current}/2
        </span>
      </div>

      {/* Progress bars */}
      <div
        className="flex gap-0.5 mb-2"
        role="progressbar"
        aria-valuenow={auditStage.current}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-label="Audit pipeline progress"
      >
        {STAGES.map((stage) => {
          const isActive = auditStage.current === stage.key;
          const isDone = auditStage.current > stage.key;

          return (
            <div
              key={stage.key}
              className={cn(
                "h-1.5 rounded-full flex-1 transition-all duration-500",
                isDone
                  ? "bg-green-500"
                  : isActive
                    ? "bg-brand-500 animate-pulse"
                    : "bg-surface-200 dark:bg-surface-700",
              )}
            />
          );
        })}
      </div>

      {/* Stage detail list */}
      <div className="space-y-1" role="list" aria-label="Pipeline stages">
        {STAGES.map((stage) => {
          const isActive = auditStage.current === stage.key;
          const isDone = auditStage.current > stage.key;
          const StageIcon = stage.Icon;

          return (
            <div key={stage.key} className="flex items-center gap-2" role="listitem">
              {isDone ? (
                <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" aria-hidden="true" />
              ) : isActive ? (
                <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
              )}
              <StageIcon
                size={9}
                className={cn(
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : isDone
                      ? "text-green-600 dark:text-green-400"
                      : "text-surface-400",
                )}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-2xs",
                    isActive
                      ? "text-brand-600 dark:text-brand-400 font-medium"
                      : isDone
                        ? "text-green-600 dark:text-green-400"
                        : "text-surface-400 dark:text-surface-500",
                  )}
                >
                  {stage.label}
                  {isActive && "…"}
                </span>
                {isActive && (
                  <p className="text-[9px] text-surface-400 dark:text-surface-500 leading-tight">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Inductive Analysis row (runs parallel to the 3-stage pipeline) */}
        <div className="flex items-center gap-2" role="listitem">
          {analysisStatus === "done" ? (
            <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" aria-hidden="true" />
          ) : analysisStatus === "running" ? (
            <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" aria-hidden="true" />
          )}
          <span
            className={cn(
              "text-2xs",
              analysisStatus === "running"
                ? "text-brand-600 dark:text-brand-400 font-medium"
                : analysisStatus === "done"
                  ? "text-green-600 dark:text-green-400"
                  : "text-surface-400 dark:text-surface-500",
            )}
          >
            {AGENT_LABELS.analysis}
            {analysisStatus === "running" && "…"}
          </span>
        </div>
      </div>

      {/* Confidence summary card */}
      {auditStage.confidence &&
        (auditStage.confidence.centroid_similarity != null ||
          auditStage.confidence.consistency_score != null) && (
          <div className="mt-2 rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5">
            <span className="text-2xs font-semibold text-surface-500 dark:text-surface-400">
              Confidence Metrics
            </span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              {auditStage.confidence.centroid_similarity != null && (
                <MetricTooltip explanation={METRIC_EXPLANATIONS.similarity}>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={8} className="text-surface-400" aria-hidden="true" />
                    <span className="text-2xs text-surface-500 dark:text-surface-400">Similarity:</span>
                    <span className="text-2xs font-medium text-surface-700 dark:text-surface-200">
                      {auditStage.confidence.centroid_similarity.toFixed(3)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
              {auditStage.confidence.consistency_score != null && (
                <MetricTooltip explanation={METRIC_EXPLANATIONS.consistency}>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={8} className="text-surface-400" aria-hidden="true" />
                    <span className="text-2xs text-surface-500 dark:text-surface-400">Consistency:</span>
                    <span className="text-2xs font-medium text-surface-700 dark:text-surface-200">
                      {auditStage.confidence.consistency_score.toFixed(2)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
            </div>
            {auditStage.confidence.overall_severity && (
              <div className="mt-1">
                <SeverityBadge
                  severity={auditStage.confidence.overall_severity}
                  score={auditStage.confidence.overall_severity_score}
                />
              </div>
            )}
          </div>
        )}
    </div>
  );
}
