import type { DocumentOut } from "@/types";
import * as api from "@/api/client";

export interface DocumentSlice {
  documents: DocumentOut[];
  activeDocumentId: string | null;
  loadDocuments: () => Promise<void>;
  setActiveDocument: (id: string) => void;
  deleteDocument: (id: string) => Promise<void>;
}

export const createDocumentSlice = (
  set: (partial: any) => void,
  get: () => any,
): DocumentSlice => ({
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
    // Segment counts and analyses may have changed
    await get().loadCodes();
    await get().loadAnalyses();
  },
});
