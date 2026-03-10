import type { EditEventOut, HistoryScope } from "@/shared/types";
import * as api from "@/shared/api/client";

export interface HistorySlice {
  editHistory: EditEventOut[];
  historyScope: HistoryScope;
  setHistoryScope: (s: HistoryScope) => void;
  historySelectedEventId: string | null;
  setHistorySelectedEventId: (id: string | null) => void;
  loadEditHistory: () => Promise<void>;
}

export const createHistorySlice = (
  set: (partial: any) => void,
  get: () => any,
): HistorySlice => ({
  editHistory: [],
  historyScope: "document",
  historySelectedEventId: null,

  setHistoryScope: (s) => {
    set({ historyScope: s });
    // Immediately reload with the new scope applied
    setTimeout(() => get().loadEditHistory(), 0);
  },

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
});
