import { useCallback } from "react";
import { useStore } from "@/shared/store";
import * as api from "@/shared/api/client";
import { getNextColour } from "@/shared/lib/constants";

/**
 * Business logic for creating, deleting, and analysing codes.
 * Extracted from CodesTabContent to keep the component UI-only.
 */
export function useCodeActions() {
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
        await api.triggerAnalysis(codeId);
        await loadAnalyses();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Analysis failed");
      }
    },
    [loadAnalyses],
  );

  return { handleAddCode, handleDeleteCode, handleAnalyse };
}
