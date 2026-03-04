import { useCallback } from "react";
import { useStore } from "@/stores/store";
import * as api from "@/api/client";
import { getNextColour } from "@/lib/constants";

/**
 * Business logic for creating, deleting, and analysing codes.
 * Extracted from CodesTabContent to keep the component UI-only.
 */
export function useCodeActions() {
  const currentUser = useStore((s) => s.currentUser);
  const codes = useStore((s) => s.codes);
  const addCode = useStore((s) => s.addCode);
  const deleteCode = useStore((s) => s.deleteCode);
  const loadAnalyses = useStore((s) => s.loadAnalyses);

  const handleAddCode = useCallback(
    async (label: string, definition: string) => {
      if (!label.trim()) return;
      const colour = getNextColour(codes);
      await addCode(label.trim(), colour, definition.trim() || undefined);
    },
    [codes, addCode],
  );

  const handleDeleteCode = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await deleteCode(id);
    },
    [deleteCode],
  );

  const handleAnalyse = useCallback(
    async (codeId: string) => {
      try {
        await api.triggerAnalysis(codeId, currentUser);
        await loadAnalyses();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Analysis failed");
      }
    },
    [currentUser, loadAnalyses],
  );

  return { handleAddCode, handleDeleteCode, handleAnalyse };
}
