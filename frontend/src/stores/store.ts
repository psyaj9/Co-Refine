import { create } from "zustand";
import type {
  ProjectOut,
  DocumentOut,
  CodeOut,
  SegmentOut,
  AnalysisOut,
  AlertPayload,
  ChatMessageOut,
  TextSelection,
  ViewMode,
  RightPanelTab,
  EditEventOut,
  HistoryScope,
  ProjectSettings,
  PendingApplication,
  ReflectionMeta,
} from "@/types";
import * as api from "@/api/client";

const CURRENT_USER = "default";

interface AppState {
  currentUser: string;

  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (t: RightPanelTab) => void;

  showUploadPage: boolean;
  setShowUploadPage: (v: boolean) => void;

  // Projects
  projects: ProjectOut[];
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProject: (name: string) => Promise<ProjectOut>;
  deleteProject: (id: string) => Promise<void>;

  // Documents
  documents: DocumentOut[];
  activeDocumentId: string | null;
  loadDocuments: () => Promise<void>;
  setActiveDocument: (id: string) => void;
  deleteDocument: (id: string) => Promise<void>;

  // Codes
  codes: CodeOut[];
  activeCodeId: string | null;
  loadCodes: () => Promise<void>;
  setActiveCode: (id: string) => void;
  addCode: (label: string, colour: string, definition?: string) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;
  updateCodeDefinition: (id: string, definition: string) => Promise<void>;
  updateCode: (id: string, patch: { label?: string; colour?: string; definition?: string }) => Promise<void>;

  // Inconsistent segment tracking (for document viewer red highlights)
  inconsistentSegmentIds: Set<string>;

  // Segments
  segments: SegmentOut[];
  loadSegments: (docId?: string) => Promise<void>;
  applyCode: (sel: TextSelection, codeId?: string) => Promise<void>;

  // Pending code applications (select-then-confirm)
  pendingApplications: PendingApplication[];
  queueCodeApplication: (sel: TextSelection, codeId: string) => void;
  removePendingApplication: (id: string) => void;
  clearPendingApplications: () => void;
  confirmPendingApplications: () => Promise<void>;

  // Retrieved segments (for code-based retrieval panel)
  retrievedSegments: SegmentOut[];
  retrievedCodeId: string | null;
  loadRetrievedSegments: (codeId: string) => Promise<void>;
  clearRetrievedSegments: () => void;

  // Scroll-to-segment (used by RetrievedSegments → DocumentViewer)
  scrollToSegmentId: string | null;
  setScrollToSegmentId: (id: string | null) => void;

  // Selection
  selection: TextSelection | null;
  setSelection: (s: TextSelection | null) => void;
  clickedSegments: SegmentOut[] | null;
  setClickedSegments: (segs: SegmentOut[] | null) => void;
  removeSegment: (segmentId: string) => Promise<void>;

  // Analyses
  analyses: AnalysisOut[];
  loadAnalyses: () => Promise<void>;

  // Alerts
  alerts: AlertPayload[];
  agentsRunning: boolean;
  pushAlert: (a: AlertPayload) => void;
  dismissAlert: (idx: number) => void;
  clearThinkingAlerts: () => void;
  applySuggestedCode: (segmentId: string, codeLabel: string, alertIdx: number) => Promise<void>;
  keepMyCode: (alertIdx: number) => void;

  batchAuditRunning: boolean;
  batchAuditProgress: { completed: number; total: number } | null;

  // Audit stage tracking (3-stage pipeline progress)
  auditStage: {
    current: 0 | 1 | 2 | 3;
    /** Sub-stage for Stage 2: "initial" = pass 1 (2a), "reflecting" = pass 2 in progress, "reflected" = pass 2 done (2b) */
    substage: "initial" | "reflecting" | "reflected" | null;
    stage1Scores: Record<string, unknown> | null;
    escalation: { was_escalated: boolean; reason: string | null } | null;
    reflection: ReflectionMeta | null;
    confidence: {
      centroid_similarity: number | null;
      consistency_score: number | null;
      overall_severity: string | null;
      overall_severity_score: number | null;
    } | null;
  };

  codeSearchQuery: string;
  setCodeSearchQuery: (q: string) => void;
  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;

  chatMessages: ChatMessageOut[];
  chatConversationId: string | null;
  chatStreaming: boolean;
  sendChatMessage: (text: string) => Promise<void>;
  appendChatToken: (token: string) => void;
  finishChatStream: () => void;
  clearChat: () => void;
  loadChatHistory: (conversationId: string) => Promise<void>;

  editHistory: EditEventOut[];
  historyScope: HistoryScope;
  setHistoryScope: (s: HistoryScope) => void;
  historySelectedEventId: string | null;
  setHistorySelectedEventId: (id: string | null) => void;
  loadEditHistory: () => Promise<void>;

  // Project settings
  projectSettings: ProjectSettings | null;
  loadProjectSettings: () => Promise<void>;
  updateProjectSettings: (perspectives: string[]) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: CURRENT_USER,

  viewMode: "document",
  setViewMode: (v) => set({ viewMode: v }),
  rightPanelTab: "alerts",
  setRightPanelTab: (t) => set({ rightPanelTab: t }),

  showUploadPage: false,
  setShowUploadPage: (v) => set({ showUploadPage: v }),

  codeSearchQuery: "",
  setCodeSearchQuery: (q) => set({ codeSearchQuery: q }),
  docSearchQuery: "",
  setDocSearchQuery: (q) => set({ docSearchQuery: q }),

  projects: [],
  activeProjectId: null,
  loadProjects: async () => {
    const projects = await api.fetchProjects();
    set({ projects });
  },
  setActiveProject: (id) => {
    if (!id) {
      set({
        activeProjectId: null,
        activeDocumentId: null,
        documents: [],
        codes: [],
        segments: [],
        analyses: [],
        showUploadPage: false,
      });
      return;
    }
    set({
      activeProjectId: id,
      activeDocumentId: null,
      documents: [],
      codes: [],
      segments: [],
      analyses: [],
      showUploadPage: false,
    });
    setTimeout(async () => {
      const { loadDocuments, loadCodes, loadAnalyses, loadProjectSettings } = get();
      await Promise.all([loadDocuments(), loadCodes(), loadAnalyses(), loadProjectSettings()]);
    }, 0);
  },
  createProject: async (name) => {
    const project = await api.createProject(name);
    await get().loadProjects();
    return project;
  },
  deleteProject: async (id) => {
    await api.deleteProject(id);
    const { activeProjectId } = get();
    if (activeProjectId === id) {
      set({
        activeProjectId: null,
        activeDocumentId: null,
        documents: [],
        codes: [],
        segments: [],
        analyses: [],
      });
    }
    await get().loadProjects();
  },

  documents: [],
  activeDocumentId: null,
  loadDocuments: async () => {
    const { activeProjectId } = get();
    const docs = await api.fetchDocuments(activeProjectId || undefined);
    set({ documents: docs });
  },
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  deleteDocument: async (id) => {
    await api.deleteDocument(id);
    const { activeDocumentId, loadDocuments } = get();
    if (activeDocumentId === id) {
      set({ activeDocumentId: null, segments: [] });
    }
    await loadDocuments();
    // Reload codes (segment counts may have changed)
    await get().loadCodes();
    await get().loadAnalyses();
  },

  codes: [],
  activeCodeId: null,
  loadCodes: async () => {
    const { activeProjectId } = get();
    const codes = await api.fetchCodes(activeProjectId || undefined);
    set({ codes });
  },
  setActiveCode: (id) => set({ activeCodeId: id }),
  addCode: async (label, colour, definition) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.createCode(label, colour, CURRENT_USER, activeProjectId, definition);
    await get().loadCodes();
  },
  deleteCode: async (id) => {
    await api.deleteCode(id);
    await get().loadCodes();
    await get().loadAnalyses();
    // Reload segments if viewing a document (highlight may have changed)
    const { activeDocumentId, loadSegments } = get();
    if (activeDocumentId) {
      await loadSegments(activeDocumentId);
    }
  },
  updateCodeDefinition: async (id, definition) => {
    await api.updateCode(id, { definition });
    await get().loadCodes();
  },
  updateCode: async (id, patch) => {
    await api.updateCode(id, patch);
    await get().loadCodes();
  },

  segments: [],
  loadSegments: async (docId) => {
    const segs = await api.fetchSegments(docId);
    set({ segments: segs });
  },

  // Retrieved segments for code-based retrieval
  retrievedSegments: [],
  retrievedCodeId: null,
  loadRetrievedSegments: async (codeId: string) => {
    // Fetch ALL segments across all docs, then filter by code
    const allSegs = await api.fetchSegments(undefined, CURRENT_USER);
    const forCode = allSegs.filter((s) => s.code_id === codeId);
    set({ retrievedSegments: forCode, retrievedCodeId: codeId });
  },
  clearRetrievedSegments: () => set({ retrievedSegments: [], retrievedCodeId: null }),

  // ── Pending code applications (select-then-confirm) ──
  pendingApplications: [],
  queueCodeApplication: (sel, codeId) => {
    const { codes, activeDocumentId } = get();
    if (!activeDocumentId) return;
    const code = codes.find((c) => c.id === codeId);
    if (!code) return;
    const pending: PendingApplication = {
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      documentId: activeDocumentId,
      text: sel.text,
      startIndex: sel.startIndex,
      endIndex: sel.endIndex,
      codeId: code.id,
      codeLabel: code.label,
      codeColour: code.colour,
    };
    set((s) => ({ pendingApplications: [...s.pendingApplications, pending] }));
  },
  removePendingApplication: (id) =>
    set((s) => ({ pendingApplications: s.pendingApplications.filter((p) => p.id !== id) })),
  clearPendingApplications: () => set({ pendingApplications: [] }),
  confirmPendingApplications: async () => {
    const { pendingApplications, currentUser, loadSegments, loadCodes, activeDocumentId } = get();
    if (pendingApplications.length === 0) return;
    try {
      await api.batchCreateSegments(
        pendingApplications.map((p) => ({
          document_id: p.documentId,
          text: p.text,
          start_index: p.startIndex,
          end_index: p.endIndex,
          code_id: p.codeId,
          user_id: currentUser,
        }))
      );
      set({ pendingApplications: [] });
      if (activeDocumentId) await loadSegments(activeDocumentId);
      await loadCodes();
    } catch (e) {
      console.error("Failed to confirm pending applications:", e);
    }
  },

  scrollToSegmentId: null,
  setScrollToSegmentId: (id) => set({ scrollToSegmentId: id }),

  applyCode: async (sel, codeId) => {
    const { activeDocumentId, activeCodeId } = get();
    const resolvedCodeId = codeId || activeCodeId;
    if (!activeDocumentId || !resolvedCodeId) return;

    await api.codeSegment({
      document_id: activeDocumentId,
      text: sel.text,
      start_index: sel.startIndex,
      end_index: sel.endIndex,
      code_id: resolvedCodeId,
      user_id: CURRENT_USER,
    });
    // Refresh segments and code counts
    await get().loadSegments(activeDocumentId);
    await get().loadCodes();
  },

  selection: null,
  setSelection: (s) => {
    // Clear pending applications when selection changes to avoid orphaned queued codes
    if (get().pendingApplications.length > 0) {
      set({ pendingApplications: [] });
    }
    set({ selection: s, clickedSegments: null });
  },

  clickedSegments: null,
  setClickedSegments: (segs) => set({ clickedSegments: segs, selection: null }),
  removeSegment: async (segmentId) => {
    await api.deleteSegment(segmentId);
    const { activeDocumentId, loadSegments, loadCodes, clickedSegments } = get();
    if (activeDocumentId) {
      await loadSegments(activeDocumentId);
      await loadCodes();
    }
    if (clickedSegments) {
      const remaining = clickedSegments.filter((s) => s.id !== segmentId);
      set({ clickedSegments: remaining.length > 0 ? remaining : null });
    }
    // Clean up stale alerts referencing the deleted segment
    set((s) => {
      const newAlerts = s.alerts.filter((al) => al.segment_id !== segmentId);
      const newInconsistent = new Set(s.inconsistentSegmentIds);
      newInconsistent.delete(segmentId);
      return { alerts: newAlerts, inconsistentSegmentIds: newInconsistent };
    });
  },

  analyses: [],
  loadAnalyses: async () => {
    const { activeProjectId } = get();
    const a = await api.fetchAnalyses(activeProjectId || undefined);
    set({ analyses: a });
  },

  alerts: [],
  agentsRunning: false,
  pushAlert: (a) => set((s) => {
    // Batch audit lifecycle — update progress state only, don't push to visible alerts
    if (a.type === "batch_audit_started") {
      return { batchAuditRunning: true, batchAuditProgress: { completed: 0, total: (a.data?.total_codes as number) || 0 } };
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
        auditStage: { current: 1, substage: null, stage1Scores: null, escalation: null, reflection: null, confidence: null },
        alerts: [a, ...s.alerts].slice(0, 50),
      };
    }
    if (a.type === "agents_done") {
      return {
        agentsRunning: false,
        auditStage: { current: 0, substage: null, stage1Scores: null, escalation: null, reflection: null, confidence: null },
        alerts: s.alerts.filter(
          (al) => al.type !== "agents_started" && al.type !== "agent_thinking"
        ),
      };
    }
    // Track Stage 1 completion → move to Stage 2 (initial judgment = pass 1)
    if (a.type === "deterministic_scores") {
      return {
        auditStage: {
          ...s.auditStage,
          current: 2 as const,
          substage: "initial" as const,
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
    // Track reflection completion → Stage 2b done
    if (a.type === "reflection_complete") {
      const reflectionData = a.data as unknown as ReflectionMeta | undefined;
      return {
        auditStage: {
          ...s.auditStage,
          substage: "reflected" as const,
          reflection: reflectionData ?? null,
        },
      };
    }
    // Handle challenge result — update the matching audit alert in place
    if (a.type === "challenge_result" && a.segment_id) {
      const updatedAlerts = s.alerts.map((al) =>
        al.type === "coding_audit" && al.segment_id === a.segment_id
          ? { ...al, data: a.data }
          : al
      );
      return { alerts: updatedAlerts };
    }
    if (a.type === "coding_audit" || a.type === "consistency" || a.type === "ghost_partner" || a.type === "analysis_updated" || a.type === "agent_error") {
      const agentMap: Record<string, string> = {
        coding_audit: "coding_audit",
        consistency: "consistency",
        ghost_partner: "ghost_partner",
        analysis_updated: "analysis",
        agent_error: a.agent || "",
      };
      const agentName = agentMap[a.type];
      let filtered = s.alerts.filter(
        (al) => !(al.type === "agent_thinking" && al.agent === agentName)
      );
      // Replace stale audit card if this is a sibling re-audit
      if (a.type === "coding_audit" && a.replaces_segment_id && a.replaces_code_id) {
        filtered = filtered.filter(
          (al) => !(
            al.type === "coding_audit" &&
            al.segment_id === a.replaces_segment_id &&
            al.code_id === a.replaces_code_id
          )
        );
      }
      // Track inconsistent segment IDs for red highlights in document viewer
      if (a.type === "coding_audit" && a.segment_id) {
        const selfLens = a.data?.self_lens as Record<string, any> | undefined;
        const isFlagged = selfLens?.is_consistent === false;

        // Update audit stage with confidence + escalation + reflection data
        const escalation = a.escalation ?? (a.data?._escalation as { was_escalated: boolean; reason: string | null } | undefined) ?? null;
        const reflectionMeta = (a.data?._reflection as ReflectionMeta | undefined) ?? null;
        const auditStageUpdate = {
          ...s.auditStage,
          current: (escalation?.was_escalated ? 3 : s.auditStage.current) as 0 | 1 | 2 | 3,
          substage: reflectionMeta?.was_reflected ? "reflected" as const : s.auditStage.substage,
          escalation: escalation,
          reflection: reflectionMeta ?? s.auditStage.reflection,
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
          return { inconsistentSegmentIds: newSet, auditStage: auditStageUpdate, alerts: [a, ...filtered].slice(0, 50) };
        }
        return { auditStage: auditStageUpdate, alerts: [a, ...filtered].slice(0, 50) };
      }
      return { alerts: [a, ...filtered].slice(0, 50) };
    }
    return { alerts: [a, ...s.alerts].slice(0, 50) };
  }),
  dismissAlert: (idx) =>
    set((s) => {
      const dismissed = s.alerts[idx];
      const newAlerts = s.alerts.filter((_, i) => i !== idx);
      if (dismissed?.type === "coding_audit" && dismissed?.segment_id) {
        const newSet = new Set(s.inconsistentSegmentIds);
        newSet.delete(dismissed.segment_id);
        return { alerts: newAlerts, inconsistentSegmentIds: newSet };
      }
      return { alerts: newAlerts };
    }),
  clearThinkingAlerts: () =>
    set((s) => ({
      alerts: s.alerts.filter(
        (al) => al.type !== "agents_started" && al.type !== "agent_thinking"
      ),
    })),
  applySuggestedCode: async (segmentId, codeLabel, alertIdx) => {
    try {
      const seg = await api.fetchSegment(segmentId);
      const { codes, activeDocumentId, currentUser } = get();
      const matchingCode = codes.find((c) => c.label === codeLabel);
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
        user_id: currentUser,
      });
      set((s) => ({ alerts: s.alerts.filter((_, i) => i !== alertIdx) }));
      if (activeDocumentId) {
        await get().loadSegments(activeDocumentId);
      }
      await get().loadCodes();
    } catch (e) {
      console.error("Failed to apply suggested code:", e);
    }
  },
  keepMyCode: (alertIdx) => {
    set((s) => ({ alerts: s.alerts.filter((_, i) => i !== alertIdx) }));
  },

  // Inconsistent segment tracking
  inconsistentSegmentIds: new Set<string>(),

  batchAuditRunning: false,
  batchAuditProgress: null,

  auditStage: { current: 0, substage: null, stage1Scores: null, escalation: null, reflection: null, confidence: null },

  chatMessages: [],
  chatConversationId: null,
  chatStreaming: false,
  sendChatMessage: async (text) => {
    const { activeProjectId, chatConversationId, currentUser } = get();
    if (!activeProjectId) return;

    // Optimistically add user message
    const userMsg: ChatMessageOut = {
      id: "temp-" + Date.now(),
      conversation_id: chatConversationId || "pending",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));

    try {
      const res = await api.sendChatMessage(text, activeProjectId, currentUser, chatConversationId);
      const assistantPlaceholder: ChatMessageOut = {
        id: "streaming-" + Date.now(),
        conversation_id: res.conversation_id,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        chatConversationId: res.conversation_id,
        chatStreaming: true,
        chatMessages: [
          ...s.chatMessages.map((m) =>
            m.conversation_id === "pending" ? { ...m, conversation_id: res.conversation_id } : m
          ),
          assistantPlaceholder,
        ],
      }));
    } catch (e: any) {
      console.error("Chat send error:", e);
      set({ chatStreaming: false });
    }
  },
  appendChatToken: (token) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + token };
      }
      return { chatMessages: msgs };
    }),
  finishChatStream: () => set({ chatStreaming: false }),
  clearChat: () => set({ chatMessages: [], chatConversationId: null, chatStreaming: false }),
  loadChatHistory: async (conversationId) => {
    const msgs = await api.fetchChatHistory(conversationId);
    set({ chatMessages: msgs, chatConversationId: conversationId, chatStreaming: false });
  },

  editHistory: [],
  historyScope: "document",
  setHistoryScope: (s) => {
    set({ historyScope: s });
    setTimeout(() => get().loadEditHistory(), 0);
  },
  historySelectedEventId: null,
  setHistorySelectedEventId: (id) => set({ historySelectedEventId: id }),
  loadEditHistory: async () => {
    const { activeProjectId, activeDocumentId, historyScope } = get();
    if (!activeProjectId) return;
    const params: { document_id?: string } = {};
    if (historyScope === "document" && activeDocumentId) {
      params.document_id = activeDocumentId;
    }
    try {
      const events = await api.fetchEditHistory(activeProjectId, params);
      set({ editHistory: events });
    } catch (e) {
      console.error("Failed to load edit history:", e);
    }
  },

  // Project settings
  projectSettings: null,
  loadProjectSettings: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    try {
      const data = await api.fetchProjectSettings(activeProjectId);
      set({ projectSettings: data });
    } catch (e) {
      console.error("Failed to load project settings:", e);
    }
  },
  updateProjectSettings: async (perspectives: string[]) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    try {
      const data = await api.updateProjectSettings(activeProjectId, { enabled_perspectives: perspectives });
      set({ projectSettings: data });
    } catch (e) {
      console.error("Failed to update project settings:", e);
    }
  },
}));
