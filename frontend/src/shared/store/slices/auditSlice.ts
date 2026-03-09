import type { AlertPayload } from "@/types";
import * as api from "@/api/client";

export interface AuditStage {
  current: 0 | 1 | 2;
  stage1Scores: Record<string, unknown> | null;
  confidence: {
    centroid_similarity: number | null;
    consistency_score: number | null;
    overall_severity: string | null;
    overall_severity_score: number | null;
  } | null;
}

const INITIAL_AUDIT_STAGE: AuditStage = {
  current: 0,
  stage1Scores: null,
  confidence: null,
};

export interface AuditSlice {
  alerts: AlertPayload[];
  agentsRunning: boolean;
  pushAlert: (a: AlertPayload) => void;
  dismissAlert: (idx: number) => void;
  clearThinkingAlerts: () => void;
  applySuggestedCode: (segmentId: string, codeLabel: string, alertIdx: number) => Promise<void>;
  keepMyCode: (alertIdx: number) => void;

  batchAuditRunning: boolean;
  batchAuditProgress: { completed: number; total: number } | null;

  auditStage: AuditStage;

  inconsistentSegmentIds: Set<string>;

  overlapMatrix: Record<string, Record<string, number>> | null;
  setOverlapMatrix: (matrix: Record<string, Record<string, number>>) => void;
}

export const createAuditSlice = (
  set: (updater: any) => void,
  get: () => any,
): AuditSlice => ({
  alerts: [],
  agentsRunning: false,
  batchAuditRunning: false,
  batchAuditProgress: null,
  auditStage: INITIAL_AUDIT_STAGE,
  inconsistentSegmentIds: new Set<string>(),
  overlapMatrix: null,
  setOverlapMatrix: (matrix) => set({ overlapMatrix: matrix }),

  pushAlert: (a) =>
    set((s: any) => {
      if (a.type === "batch_audit_started") {
        return {
          batchAuditRunning: true,
          batchAuditProgress: { completed: 0, total: (a.data?.total_codes as number) || 0 },
        };
      }
      if (a.type === "batch_audit_progress") {
        return {
          batchAuditProgress: {
            completed: (a.data?.completed as number) || 0,
            total: (a.data?.total as number) || 0,
          },
        };
      }
      if (a.type === "batch_audit_done") {
        return { batchAuditRunning: false, batchAuditProgress: null };
      }

      if (a.type === "agents_started") {
        return {
          agentsRunning: true,
          auditStage: {
            current: 1,
            stage1Scores: null,
            escalation: null,
            confidence: null,
          },
          alerts: [a, ...s.alerts].slice(0, 50),
        };
      }
      if (a.type === "agents_done") {
        return {
          agentsRunning: false,
          auditStage: INITIAL_AUDIT_STAGE,
          alerts: s.alerts.filter(
            (al: AlertPayload) =>
              al.type !== "agents_started" && al.type !== "agent_thinking",
          ),
        };
      }

      if (a.type === "deterministic_scores") {
        return {
          auditStage: {
            ...s.auditStage,
            current: 2 as const,
            stage1Scores: a.data || null,
            confidence: {
              centroid_similarity: (a.data?.centroid_similarity as number) ?? null,
              consistency_score: null,
              overall_severity: null,
              overall_severity_score: null,
            },
          },
          alerts: [a, ...s.alerts].slice(0, 50),
        };
      }

      if (
        a.type === "coding_audit" ||
        a.type === "consistency" ||
        a.type === "ghost_partner" ||
        a.type === "analysis_updated" ||
        a.type === "agent_error"
      ) {
        const agentMap: Record<string, string> = {
          coding_audit: "coding_audit",
          consistency: "consistency",
          ghost_partner: "ghost_partner",
          analysis_updated: "analysis",
          agent_error: a.agent || "",
        };
        const agentName = agentMap[a.type];

        let filtered = s.alerts.filter(
          (al: AlertPayload) =>
            !(al.type === "agent_thinking" && al.agent === agentName),
        );

        if (a.type === "coding_audit" && a.replaces_segment_id && a.replaces_code_id) {
          filtered = filtered.filter(
            (al: AlertPayload) =>
              !(
                al.type === "coding_audit" &&
                al.segment_id === a.replaces_segment_id &&
                al.code_id === a.replaces_code_id
              ),
          );
        }

        if (a.type === "coding_audit" && a.segment_id) {
          const selfLens = a.data?.self_lens as Record<string, unknown> | undefined;
          const isFlagged = selfLens?.is_consistent === false;

          const auditStageUpdate: AuditStage = {
            ...s.auditStage,
            current: 2 as const,
            confidence: {
              centroid_similarity: s.auditStage.confidence?.centroid_similarity ?? null,
              consistency_score: (selfLens?.consistency_score as number) ?? null,
              overall_severity: (a.data?.overall_severity as string) ?? null,
              overall_severity_score: (a.data?.overall_severity_score as number) ?? null,
            },
          };

          if (isFlagged) {
            const newSet = new Set(s.inconsistentSegmentIds);
            newSet.add(a.segment_id);
            return {
              inconsistentSegmentIds: newSet,
              auditStage: auditStageUpdate,
              alerts: [a, ...filtered].slice(0, 50),
            };
          }
          return { auditStage: auditStageUpdate, alerts: [a, ...filtered].slice(0, 50) };
        }

        return { alerts: [a, ...filtered].slice(0, 50) };
      }

      return { alerts: [a, ...s.alerts].slice(0, 50) };
    }),

  dismissAlert: (idx) =>
    set((s: any) => {
      const dismissed = s.alerts[idx];
      const newAlerts = s.alerts.filter((_: unknown, i: number) => i !== idx);
      if (dismissed?.type === "coding_audit" && dismissed?.segment_id) {
        const newSet = new Set(s.inconsistentSegmentIds);
        newSet.delete(dismissed.segment_id);
        return { alerts: newAlerts, inconsistentSegmentIds: newSet };
      }
      return { alerts: newAlerts };
    }),

  clearThinkingAlerts: () =>
    set((s: any) => ({
      alerts: s.alerts.filter(
        (al: AlertPayload) =>
          al.type !== "agents_started" && al.type !== "agent_thinking",
      ),
    })),

  applySuggestedCode: async (segmentId, codeLabel, alertIdx) => {
    try {
      const seg = await api.fetchSegment(segmentId);
      const { codes, activeDocumentId } = get();
      const matchingCode = codes.find((c: { label: string }) => c.label === codeLabel);
      if (!matchingCode) {
        console.error("Suggested code not found in project:", codeLabel);
        return;
      }
      await api.codeSegment({
        document_id: seg.document_id,
        text: seg.text,
        start_index: seg.start_index,
        end_index: seg.end_index,
        code_id: matchingCode.id,
      });
      set((s: any) => ({ alerts: s.alerts.filter((_: unknown, i: number) => i !== alertIdx) }));
      if (activeDocumentId) {
        await get().loadSegments(activeDocumentId);
      }
      await get().loadCodes();
    } catch (e) {
      console.error("Failed to apply suggested code:", e);
    }
  },

  keepMyCode: (alertIdx) => {
    set((s: any) => ({ alerts: s.alerts.filter((_: unknown, i: number) => i !== alertIdx) }));
  },
});
