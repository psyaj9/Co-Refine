import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/components/MetricTooltip";
import type { AlertPayload, CodeOut } from "@/types";
import { useStore } from "@/stores/store";

interface CodingAuditDetailProps {
  alert: AlertPayload;
  alertIdx: number;
  codes: CodeOut[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
}

export default function CodingAuditDetail({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
}: CodingAuditDetailProps): React.ReactElement | null {
  const [selfOpen, setSelfOpen] = useState(false);

  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;
  if (!selfLens) return null;

  // Display-time safety filter: exclude codes already applied to the same span
  const segments = useStore((s) => s.segments);
  const coAppliedLabels = useMemo(() => {
    if (!alert.segment_id) return new Set<string>();
    // Find the segment this audit is about
    const thisSeg = segments.find((s) => s.id === alert.segment_id);
    if (!thisSeg) return new Set<string>();
    // Find all codes on overlapping spans (including this segment's own code)
    const labels = new Set<string>();
    for (const seg of segments) {
      if (
        seg.document_id === thisSeg.document_id &&
        seg.start_index < thisSeg.end_index &&
        seg.end_index > thisSeg.start_index
      ) {
        labels.add(seg.code_label);
      }
    }
    return labels;
  }, [segments, alert.segment_id]);

  const altCodes: string[] = Array.isArray(selfLens?.alternative_codes)
    ? (selfLens.alternative_codes as string[]).filter(
        (c) => codes.some((code) => code.label === c) && !coAppliedLabels.has(c)
      )
    : [];

  return (
    <div className="mt-2 space-y-1.5">
      {selfLens && (
        <div className="rounded border border-amber-200 dark:border-amber-800 overflow-hidden">
          <button
            onClick={() => setSelfOpen(!selfOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 transition-colors"
            aria-expanded={selfOpen}
            aria-label="Toggle self-consistency details"
          >
            <ShieldCheck size={9} aria-hidden="true" />
            <MetricTooltip explanation={METRIC_EXPLANATIONS.self_consistency_lens}>
              <span className="text-2xs font-semibold flex-1 text-left">Self-Consistency</span>
            </MetricTooltip>
            <MetricTooltip explanation={METRIC_EXPLANATIONS.consistency}>
              <span
                className={cn(
                  "text-2xs px-1 rounded",
                  selfLens.is_consistent ? "text-green-600" : "text-amber-600"
                )}
              >
                {(selfLens.consistency_score as string) || "–"}
              </span>
            </MetricTooltip>
            {selfOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
          </button>
          {selfOpen && (
            <div className="px-2 py-1.5 space-y-1 tab-content-enter">
              <p className="text-[10px] text-surface-400 dark:text-surface-500 italic mb-1">
                This checks if you’re applying this code the same way you have before.
              </p>
              {selfLens.suggestion ? (
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {String(selfLens.suggestion)}
                </p>
              ) : null}
              {selfLens.drift_warning ? (
                <p className="text-2xs text-amber-600 dark:text-amber-400 italic">
                  {String(selfLens.drift_warning)}
                </p>
              ) : null}
              {altCodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {altCodes.map((ac) => (
                    <button
                      key={ac}
                      onClick={() =>
                        applySuggestedCode(alert.segment_id!, ac, alertIdx)
                      }
                      className="rounded px-1.5 py-0.5 text-2xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors"
                    >
                      Apply &ldquo;{ac}&rdquo;
                    </button>
                  ))}
                  <button
                    onClick={() => keepMyCode(alertIdx)}
                    className="rounded px-1.5 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
                  >
                    Keep current
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
