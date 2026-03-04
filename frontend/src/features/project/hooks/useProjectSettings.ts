import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/stores/store";
import type { ThresholdDefinition } from "@/types";
import * as api from "@/api/client";

/**
 * Encapsulates the load/save/dirty logic for project settings.
 * Returns local state for perspectives & thresholds plus save/reset helpers.
 */
export function useProjectSettings(open: boolean) {
  const projectSettings = useStore((s) => s.projectSettings);
  const loadSettings = useStore((s) => s.loadProjectSettings);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [localPerspectives, setLocalPerspectives] = useState<string[]>([]);
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
      setLocalPerspectives([...projectSettings.enabled_perspectives]);
      setLocalThresholds({ ...projectSettings.thresholds });
    }
  }, [projectSettings]);

  const available = projectSettings?.available_perspectives
    ?? Object.keys(PERSPECTIVE_META).map((id) => ({
      id,
      label: PERSPECTIVE_META[id].label,
      description: PERSPECTIVE_META[id].description,
    }));

  // Dirty checks
  const perspectivesDirty = projectSettings != null &&
    JSON.stringify([...localPerspectives].sort()) !==
    JSON.stringify([...projectSettings.enabled_perspectives].sort());

  const thresholdsDirty = projectSettings != null &&
    JSON.stringify(localThresholds) !== JSON.stringify(projectSettings.thresholds);

  const isDirty = perspectivesDirty || thresholdsDirty;

  const togglePerspective = useCallback((key: string) => {
    setLocalPerspectives((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }, []);

  const setThreshold = useCallback((key: string, value: number) => {
    setLocalThresholds((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetThreshold = useCallback((key: string) => {
    const def = thresholdDefs.find((d) => d.key === key);
    if (def) setLocalThresholds((prev) => ({ ...prev, [key]: def.default }));
  }, [thresholdDefs]);

  const save = useCallback(async () => {
    if (localPerspectives.length === 0) return;
    setSaving(true);

    const patch: { enabled_perspectives?: string[]; thresholds?: Record<string, number> } = {};
    if (perspectivesDirty) patch.enabled_perspectives = localPerspectives;
    if (thresholdsDirty) patch.thresholds = localThresholds;

    if (patch.enabled_perspectives || patch.thresholds) {
      const { activeProjectId } = useStore.getState();
      if (activeProjectId) {
        try {
          const data = await api.updateProjectSettings(activeProjectId, patch);
          useStore.setState({ projectSettings: data });
        } catch (e) {
          console.error("Failed to save settings:", e);
        }
      }
    }
    setSaving(false);
  }, [localPerspectives, localThresholds, perspectivesDirty, thresholdsDirty]);

  return {
    available,
    localPerspectives,
    localThresholds,
    thresholdDefs,
    saving,
    isDirty,
    togglePerspective,
    setThreshold,
    resetThreshold,
    save,
  };
}

// ── Static perspective metadata ─────────────────────────────────────

const PERSPECTIVE_META: Record<
  string,
  { label: string; description: string }
> = {
  self_consistency: {
    label: "Self-Consistency",
    description:
      "Checks whether you are applying this code consistently with your own past coding decisions. Detects drift and definition mismatches.",
  },
};
