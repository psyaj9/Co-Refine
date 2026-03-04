import { alertBody } from "@/lib/alert-helpers";
import MetricStrip from "@/features/audit/components/MetricStrip";
import CodingAuditDetail from "@/features/audit/components/CodingAuditDetail";
import type { AlertPayload, CodeOut } from "@/types";

interface CodingAuditCardProps {
  alert: AlertPayload;
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
}

/**
 * Body content rendered inside the alert card when `alert.type === "coding_audit"`.
 * Owns: segment blockquote, body text, metric strip, and the expandable detail sections.
 */
export default function CodingAuditCard({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
}: CodingAuditCardProps) {
  const segmentText = alert.segment_text || (alert.data?.segment_text as string | undefined);

  return (
    <div className="mt-2 space-y-1">
      {segmentText && (
        <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3 pr-4">
          &ldquo;{segmentText}&rdquo;
        </blockquote>
      )}
      <p className="text-2xs text-surface-600 dark:text-surface-300">{alertBody(alert)}</p>
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
