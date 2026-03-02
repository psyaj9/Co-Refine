import { useEffect, useState } from "react";
import { useStore } from "@/stores/store";
import { X, Eye, Users, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  inter_rater: {
    label: "Inter-Rater Reliability",
    description:
      "Simulates an independent second researcher coding the same segment. Flags conflicts and suggests alternative codes.",
    icon: Users,
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AgentSettingsModal({ open, onClose }: Props) {
  const projectSettings = useStore((s) => s.projectSettings);
  const updateSettings = useStore((s) => s.updateProjectSettings);
  const loadSettings = useStore((s) => s.loadProjectSettings);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [localPerspectives, setLocalPerspectives] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && activeProjectId) {
      loadSettings();
    }
  }, [open, activeProjectId, loadSettings]);

  useEffect(() => {
    if (projectSettings) {
      setLocalPerspectives([...projectSettings.enabled_perspectives]);
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
    if (localPerspectives.length === 0) return; // must keep at least one
    setSaving(true);
    await updateSettings(localPerspectives);
    setSaving(false);
    onClose();
  };

  const isDirty =
    projectSettings &&
    JSON.stringify([...localPerspectives].sort()) !==
      JSON.stringify([...projectSettings.enabled_perspectives].sort());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Agent Perspectives Settings"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-surface-900 shadow-xl border panel-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b panel-border">
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
            Agent Perspectives
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
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
