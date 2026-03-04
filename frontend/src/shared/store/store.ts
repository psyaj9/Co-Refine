import { create } from "zustand";

import { createUiSlice, type UiSlice } from "./slices/uiSlice";
import { createProjectSlice, type ProjectSlice } from "./slices/projectSlice";
import { createDocumentSlice, type DocumentSlice } from "./slices/documentSlice";
import { createCodeSlice, type CodeSlice } from "./slices/codeSlice";
import { createSegmentSlice, type SegmentSlice } from "./slices/segmentSlice";
import { createAuditSlice, type AuditSlice } from "./slices/auditSlice";
import { createChatSlice, type ChatSlice } from "./slices/chatSlice";
import { createHistorySlice, type HistorySlice } from "./slices/historySlice";

/**
 * Full application state — the union of all domain slices.
 *
 * Cross-slice access is available via `get()` inside any slice creator.
 * Consumers always import `useStore` from `@/shared/store` (or the shim at
 * `@/stores/store`) and select the exact fields they need:
 *
 *   const codes = useStore((s) => s.codes)
 */
export type AppState = UiSlice &
  ProjectSlice &
  DocumentSlice &
  CodeSlice &
  SegmentSlice &
  AuditSlice &
  ChatSlice &
  HistorySlice;

export const useStore = create<AppState>()((set, get) => ({
  ...createUiSlice(set as any),
  ...createProjectSlice(set as any, get),
  ...createDocumentSlice(set as any, get),
  ...createCodeSlice(set as any, get),
  ...createSegmentSlice(set as any, get),
  ...createAuditSlice(set as any, get),
  ...createChatSlice(set as any, get),
  ...createHistorySlice(set as any, get),
}));
