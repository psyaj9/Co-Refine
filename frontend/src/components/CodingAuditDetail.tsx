import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  // Users,  // inter-rater disabled for now
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
  // const [interOpen, setInterOpen] = useState(false);  // inter-rater disabled for now

  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;
  // const interLens = alert.data?.inter_rater_lens as Record<string, unknown> | undefined;
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

      {/* Inter-Rater lens — commented out for now
      {interLens && (
        <div className="rounded border border-purple-200 dark:border-purple-800 overflow-hidden">
          <button
            onClick={() => setInterOpen(!interOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 transition-colors"
            aria-expanded={interOpen}
            aria-label="Toggle inter-rater details"
          >
            <Users size={9} aria-hidden="true" />
            <MetricTooltip explanation={METRIC_EXPLANATIONS.inter_rater_lens}>
              <span className="text-2xs font-semibold flex-1 text-left">Inter-Rater</span>
            </MetricTooltip>
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
              <p className="text-[10px] text-surface-400 dark:text-surface-500 italic mb-1">
                This simulates what another researcher might code this segment as.
              </p>

              {(() => {
                const rawPredictedCodes = interLens.predicted_codes as Array<Record<string, unknown>> | undefined;
                const predictedCodes = rawPredictedCodes?.filter(
                  (pc) => !coAppliedLabels.has(String(pc.code || ""))
                );
                if (predictedCodes && predictedCodes.length > 0) {
                  return (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-surface-500 dark:text-surface-400 font-medium">
                        Ranked predictions (most to least likely):
                      </span>
                      {predictedCodes.map((pc, i) => {
                        const codeLabel = String(pc.code || "");
                        const confidence = Number(pc.confidence || 0);
                        const reasoning = String(pc.reasoning || "");
                        const existsInCodebook = codes.some((c) => c.label === codeLabel);
                        const isTop = i === 0;
                        return (
                          <div
                            key={codeLabel}
                            className={cn(
                              "rounded border px-2 py-1.5",
                              isTop
                                ? "border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/15"
                                : "border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/50"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-2xs font-semibold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                                isTop
                                  ? "bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300"
                                  : "bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400"
                              )}>
                                {i + 1}
                              </span>
                              <span className={cn(
                                "text-2xs font-medium flex-1",
                                isTop ? "text-purple-700 dark:text-purple-300" : "text-surface-700 dark:text-surface-300"
                              )}>
                                {codeLabel}
                              </span>
                              <MetricTooltip explanation={METRIC_EXPLANATIONS.predicted_confidence}>
                                <span className="text-[9px] text-surface-500 dark:text-surface-400">
                                  {(confidence * 100).toFixed(0)}%
                                </span>
                              </MetricTooltip>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isTop ? "bg-purple-400 dark:bg-purple-500" : "bg-surface-400 dark:bg-surface-500"
                                )}
                                style={{ width: `${Math.min(confidence * 100, 100)}%` }}
                              />
                            </div>
                            {reasoning && (
                              <p className="mt-0.5 text-[9px] text-surface-500 dark:text-surface-400 leading-snug">
                                {reasoning}
                              </p>
                            )}
                            {existsInCodebook && (
                              <button
                                onClick={() =>
                                  applySuggestedCode(alert.segment_id!, codeLabel, alertIdx)
                                }
                                className={cn(
                                  "mt-1 rounded px-1.5 py-0.5 text-2xs font-medium transition-colors",
                                  isTop
                                    ? "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200"
                                    : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200"
                                )}
                              >
                                Apply &ldquo;{codeLabel}&rdquo;
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => keepMyCode(alertIdx)}
                        className="w-full rounded px-1.5 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
                      >
                        Keep my code
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {interLens.predicted_code ? (
                      <p className="text-2xs text-surface-500 dark:text-surface-400">
                        Predicted:{" "}
                        <span className="font-medium text-purple-700 dark:text-purple-300">
                          &ldquo;{String(interLens.predicted_code)}&rdquo;
                        </span>
                      </p>
                    ) : null}
                    {interLens.is_conflict &&
                      interLens.predicted_code &&
                      codes.some((c) => c.label === interLens.predicted_code) ? (
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
                  </>
                );
              })()}

              {interLens.conflict_explanation ? (
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {String(interLens.conflict_explanation)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
      */}
    </div>
  );
}
