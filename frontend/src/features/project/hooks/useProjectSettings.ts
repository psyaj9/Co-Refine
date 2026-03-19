import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/shared/store";
import type { ThresholdDefinition } from "@/shared/types";
import * as api from "@/shared/api/client";

/**
 * Encapsulates the load/save/dirty logic for project threshold settings.
 */
export function useProjectSettings(open: boolean) {
  const projectSettings = useStore((s) => s.projectSettings);
  const loadSettings = useStore((s) => s.loadProjectSettings);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>({});
  const [thresholdDefs, setThresholdDefs] = useState<ThresholdDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  // Load settings + threshold definitions when modal opens
  useEffect(() => {
    if (open && activeProjectId) {
      loadSettings();
      api.fetchThresholdDefinitions().then(setThresholdDefs).catch(console.error);
    }
  }, [open, activeProjectId, loadSettings]);

  // Sync local state when server data arrives
  useEffect(() => {
    if (projectSettings) {
      setLocalThresholds({ ...projectSettings.thresholds });
    }
  }, [projectSettings]);

  const isDirty = projectSettings != null &&
    JSON.stringify(localThresholds) !== JSON.stringify(projectSettings.thresholds);

  const setThreshold = useCallback((key: string, value: number) => {
    setLocalThresholds((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetThreshold = useCallback((key: string) => {
    const def = thresholdDefs.find((d) => d.key === key);
    if (def) setLocalThresholds((prev) => ({ ...prev, [key]: def.default }));
  }, [thresholdDefs]);

  const save = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    if (activeProjectId) {
      try {
        const data = await api.updateProjectSettings(activeProjectId, { thresholds: localThresholds });
        useStore.setState({ projectSettings: data });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
    setSaving(false);
  }, [localThresholds, isDirty, activeProjectId]);

  return {
    localThresholds,
    thresholdDefs,
    saving,
    isDirty,
    setThreshold,
    resetThreshold,
    save,
  };
}
