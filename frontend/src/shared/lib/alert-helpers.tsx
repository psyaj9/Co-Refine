import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  Loader2,
  AlertCircle,
  BookOpen,
  ScanSearch,
  TrendingUp,
} from "lucide-react";
import { AGENT_LABELS } from "@/shared/lib/constants";
import type { AlertPayload } from "@/shared/types";

/** Border + background class string for a given alert type */
export function alertStyle(type: string): string {
  const styles: Record<string, string> = {
    coding_audit:
      "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10",
    consistency:
      "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10",
    ghost_partner:
      "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10",
    agent_thinking:
      "border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-900/5 animate-pulse-subtle",
    agent_error:
      "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10",
    analysis_updated:
      "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10",
    temporal_drift_warning:
      "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10",
  };
  return (
    styles[type] ||
    "border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
  );
}

/** Icon element for a given alert type */
export function alertIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    coding_audit: <ScanSearch size={12} className="text-indigo-500" />,
    consistency: <AlertTriangle size={12} className="text-amber-500" />,
    ghost_partner: <Ghost size={12} className="text-purple-500" />,
    agent_thinking: (
      <Loader2 size={12} className="text-brand-400 animate-spin" />
    ),
    agent_error: <AlertCircle size={12} className="text-red-500" />,
    analysis_updated: <BookOpen size={12} className="text-green-600" />,
    temporal_drift_warning: <TrendingUp size={12} className="text-orange-500" />,
  };
  return icons[type] || <CheckCircle2 size={12} className="text-surface-500" />;
}

/** Title string for a given alert */
export function alertTitle(alert: AlertPayload): string {
  switch (alert.type) {
    case "coding_audit": {
      const selfLens = alert.data?.self_lens as
        | Record<string, unknown>
        | undefined;
      const interLens = alert.data?.inter_rater_lens as
        | Record<string, unknown>
        | undefined;
      const baseLabel = alert.code_label || "Audit";
      const consistentFlag =
        selfLens?.is_consistent === false ? " (drift)" : "";
      const conflictFlag = interLens?.is_conflict ? " (conflict)" : "";
      // Include top predicted code in title for quick scanning
      const predictedCodes = interLens?.predicted_codes as Array<Record<string, unknown>> | undefined;
      const topPredicted = predictedCodes?.[0]?.code as string | undefined
        || interLens?.predicted_code as string | undefined;
      const predictedSuffix = interLens?.is_conflict && topPredicted
        ? ` \u2192 ${topPredicted}`
        : "";
      return `${baseLabel}${consistentFlag}${conflictFlag}${predictedSuffix}`;
    }
    case "consistency":
      return alert.is_consistent === false
        ? "Drift Detected"
        : "Consistent";
    case "ghost_partner":
      return alert.is_conflict
        ? "Conflict"
        : "Agrees";
    case "agent_thinking": {
      const label =
        AGENT_LABELS[alert.agent ?? ""] || alert.agent || "Agent";
      return `${label}...`;
    }
    case "agent_error": {
      const label =
        AGENT_LABELS[alert.agent ?? ""] || alert.agent || "Agent";
      return `${label} failed`;
    }
    case "analysis_updated":
      return alert.code_label || "Definition updated";
    case "temporal_drift_warning":
      return `${alert.code_label || "Code"} — Semantic Drift`;
    default:
      return "Agent Alert";
  }
}

/** Body description for a given alert */
export function alertBody(alert: AlertPayload): string {
  const data = alert.data || {};
  if (alert.type === "coding_audit") {
    const self = data.self_lens as Record<string, unknown> | undefined;
    const isConsistent = self?.is_consistent !== false;

    return self?.headline as string
      || (isConsistent
        ? "Your coding is consistent with your past decisions."
        : "This coding decision is inconsistent with your past decisions.");
  }
  if (alert.type === "consistency")
    return (
      (data.suggestion as string) ||
      (data.reasoning as string) ||
      (data.drift_warning as string) ||
      "No details available"
    );
  if (alert.type === "ghost_partner")
    return (
      (data.conflict_explanation as string) ||
      (data.reasoning as string) ||
      "No details available"
    );
  if (alert.type === "agent_thinking") {
    const label =
      AGENT_LABELS[alert.agent ?? ""] || alert.agent || "Agent";
    return `${label} is reviewing your coding decision...`;
  }
  if (alert.type === "agent_error")
    return (data.message as string) || "An error occurred while processing.";
  if (alert.type === "analysis_updated")
    return (data.definition as string) || "Definition updated";
  if (alert.type === "temporal_drift_warning")
    return (
      (data.message as string) ||
      "The meaning of this code appears to have shifted over time. Review early vs. recent uses."
    );
  return JSON.stringify(data).slice(0, 200);
}

/** Build enriched metrics summary for coding audit alerts */
export function alertMetrics(alert: AlertPayload): {
  centroidSimilarity: number | null;
  temporalDrift: number | null;
  severity: string | null;
  severityScore: number | null;
  wasEscalated: boolean;
  escalationReason: string | null;
  isPseudoCentroid: boolean;
  segmentCount: number | null;
} {
  const scores = alert.deterministic_scores;
  const escalation = alert.escalation;
  const data = alert.data || {};

  return {
    centroidSimilarity: scores?.centroid_similarity ?? null,
    temporalDrift: scores?.temporal_drift ?? null,
    severity: (data.overall_severity as string) ?? null,
    severityScore: (data.overall_severity_score as number) ?? null,
    wasEscalated: escalation?.was_escalated ?? false,
    escalationReason: escalation?.reason ?? null,
    isPseudoCentroid: scores?.is_pseudo_centroid ?? false,
    segmentCount: scores?.segment_count ?? null,
  };
}
