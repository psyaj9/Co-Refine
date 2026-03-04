import { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  RotateCw,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { METRIC_EXPLANATIONS } from "@/lib/constants";
import MetricTooltip from "@/features/audit/components/MetricTooltip";
import AuditScoreTable from "@/features/audit/components/AuditScoreTable";
import ChallengeForm, { ChallengeOpenButton } from "@/features/audit/components/ChallengeForm";
import { useChallengeSubmit } from "@/features/audit/hooks/useChallengeSubmit";
import { useStore } from "@/stores/store";
import type { AlertPayload, CodeOut, ReflectionMeta, ChallengeMeta } from "@/types";

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
  const selfLens = alert.data?.self_lens as Record<string, unknown> | undefined;
  if (!selfLens) return null;

  const reflectionMeta = alert.data?._reflection as ReflectionMeta | undefined;
  const challengeMeta = alert.data?._challenge as ChallengeMeta | undefined;

  const [selfOpen, setSelfOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const segments = useStore((s) => s.segments);
  const currentUser = useStore((s) => s.currentUser);
  const pushAlert = useStore((s) => s.pushAlert);

  // Codes already on overlapping spans — filtered out of suggestions
  const coAppliedLabels = useMemo(() => {
    if (!alert.segment_id) return new Set<string>();
    const thisSeg = segments.find((s) => s.id === alert.segment_id);
    if (!thisSeg) return new Set<string>();
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

  const altCodes = Array.isArray(selfLens?.alternative_codes)
    ? (selfLens.alternative_codes as string[]).filter(
        (c) => codes.some((code) => code.label === c) && !coAppliedLabels.has(c),
      )
    : [];

  const handleChallengeSuccess = useCallback(() => {
    setChallengeOpen(false);
  }, []);

  const challenge = useChallengeSubmit({
    alert,
    currentUser,
    pushAlert,
    onSuccess: handleChallengeSuccess,
  });

  return (
    <div className="mt-2 space-y-1.5">
      {/* ── Self-Consistency Section ─────────────────────────────── */}
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
            <span className={cn("text-2xs px-1 rounded", selfLens.is_consistent ? "text-green-600" : "text-amber-600")}>
              {(selfLens.consistency_score as string) || "–"}
            </span>
          </MetricTooltip>
          {selfOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
        </button>

        {selfOpen && (
          <div className="px-2 py-1.5 space-y-1 tab-content-enter">
            <p className="text-[10px] text-surface-400 dark:text-surface-500 italic mb-1">
              This checks if you&apos;re applying this code the same way you have before.
            </p>
            {!!selfLens.suggestion && (
              <p className="text-2xs text-surface-600 dark:text-surface-300">{String(selfLens.suggestion)}</p>
            )}
            {!!selfLens.drift_warning && (
              <p className="text-2xs text-amber-600 dark:text-amber-400 italic">{String(selfLens.drift_warning)}</p>
            )}
            {altCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {altCodes.map((ac) => (
                  <button
                    key={ac}
                    onClick={() => applySuggestedCode(alert.segment_id!, ac, alertIdx)}
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

      {/* ── Reflection Section ───────────────────────────────────── */}
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
              Δ {reflectionMeta.score_delta.consistency_score >= 0 ? "+" : ""}{reflectionMeta.score_delta.consistency_score.toFixed(2)}
            </span>
            {reflectionOpen ? <ChevronDown size={9} aria-hidden="true" /> : <ChevronRightIcon size={9} aria-hidden="true" />}
          </button>
          {reflectionOpen && (
            <div className="px-2 py-1.5 space-y-1 tab-content-enter">
              <p className="text-[10px] text-surface-400 dark:text-surface-500 italic mb-1">
                The AI reviewed its own initial judgment with fresh examples. Score changes reflect reconsideration.
              </p>
              <AuditScoreTable
                rows={[
                  { label: "Consistency", before: reflectionMeta.initial_scores.consistency_score, after: reflectionMeta.reflected_scores.consistency_score, delta: reflectionMeta.score_delta.consistency_score },
                  { label: "Intent", before: reflectionMeta.initial_scores.intent_alignment_score, after: reflectionMeta.reflected_scores.intent_alignment_score, delta: reflectionMeta.score_delta.intent_alignment_score },
                  { label: "Severity", before: reflectionMeta.initial_scores.overall_severity_score, after: reflectionMeta.reflected_scores.overall_severity_score, delta: reflectionMeta.score_delta.overall_severity_score, invertDeltaColor: true },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Challenge Result (already challenged) ───────────────── */}
      {challengeMeta?.was_challenged && (
        <div className="rounded border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 px-2 py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={9} className="text-purple-500" aria-hidden="true" />
            <span className="text-2xs font-semibold text-purple-700 dark:text-purple-400">Your Challenge</span>
          </div>
          <p className="text-[10px] text-surface-500 dark:text-surface-400 italic mb-1">
            &ldquo;{challengeMeta.researcher_feedback}&rdquo;
          </p>
          <AuditScoreTable
            rows={[
              { label: "Consistency", before: challengeMeta.pre_challenge_scores.consistency_score, after: challengeMeta.post_challenge_scores.consistency_score, delta: challengeMeta.score_delta.consistency_score },
              { label: "Intent", before: challengeMeta.pre_challenge_scores.intent_alignment_score, after: challengeMeta.post_challenge_scores.intent_alignment_score, delta: challengeMeta.score_delta.intent_alignment_score },
            ]}
          />
        </div>
      )}

      {/* ── Challenge Input (not yet challenged) ────────────────── */}
      {alert.segment_id && !challengeMeta?.was_challenged && (
        <div className="mt-1">
          {!challengeOpen ? (
            <ChallengeOpenButton onClick={() => setChallengeOpen(true)} />
          ) : (
            <ChallengeForm
              loading={challenge.loading}
              error={challenge.error}
              onSubmit={challenge.submit}
              onCancel={() => {
                setChallengeOpen(false);
                challenge.clearError();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
