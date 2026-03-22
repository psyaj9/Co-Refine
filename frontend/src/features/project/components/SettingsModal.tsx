import { useState } from "react";
import { X, SlidersHorizontal, RefreshCw, Users, FlaskConical } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useProjectSettings } from "@/features/project/hooks/useProjectSettings";
import { useStore } from "@/shared/store";
import { triggerBatchAudit } from "@/shared/api/client";
import ThresholdsTab from "./ThresholdsTab";
import MembersTab from "./MembersTab";

type SettingsTab = "thresholds" | "members" | "experiment";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>("thresholds");
  const settings = useProjectSettings(open);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const batchAuditRunning = useStore((s) => s.batchAuditRunning);
  const hideAlerts = useStore((s) => s.hideAlerts);
  const setHideAlerts = useStore((s) => s.setHideAlerts);

  const handleBatchAudit = async () => {
    if (!activeProjectId || batchAuditRunning) return;
    await triggerBatchAudit(activeProjectId);
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
          <button
            onClick={() => setTab("members")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "members"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300",
            )}
          >
            <Users size={13} className="inline-block mr-1.5 -mt-0.5" />
            Members
          </button>
          <button
            onClick={() => setTab("experiment")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "experiment"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300",
            )}
          >
            <FlaskConical size={13} className="inline-block mr-1.5 -mt-0.5" />
            Experiment
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
          {tab === "members" && activeProjectId && (
            <MembersTab projectId={activeProjectId} />
          )}
          {tab === "experiment" && (
            <div className="space-y-4">
              <p className="text-xs text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
                <FlaskConical size={14} className="mt-0.5 shrink-0" />
                Controls for experimental conditions. Changes take effect immediately and are not persisted.
              </p>
              <div className="flex items-center justify-between py-2 border-b panel-border">
                <div>
                  <p className="text-xs font-medium text-surface-700 dark:text-surface-200">
                    Hide AI alerts
                  </p>
                  <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-0.5">
                    Suppresses all AI-generated alerts from the Alerts panel. Agents still run in the background.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={hideAlerts}
                  aria-label="Toggle hide AI alerts"
                  onClick={() => setHideAlerts(!hideAlerts)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    hideAlerts ? "bg-brand-600" : "bg-surface-300 dark:bg-surface-600",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                      hideAlerts ? "translate-x-4" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            </div>
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
            disabled={settings.saving || !settings.isDirty}
            className={cn(
              "px-3 py-1.5 text-xs rounded font-medium transition-colors",
              !settings.isDirty
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
