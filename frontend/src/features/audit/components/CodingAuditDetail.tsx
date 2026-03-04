import { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  RotateCw,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/components/MetricTooltip";
import type { AlertPayload, CodeOut, ReflectionMeta, ChallengeMeta } from "@/types";
import { useStore } from "@/stores/store";
import { challengeReflection } from "@/api/client";

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
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeText, setChallengeText] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;
  if (!selfLens) return null;

  const reflectionMeta = alert.data?._reflection as ReflectionMeta | undefined;
  const challengeMeta = alert.data?._challenge as ChallengeMeta | undefined;

  // Display-time safety filter: exclude codes already applied to the same span
  const segments = useStore((s) => s.segments);
  const currentUser = useStore((s) => s.currentUser);
  const pushAlert = useStore((s) => s.pushAlert);
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

  const handleChallenge = useCallback(async () => {
    if (!alert.segment_id || !challengeText.trim()) return;
    setChallengeLoading(true);
    setChallengeError(null);
    try {
      const resp = await challengeReflection(alert.segment_id, challengeText.trim(), currentUser);
      pushAlert({
        type: "challenge_result",
        segment_id: alert.segment_id,
        code_id: alert.code_id,
        data: resp.audit_result,
      });
      setChallengeText("");
      setChallengeOpen(false);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setChallengeLoading(false);
    }
  }, [alert.segment_id, alert.code_id, challengeText, currentUser, pushAlert]);

  /** Format a score delta with +/- sign */
  const fmtDelta = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

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
            {reflectionMeta?.was_reflected && (
              <MetricTooltip explanation={METRIC_EXPLANATIONS.reflection}>
                <span className="text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                  Reflected
                </span>
              </MetricTooltip>
            )}
            {challengeMeta?.was_challenged && (
              <MetricTooltip explanation={METRIC_EXPLANATIONS.challenge}>
                <span className="text-[9px] px-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                  Challenged
                </span>
              </MetricTooltip>
            )}
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

      {/* Reflection Scores Section (only if reflection happened) */}
      {reflectionMeta?.was_reflected && (
        <div className="rounded border border-blue-200 dark:border-blue-800 overflow-hidden">
          <button
            onClick={() => setReflectionOpen(!reflectionOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 transition-colors"
            aria-expanded={reflectionOpen}
            aria-label="Toggle reflection details"
          >
            <RotateCw size={9} aria-hidden="true" />
            <MetricTooltip explanation={METRIC_EXPLANATIONS.reflection}>
              <span className="text-2xs font-semibold flex-1 text-left">Reflection Pass</span>
            </MetricTooltip>
            <span className="text-[9px] text-blue-500 dark:text-blue-400">
              Δ {fmtDelta(reflectionMeta.score_delta.consistency_score)}
            </span>
            {reflectionOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
          </button>
          {reflectionOpen && (
            <div className="px-2 py-1.5 space-y-1 tab-content-enter">
              <p className="text-[10px] text-surface-400 dark:text-surface-500 italic mb-1">
                The AI reviewed its own initial judgment with fresh examples. Score changes reflect reconsideration.
              </p>
              <div className="grid grid-cols-3 gap-1 text-[9px]">
                <div className="text-surface-400">Metric</div>
                <div className="text-surface-400">Before</div>
                <div className="text-surface-400">After (Δ)</div>
                <div className="text-surface-500">Consistency</div>
                <div>{reflectionMeta.initial_scores.consistency_score.toFixed(2)}</div>
                <div className={cn(reflectionMeta.score_delta.consistency_score > 0 ? "text-green-600" : reflectionMeta.score_delta.consistency_score < 0 ? "text-red-600" : "")}>
                  {reflectionMeta.reflected_scores.consistency_score.toFixed(2)} ({fmtDelta(reflectionMeta.score_delta.consistency_score)})
                </div>
                <div className="text-surface-500">Intent</div>
                <div>{reflectionMeta.initial_scores.intent_alignment_score.toFixed(2)}</div>
                <div className={cn(reflectionMeta.score_delta.intent_alignment_score > 0 ? "text-green-600" : reflectionMeta.score_delta.intent_alignment_score < 0 ? "text-red-600" : "")}>
                  {reflectionMeta.reflected_scores.intent_alignment_score.toFixed(2)} ({fmtDelta(reflectionMeta.score_delta.intent_alignment_score)})
                </div>
                <div className="text-surface-500">Severity</div>
                <div>{reflectionMeta.initial_scores.overall_severity_score.toFixed(2)}</div>
                <div className={cn(reflectionMeta.score_delta.overall_severity_score < 0 ? "text-green-600" : reflectionMeta.score_delta.overall_severity_score > 0 ? "text-red-600" : "")}>
                  {reflectionMeta.reflected_scores.overall_severity_score.toFixed(2)} ({fmtDelta(reflectionMeta.score_delta.overall_severity_score)})
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Challenge Scores Section (only if challenged) */}
      {challengeMeta?.was_challenged && (
        <div className="rounded border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 px-2 py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={9} className="text-purple-500" aria-hidden="true" />
            <span className="text-2xs font-semibold text-purple-700 dark:text-purple-400">Your Challenge</span>
          </div>
          <p className="text-[10px] text-surface-500 dark:text-surface-400 italic mb-1">
            &ldquo;{challengeMeta.researcher_feedback}&rdquo;
          </p>
          <div className="grid grid-cols-3 gap-1 text-[9px]">
            <div className="text-surface-400">Metric</div>
            <div className="text-surface-400">Before</div>
            <div className="text-surface-400">After (Δ)</div>
            <div className="text-surface-500">Consistency</div>
            <div>{challengeMeta.pre_challenge_scores.consistency_score.toFixed(2)}</div>
            <div className={cn(challengeMeta.score_delta.consistency_score > 0 ? "text-green-600" : challengeMeta.score_delta.consistency_score < 0 ? "text-red-600" : "")}>
              {challengeMeta.post_challenge_scores.consistency_score.toFixed(2)} ({fmtDelta(challengeMeta.score_delta.consistency_score)})
            </div>
            <div className="text-surface-500">Intent</div>
            <div>{challengeMeta.pre_challenge_scores.intent_alignment_score.toFixed(2)}</div>
            <div className={cn(challengeMeta.score_delta.intent_alignment_score > 0 ? "text-green-600" : challengeMeta.score_delta.intent_alignment_score < 0 ? "text-red-600" : "")}>
              {challengeMeta.post_challenge_scores.intent_alignment_score.toFixed(2)} ({fmtDelta(challengeMeta.score_delta.intent_alignment_score)})
            </div>
          </div>
        </div>
      )}

      {/* Challenge Reflection Button & Input */}
      {alert.segment_id && !challengeMeta?.was_challenged && (
        <div className="mt-1">
          {!challengeOpen ? (
            <button
              onClick={() => setChallengeOpen(true)}
              className="flex items-center gap-1 text-2xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
            >
              <MessageSquare size={9} aria-hidden="true" />
              Challenge this judgment
            </button>
          ) : (
            <div className="rounded border border-purple-200 dark:border-purple-800 p-2 space-y-1.5">
              <p className="text-[10px] text-surface-400 dark:text-surface-500">
                Tell the AI why you disagree — it will reconsider with your feedback.
              </p>
              <textarea
                value={challengeText}
                onChange={(e) => setChallengeText(e.target.value)}
                placeholder="e.g. This segment clearly shows anxiety, not just stress..."
                className="w-full text-2xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                rows={3}
                disabled={challengeLoading}
              />
              {challengeError && (
                <p className="text-[10px] text-red-500">{challengeError}</p>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={handleChallenge}
                  disabled={challengeLoading || !challengeText.trim()}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium transition-colors",
                    challengeLoading || !challengeText.trim()
                      ? "bg-surface-100 text-surface-400 cursor-not-allowed"
                      : "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200"
                  )}
                >
                  {challengeLoading && <Loader2 size={9} className="animate-spin" aria-hidden="true" />}
                  {challengeLoading ? "Reconsidering…" : "Submit Challenge"}
                </button>
                <button
                  onClick={() => { setChallengeOpen(false); setChallengeText(""); setChallengeError(null); }}
                  className="rounded px-2 py-0.5 text-2xs text-surface-400 hover:text-surface-600 transition-colors"
                  disabled={challengeLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
