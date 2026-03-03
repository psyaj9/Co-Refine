import { useEffect, useState } from "react";
import { useStore } from "@/stores/store";
import { X, Eye, Info, SlidersHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThresholdDefinition } from "@/types";
import * as api from "@/api/client";

const PERSPECTIVE_META: Record<
  string,
  { label: string; description: string; icon: typeof Eye }
> = {
  self_consistency: {
    label: "Self-Consistency",
    description:
      "Checks whether you are applying this code consistently with your own past coding decisions. Detects drift and definition mismatches.",
    icon: Eye,
  },
};

type SettingsTab = "perspectives" | "thresholds";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AgentSettingsModal({ open, onClose }: Props) {
  const projectSettings = useStore((s) => s.projectSettings);
  const loadSettings = useStore((s) => s.loadProjectSettings);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [tab, setTab] = useState<SettingsTab>("perspectives");
  const [localPerspectives, setLocalPerspectives] = useState<string[]>([]);
  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>({});
  const [thresholdDefs, setThresholdDefs] = useState<ThresholdDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && activeProjectId) {
      loadSettings();
      api.fetchThresholdDefinitions().then(setThresholdDefs).catch(console.error);
    }
  }, [open, activeProjectId, loadSettings]);

  useEffect(() => {
    if (projectSettings) {
      setLocalPerspectives([...projectSettings.enabled_perspectives]);
      setLocalThresholds({ ...projectSettings.thresholds });
    }
  }, [projectSettings]);

  if (!open) return null;

  const available = projectSettings?.available_perspectives ?? Object.keys(PERSPECTIVE_META).map(id => ({
    id,
    label: PERSPECTIVE_META[id].label,
    description: PERSPECTIVE_META[id].description
  }));

  const toggle = (key: string) => {
    setLocalPerspectives((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (localPerspectives.length === 0) return;
    setSaving(true);

    // Build patch: only send what changed
    const patch: { enabled_perspectives?: string[]; thresholds?: Record<string, number> } = {};

    const perspectivesDirty = projectSettings &&
      JSON.stringify([...localPerspectives].sort()) !==
      JSON.stringify([...projectSettings.enabled_perspectives].sort());
    if (perspectivesDirty) {
      patch.enabled_perspectives = localPerspectives;
    }

    const thresholdsDirty = projectSettings &&
      JSON.stringify(localThresholds) !== JSON.stringify(projectSettings.thresholds);
    if (thresholdsDirty) {
      patch.thresholds = localThresholds;
    }

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
    onClose();
  };

  const perspectivesDirty = projectSettings &&
    JSON.stringify([...localPerspectives].sort()) !==
    JSON.stringify([...projectSettings.enabled_perspectives].sort());
  const thresholdsDirty = projectSettings &&
    JSON.stringify(localThresholds) !== JSON.stringify(projectSettings.thresholds);
  const isDirty = perspectivesDirty || thresholdsDirty;

  const resetThreshold = (key: string) => {
    const def = thresholdDefs.find((d) => d.key === key);
    if (def) setLocalThresholds((prev) => ({ ...prev, [key]: def.default }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Project Settings"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white dark:bg-surface-900 shadow-xl border panel-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b panel-border">
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b panel-border px-5">
          <button
            onClick={() => setTab("perspectives")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "perspectives"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            )}
          >
            <Eye size={13} className="inline-block mr-1.5 -mt-0.5" />
            Perspectives
          </button>
          <button
            onClick={() => setTab("thresholds")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "thresholds"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            )}
          >
            <SlidersHorizontal size={13} className="inline-block mr-1.5 -mt-0.5" />
            Thresholds
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {tab === "perspectives" && (
            <div className="space-y-3">
              <p className="text-xs text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
                <Info size={14} className="mt-0.5 shrink-0" />
                Choose which AI perspectives run during the coding audit.
                At least one must be enabled.
              </p>

              {available.map((perspective) => {
                const key = perspective.id;
                const meta = PERSPECTIVE_META[key] ?? {
                  label: perspective.label,
                  description: perspective.description,
                  icon: Eye,
                };
                const Icon = meta.icon;
                const enabled = localPerspectives.includes(key);

                return (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      enabled
                        ? "border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
                        : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        enabled
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-surface-300 dark:border-surface-600"
                      )}
                    >
                      {enabled && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          size={14}
                          className={cn(
                            enabled
                              ? "text-brand-600 dark:text-brand-400"
                              : "text-surface-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            enabled
                              ? "text-brand-700 dark:text-brand-300"
                              : "text-surface-600 dark:text-surface-300"
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "thresholds" && (
            <div className="space-y-4">
              <p className="text-xs text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
                <Info size={14} className="mt-0.5 shrink-0" />
                Adjust thresholds that control when AI agents escalate, warn, or trigger analysis.
                Changes apply to this project only.
              </p>

              {thresholdDefs.map((def) => {
                const value = localThresholds[def.key] ?? def.default;
                const isDefault = value === def.default;
                return (
                  <div key={def.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-surface-700 dark:text-surface-200">
                        {def.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-surface-500 tabular-nums">
                          {def.type === "int" ? value : value.toFixed(2)}
                        </span>
                        {!isDefault && (
                          <button
                            onClick={() => resetThreshold(def.key)}
                            className="text-surface-400 hover:text-brand-500 transition-colors"
                            title={`Reset to default (${def.default})`}
                            aria-label={`Reset ${def.label} to default`}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      value={value}
                      onChange={(e) => {
                        const v = def.type === "int" ? parseInt(e.target.value) : parseFloat(e.target.value);
                        setLocalThresholds((prev) => ({ ...prev, [def.key]: v }));
                      }}
                      className="w-full h-1.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-surface-400 dark:text-surface-500 leading-relaxed">
                      {def.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t panel-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              localPerspectives.length === 0 || saving || !isDirty
            }
            className={cn(
              "px-3 py-1.5 text-xs rounded font-medium transition-colors",
              localPerspectives.length === 0 || !isDirty
                ? "bg-surface-200 text-surface-400 cursor-not-allowed"
                : "bg-brand-600 text-white hover:bg-brand-700"
            )}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
