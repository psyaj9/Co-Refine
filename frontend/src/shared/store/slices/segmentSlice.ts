import type { SegmentOut, TextSelection, PendingApplication } from "@/types";
import * as api from "@/api/client";



export interface SegmentSlice {
  segments: SegmentOut[];
  loadSegments: (docId?: string) => Promise<void>;
  applyCode: (sel: TextSelection, codeId?: string) => Promise<void>;

  /** Pending select-then-confirm code applications shown in PendingApplicationsBar */
  pendingApplications: PendingApplication[];
  queueCodeApplication: (sel: TextSelection, codeId: string) => void;
  removePendingApplication: (id: string) => void;
  clearPendingApplications: () => void;
  confirmPendingApplications: () => Promise<void>;

  /** Segments fetched for a specific code (shown in RetrievedSegments panel) */
  retrievedSegments: SegmentOut[];
  retrievedCodeId: string | null;
  loadRetrievedSegments: (codeId: string) => Promise<void>;
  clearRetrievedSegments: () => void;

  /** Triggers the DocumentViewer to scroll a specific segment into view */
  scrollToSegmentId: string | null;
  setScrollToSegmentId: (id: string | null) => void;

  /** Current text selection from the document viewer */
  selection: TextSelection | null;
  setSelection: (s: TextSelection | null) => void;

  /** Segments that were clicked in the margin pills (shows popover) */
  clickedSegments: SegmentOut[] | null;
  setClickedSegments: (segs: SegmentOut[] | null) => void;
  removeSegment: (segmentId: string) => Promise<void>;
}

export const createSegmentSlice = (
  set: (partial: any) => void,
  get: () => any,
): SegmentSlice => ({
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
    });
    await get().loadSegments(activeDocumentId);
    await get().loadCodes();
  },

  // ── Pending applications ────────────────────────────────────────────
  pendingApplications: [],

  queueCodeApplication: (sel, codeId) => {
    const { codes, activeDocumentId } = get();
    if (!activeDocumentId) return;
    const code = codes.find((c: { id: string }) => c.id === codeId);
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
    set((s: any) => ({ pendingApplications: [...s.pendingApplications, pending] }));
  },

  removePendingApplication: (id) =>
    set((s: any) => ({
      pendingApplications: s.pendingApplications.filter((p: PendingApplication) => p.id !== id),
    })),

  clearPendingApplications: () => set({ pendingApplications: [] }),

  confirmPendingApplications: async () => {
    const { pendingApplications, loadSegments, loadCodes, activeDocumentId } = get();
    if (pendingApplications.length === 0) return;
    try {
      await api.batchCreateSegments(
        pendingApplications.map((p: PendingApplication) => ({
          document_id: p.documentId,
          text: p.text,
          start_index: p.startIndex,
          end_index: p.endIndex,
          code_id: p.codeId,
        })),
      );
      set({ pendingApplications: [] });
      if (activeDocumentId) await loadSegments(activeDocumentId);
      await loadCodes();
    } catch (e) {
      console.error("Failed to confirm pending applications:", e);
    }
  },

  // ── Retrieved segments ──────────────────────────────────────────────
  retrievedSegments: [],
  retrievedCodeId: null,

  loadRetrievedSegments: async (codeId: string) => {
    const forCode = await api.fetchCodeSegments(codeId);
    set({ retrievedSegments: forCode, retrievedCodeId: codeId });
  },

  clearRetrievedSegments: () => set({ retrievedSegments: [], retrievedCodeId: null }),

  // ── Scroll-to-segment ───────────────────────────────────────────────
  scrollToSegmentId: null,
  setScrollToSegmentId: (id) => set({ scrollToSegmentId: id }),

  // ── Selection / clicked segments ───────────────────────────────────
  selection: null,

  setSelection: (s) => {
    // Discard queued pending applications when selection changes to avoid orphans
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
      const remaining = clickedSegments.filter((s: SegmentOut) => s.id !== segmentId);
      set({ clickedSegments: remaining.length > 0 ? remaining : null });
    }

    // Clean up stale alerts and inconsistent-segment highlights referencing this segment
    set((s: any) => {
      const newAlerts = s.alerts.filter(
        (al: { segment_id?: string }) => al.segment_id !== segmentId,
      );
      const newInconsistent = new Set(s.inconsistentSegmentIds);
      newInconsistent.delete(segmentId);
      return { alerts: newAlerts, inconsistentSegmentIds: newInconsistent };
    });
  },
});
