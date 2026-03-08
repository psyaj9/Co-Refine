import { useState } from "react";
import { X, Eye, SlidersHorizontal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectSettings } from "@/features/project/hooks/useProjectSettings";
import { useStore } from "@/stores/store";
import { triggerBatchAudit } from "@/api/client";
import ThresholdsTab from "./ThresholdsTab";

type SettingsTab = "perspectives" | "thresholds";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AgentSettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>("perspectives");
  const settings = useProjectSettings(open);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const batchAuditRunning = useStore((s) => s.batchAuditRunning);

  const handleBatchAudit = async () => {
    if (!activeProjectId || batchAuditRunning) return;
    await triggerBatchAudit(activeProjectId, "default");
  };

  if (!open) return null;

  const handleSave = async () => {
    await settings.save();
    onClose();
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
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300",
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
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300",
            )}
          >
            <SlidersHorizontal size={13} className="inline-block mr-1.5 -mt-0.5" />
            Thresholds
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {tab === "thresholds" && (
            <ThresholdsTab
              thresholdDefs={settings.thresholdDefs}
              localThresholds={settings.localThresholds}
              onSetThreshold={settings.setThreshold}
              onResetThreshold={settings.resetThreshold}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t panel-border">
          <button
            onClick={handleBatchAudit}
            disabled={!activeProjectId || batchAuditRunning}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors",
              !activeProjectId || batchAuditRunning
                ? "bg-surface-100 text-surface-400 dark:bg-surface-800 dark:text-surface-600 cursor-not-allowed"
                : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700",
            )}
            aria-label="Run batch audit across all codes"
          >
            <RefreshCw size={12} className={cn(batchAuditRunning && "animate-spin")} aria-hidden="true" />
            {batchAuditRunning ? "Auditing…" : "Run Batch Audit"}
          </button>
          <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={settings.localPerspectives.length === 0 || settings.saving || !settings.isDirty}
            className={cn(
              "px-3 py-1.5 text-xs rounded font-medium transition-colors",
              settings.localPerspectives.length === 0 || !settings.isDirty
                ? "bg-surface-200 text-surface-400 cursor-not-allowed"
                : "bg-brand-600 text-white hover:bg-brand-700",
            )}
          >
            {settings.saving ? "Saving…" : "Save"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
