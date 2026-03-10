import type { DocumentOut } from "@/shared/types";
import * as api from "@/shared/api/client";
import { DOCUMENT_KEY } from "./authSlice";

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

  setActiveDocument: (id) => {
    sessionStorage.setItem(DOCUMENT_KEY, id);
    set({ activeDocumentId: id });
  },

  deleteDocument: async (id) => {
    await api.deleteDocument(id);
    const { activeDocumentId, loadDocuments } = get();
    if (activeDocumentId === id) {
      set({ activeDocumentId: null, segments: [] });
    }
    await loadDocuments();
    await get().loadCodes();
    await get().loadAnalyses();
  },
});
