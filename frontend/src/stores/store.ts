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
  LeftPanelTab,
  EditEventOut,
  HistoryScope,
} from "@/types";
import * as api from "@/api/client";

const CURRENT_USER = "default";

interface AppState {
  currentUser: string;

  // View modes
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (t: RightPanelTab) => void;
  leftPanelTab: LeftPanelTab;
  setLeftPanelTab: (t: LeftPanelTab) => void;

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

  // Batch Audit
  batchAuditRunning: boolean;
  batchAuditProgress: { completed: number; total: number } | null;

  // Search
  codeSearchQuery: string;
  setCodeSearchQuery: (q: string) => void;
  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;

  // Chat
  chatMessages: ChatMessageOut[];
  chatConversationId: string | null;
  chatStreaming: boolean;
  sendChatMessage: (text: string) => Promise<void>;
  appendChatToken: (token: string) => void;
  finishChatStream: () => void;
  clearChat: () => void;
  loadChatHistory: (conversationId: string) => Promise<void>;

  // Edit History
  editHistory: EditEventOut[];
  historyScope: HistoryScope;
  setHistoryScope: (s: HistoryScope) => void;
  historySelectedEventId: string | null;
  setHistorySelectedEventId: (id: string | null) => void;
  loadEditHistory: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: CURRENT_USER,

  // View modes
  viewMode: "document",
  setViewMode: (v) => set({ viewMode: v }),
  rightPanelTab: "alerts",
  setRightPanelTab: (t) => set({ rightPanelTab: t }),
  leftPanelTab: "codes",
  setLeftPanelTab: (t) => set({ leftPanelTab: t }),

  showUploadPage: false,
  setShowUploadPage: (v) => set({ showUploadPage: v }),

  // Search
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
      // Going back to project list
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
    // Load project-scoped data
    setTimeout(async () => {
      const { loadDocuments, loadCodes, loadAnalyses } = get();
      await Promise.all([loadDocuments(), loadCodes(), loadAnalyses()]);
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
    // Refresh segments list AND code counts
    await get().loadSegments(activeDocumentId);
    await get().loadCodes();
  },

  selection: null,
  setSelection: (s) => set({ selection: s, clickedSegments: null }),

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
    // When agents start, set running flag
    if (a.type === "agents_started") {
      return { agentsRunning: true, alerts: [a, ...s.alerts].slice(0, 50) };
    }
    // When agents finish, clear running flag and remove transient thinking alerts
    if (a.type === "agents_done") {
      return {
        agentsRunning: false,
        alerts: s.alerts.filter(
          (al) => al.type !== "agents_started" && al.type !== "agent_thinking"
        ),
      };
    }
    // When a final result arrives, remove the matching thinking placeholder
    if (a.type === "coding_audit" || a.type === "consistency" || a.type === "ghost_partner" || a.type === "analysis_updated" || a.type === "agent_error") {
      const agentMap: Record<string, string> = {
        coding_audit: "coding_audit",
        consistency: "consistency",
        ghost_partner: "ghost_partner",
        analysis_updated: "analysis",
        agent_error: (a as any).agent || "",
      };
      const agentName = agentMap[a.type];
      const filtered = s.alerts.filter(
        (al) => !(al.type === "agent_thinking" && al.agent === agentName)
      );
      // Track inconsistent segment IDs for red highlights in document viewer
      if (a.type === "coding_audit" && a.segment_id) {
        const selfLens = a.data?.self_lens as Record<string, any> | undefined;
        const interLens = a.data?.inter_rater_lens as Record<string, any> | undefined;
        const isFlagged = selfLens?.is_consistent === false || interLens?.is_conflict === true;
        if (isFlagged) {
          const newSet = new Set(s.inconsistentSegmentIds);
          newSet.add(a.segment_id);
          return { inconsistentSegmentIds: newSet, alerts: [a, ...filtered].slice(0, 50) };
        }
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
      // Fetch the original segment to get its text range
      const seg = await api.fetchSegment(segmentId);
      // Find the matching code in the store
      const { codes, activeDocumentId, currentUser } = get();
      const matchingCode = codes.find((c) => c.label === codeLabel);
      if (!matchingCode) {
        console.error("Suggested code not found in project:", codeLabel);
        return;
      }
      // Apply the suggested code to the same text range
      await api.codeSegment({
        document_id: seg.document_id,
        text: seg.text,
        start_index: seg.start_index,
        end_index: seg.end_index,
        code_id: matchingCode.id,
        user_id: currentUser,
      });
      // Dismiss the alert
      set((s) => ({ alerts: s.alerts.filter((_, i) => i !== alertIdx) }));
      // Refresh segments and codes
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

  // Batch Audit
  batchAuditRunning: false,
  batchAuditProgress: null,

  // Chat
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
      // Set conversation ID, add placeholder for assistant
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

  // Edit History
  editHistory: [],
  historyScope: "document",
  setHistoryScope: (s) => {
    set({ historyScope: s });
    // Reload history with new scope
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
}));
