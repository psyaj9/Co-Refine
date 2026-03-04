import type { CodeOut, AnalysisOut } from "@/types";
import * as api from "@/api/client";

const CURRENT_USER = "default";

export interface CodeSlice {
  codes: CodeOut[];
  activeCodeId: string | null;
  loadCodes: () => Promise<void>;
  setActiveCode: (id: string) => void;
  addCode: (label: string, colour: string, definition?: string) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;
  updateCode: (
    id: string,
    patch: { label?: string; colour?: string; definition?: string },
  ) => Promise<void>;

  /** AI analysis results per code (co-loaded with codes on project switch) */
  analyses: AnalysisOut[];
  loadAnalyses: () => Promise<void>;
}

export const createCodeSlice = (
  set: (partial: any) => void,
  get: () => any,
): CodeSlice => ({
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
    // Segment highlights may have changed if the deleted code had segments
    const { activeDocumentId, loadSegments } = get();
    if (activeDocumentId) {
      await loadSegments(activeDocumentId);
    }
  },

  updateCode: async (id, patch) => {
    await api.updateCode(id, patch);
    await get().loadCodes();
  },

  analyses: [],

  loadAnalyses: async () => {
    const { activeProjectId } = get();
    const analyses = await api.fetchAnalyses(activeProjectId || undefined);
    set({ analyses });
  },
});
