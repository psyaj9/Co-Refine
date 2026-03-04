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

  /** Increment to trigger a facet data refetch in FacetExplorerTab */
  facetRefreshTrigger: number;
  incrementFacetRefreshTrigger: () => void;

  codeSearchQuery: string;
  setCodeSearchQuery: (q: string) => void;

  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;
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

  facetRefreshTrigger: 0,
  incrementFacetRefreshTrigger: () =>
    set((s: UiSlice) => ({ facetRefreshTrigger: s.facetRefreshTrigger + 1 })),

  codeSearchQuery: "",
  setCodeSearchQuery: (q) => set({ codeSearchQuery: q }),

  docSearchQuery: "",
  setDocSearchQuery: (q) => set({ docSearchQuery: q }),
});
