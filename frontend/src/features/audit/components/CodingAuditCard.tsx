import { Lightbulb } from "lucide-react";
import { alertBody } from "@/shared/lib/alert-helpers";
import MetricStrip from "@/features/audit/components/MetricStrip";
import CodingAuditDetail from "@/features/audit/components/CodingAuditDetail";
import type { AlertPayload, CodeOut } from "@/shared/types";

interface CodingAuditCardProps {
  alert: AlertPayload;
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
}

/**
 * Body content for a `coding_audit` alert card.
 * Renders: segment quote → headline → finding → drift warning → action → metrics → expandable detail.
 */
export default function CodingAuditCard({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
}: CodingAuditCardProps) {
  const segmentText = alert.segment_text || (alert.data?.segment_text as string | undefined);
  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;

  // Structured fields — new names with fallbacks to old field names for backwards compat
  const headline = (selfLens?.headline as string) || alertBody(alert);
  const finding = (selfLens?.finding as string) || (selfLens?.reasoning as string) || "";
  const driftWarning = (selfLens?.drift_warning as string) || "";
  const action = (selfLens?.action as string) || (selfLens?.suggestion as string) || "";

  return (
    <div className="mt-2 space-y-1.5">
      {segmentText && (
        <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3 pr-4">
          &ldquo;{segmentText}&rdquo;
        </blockquote>
      )}

      {/* Headline — bold verdict */}
      <p className="text-2xs font-semibold text-surface-800 dark:text-surface-100 leading-snug">
        {headline}
      </p>

      {/* Finding — plain-language explanation, 1–2 sentences */}
      {finding && (
        <p className="text-2xs text-surface-600 dark:text-surface-300 leading-relaxed">
          {finding}
        </p>
      )}

      {/* Drift warning — only shown when the LLM detected a meaningful shift */}
      {driftWarning && (
        <p className="text-2xs text-amber-600 dark:text-amber-400 italic">
          {driftWarning}
        </p>
      )}

      {/* Action — highlighted recommendation box */}
      {action && (
        <div className="flex items-start gap-1.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5">
          <Lightbulb size={10} className="text-indigo-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-2xs text-indigo-700 dark:text-indigo-300 leading-snug">{action}</p>
        </div>
      )}

      <MetricStrip alert={alert} />
      <CodingAuditDetail
        alert={alert}
        alertIdx={alertIdx}
        codes={codes}
        applySuggestedCode={applySuggestedCode}
        keepMyCode={keepMyCode}
      />
    </div>
  );
}
