import type { ViewMode, RightPanelTab } from "@/types";

export interface UiSlice {
  currentUser: string;

  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;

  rightPanelTab: RightPanelTab;
  setRightPanelTab: (t: RightPanelTab) => void;

  showUploadPage: boolean;
  setShowUploadPage: (v: boolean) => void;

  /** Cross-filter state shared between FacetExplorerTab and MarginPills */
  selectedVisCodeId: string | null;
  setSelectedVisCodeId: (id: string | null) => void;

  /** Increment to trigger a vis data refetch across all three vis tabs */
  visRefreshCounter: number;
  triggerVisRefresh: () => void;

  codeSearchQuery: string;
  setCodeSearchQuery: (q: string) => void;

  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;

  /** Overlay coders — user IDs whose segments are shown in the document viewer */
  overlayCoderIds: string[];
  toggleOverlayCoder: (userId: string) => void;
  clearOverlayCoders: () => void;
}

export const createUiSlice = (set: (partial: any) => void): UiSlice => ({
  currentUser: "default",

  viewMode: "document",
  setViewMode: (v) => set({ viewMode: v }),

  rightPanelTab: "alerts",
  setRightPanelTab: (t) => set({ rightPanelTab: t }),

  showUploadPage: false,
  setShowUploadPage: (v) => set({ showUploadPage: v }),

  selectedVisCodeId: null,
  setSelectedVisCodeId: (id) => set({ selectedVisCodeId: id }),

  visRefreshCounter: 0,
  triggerVisRefresh: () =>
    set((s: UiSlice) => ({ visRefreshCounter: s.visRefreshCounter + 1 })),

  codeSearchQuery: "",
  setCodeSearchQuery: (q) => set({ codeSearchQuery: q }),

  docSearchQuery: "",
  setDocSearchQuery: (q) => set({ docSearchQuery: q }),

  overlayCoderIds: [],
  toggleOverlayCoder: (userId) =>
    set((s: UiSlice) => ({
      overlayCoderIds: s.overlayCoderIds.includes(userId)
        ? s.overlayCoderIds.filter((id) => id !== userId)
        : [...s.overlayCoderIds, userId],
    })),
  clearOverlayCoders: () => set({ overlayCoderIds: [] }),
});
