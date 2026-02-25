import { useState } from "react";
import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertPayload, CodeOut } from "@/types";

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
  const [interOpen, setInterOpen] = useState(false);

  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;
  const interLens = alert.data?.inter_rater_lens as Record<string, unknown> | undefined;
  if (!selfLens && !interLens) return null;

  const altCodes: string[] = Array.isArray(selfLens?.alternative_codes)
    ? (selfLens.alternative_codes as string[]).filter((c) =>
        codes.some((code) => code.label === c)
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
            <span className="text-2xs font-semibold flex-1 text-left">Self-Consistency</span>
            <span
              className={cn(
                "text-2xs px-1 rounded",
                selfLens.is_consistent ? "text-green-600" : "text-amber-600"
              )}
            >
              {(selfLens.consistency_score as string) || "–"}
            </span>
            {selfOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
          </button>
          {selfOpen && (
            <div className="px-2 py-1.5 space-y-1 tab-content-enter">
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

      {interLens && (
        <div className="rounded border border-purple-200 dark:border-purple-800 overflow-hidden">
          <button
            onClick={() => setInterOpen(!interOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 transition-colors"
            aria-expanded={interOpen}
            aria-label="Toggle inter-rater details"
          >
            <Users size={9} aria-hidden="true" />
            <span className="text-2xs font-semibold flex-1 text-left">Inter-Rater</span>
            <span
              className={cn(
                "text-2xs px-1 rounded",
                interLens.is_conflict ? "text-red-600" : "text-green-600"
              )}
            >
              {interLens.is_conflict ? "conflict" : "agrees"}
            </span>
            {interOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
          </button>
          {interOpen && (
            <div className="px-2 py-1.5 space-y-1 tab-content-enter">
              {interLens.predicted_code ? (
                <p className="text-2xs text-surface-500 dark:text-surface-400">
                  Predicted:{" "}
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    &ldquo;{String(interLens.predicted_code)}&rdquo;
                  </span>
                </p>
              ) : null}
              {interLens.conflict_explanation ? (
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {String(interLens.conflict_explanation)}
                </p>
              ) : null}
              {interLens.is_conflict &&
                interLens.predicted_code &&
                codes.some(
                  (c) => c.label === interLens.predicted_code
                ) ? (
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => keepMyCode(alertIdx)}
                      className="flex-1 rounded px-1.5 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
                    >
                      Keep mine
                    </button>
                    <button
                      onClick={() =>
                        applySuggestedCode(
                          alert.segment_id!,
                          interLens.predicted_code as string,
                          alertIdx
                        )
                      }
                      className="flex-1 rounded px-1.5 py-0.5 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 transition-colors"
                    >
                      Apply &ldquo;{String(interLens.predicted_code)}&rdquo;
                    </button>
                  </div>
                ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
