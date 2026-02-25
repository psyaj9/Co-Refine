import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  Loader2,
  AlertCircle,
  BookOpen,
  ScanSearch,
} from "lucide-react";
import { AGENT_LABELS } from "@/lib/constants";
import type { AlertPayload } from "@/types";

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
      return `${baseLabel}${consistentFlag}${conflictFlag}`;
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
    default:
      return "Agent Alert";
  }
}

/** Body description for a given alert */
export function alertBody(alert: AlertPayload): string {
  const data = alert.data || {};
  if (alert.type === "coding_audit") {
    const self = data.self_lens as Record<string, unknown> | undefined;
    const inter = data.inter_rater_lens as Record<string, unknown> | undefined;
    const selfText =
      (self?.suggestion as string) || (self?.reasoning as string) || "";
    const interText = inter?.is_conflict
      ? (inter?.conflict_explanation as string) || ""
      : "";
    return (
      [selfText, interText].filter(Boolean).join(" \u2022 ") ||
      "See details below."
    );
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
  return JSON.stringify(data).slice(0, 200);
}
