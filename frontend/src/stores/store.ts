import { create } from "zustand";
import type {
  ProjectOut,
  DocumentOut,
  CodeOut,
  SegmentOut,
  AnalysisOut,
  AlertPayload,
  TextSelection,
} from "../types";
import * as api from "../api/client";

const CURRENT_USER = "default";

interface AppState {
  currentUser: string;

  showUploadPage: boolean;
  setShowUploadPage: (v: boolean) => void;

  projects: ProjectOut[];
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProject: (name: string) => Promise<ProjectOut>;
  deleteProject: (id: string) => Promise<void>;

  documents: DocumentOut[];
  activeDocumentId: string | null;
  loadDocuments: () => Promise<void>;
  setActiveDocument: (id: string) => void;
  deleteDocument: (id: string) => Promise<void>;

  codes: CodeOut[];
  activeCodeId: string | null;
  loadCodes: () => Promise<void>;
  setActiveCode: (id: string) => void;
  addCode: (label: string, colour: string, definition?: string) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;
  updateCodeDefinition: (id: string, definition: string) => Promise<void>;

  segments: SegmentOut[];
  loadSegments: (docId?: string) => Promise<void>;
  applyCode: (sel: TextSelection, codeId?: string) => Promise<void>;

  selection: TextSelection | null;
  setSelection: (s: TextSelection | null) => void;

  clickedSegments: SegmentOut[] | null;
  setClickedSegments: (segs: SegmentOut[] | null) => void;
  removeSegment: (segmentId: string) => Promise<void>;

  analyses: AnalysisOut[];
  loadAnalyses: () => Promise<void>;

  alerts: AlertPayload[];
  agentsRunning: boolean;
  pushAlert: (a: AlertPayload) => void;
  dismissAlert: (idx: number) => void;
  clearThinkingAlerts: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: CURRENT_USER,

  showUploadPage: false,
  setShowUploadPage: (v) => set({ showUploadPage: v }),

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

  segments: [],
  loadSegments: async (docId) => {
    const segs = await api.fetchSegments(docId);
    set({ segments: segs });
  },
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
    if (a.type === "consistency" || a.type === "ghost_partner" || a.type === "analysis_updated" || a.type === "agent_error") {
      const agentMap: Record<string, string> = {
        consistency: "consistency",
        ghost_partner: "ghost_partner",
        analysis_updated: "analysis",
        agent_error: (a as any).agent || "",
      };
      const agentName = agentMap[a.type];
      const filtered = s.alerts.filter(
        (al) => !(al.type === "agent_thinking" && al.agent === agentName)
      );
      return { alerts: [a, ...filtered].slice(0, 50) };
    }
    return { alerts: [a, ...s.alerts].slice(0, 50) };
  }),
  dismissAlert: (idx) =>
    set((s) => ({ alerts: s.alerts.filter((_, i) => i !== idx) })),
  clearThinkingAlerts: () =>
    set((s) => ({
      alerts: s.alerts.filter(
        (al) => al.type !== "agents_started" && al.type !== "agent_thinking"
      ),
    })),
}));
