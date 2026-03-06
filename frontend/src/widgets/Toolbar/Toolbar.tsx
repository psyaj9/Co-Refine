import { useState } from "react";
import { useStore } from "@/stores/store";
import {
  FilePlus,
  Search,
  History,
  BarChart3,
  FileText,
  Sparkles,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AgentSettingsModal from "@/features/project/components/SettingsModal";
import { useToolbarKeyNav } from "./hooks/useToolbarKeyNav";

export default function Toolbar() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const showUploadPage = useStore((s) => s.showUploadPage);
  const setShowUploadPage = useStore((s) => s.setShowUploadPage);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // "Document View" is active only when actually viewing a document (not upload page)
  const isDocumentViewActive = viewMode === "document" && !!activeDocumentId && !showUploadPage;
  // "Add Document" is highlighted when the upload page is shown or no doc is selected yet
  const isAddDocActive = showUploadPage || (viewMode === "document" && !activeDocumentId);

  const { toolbarRef, handleToolbarKeyDown } = useToolbarKeyNav();

  return (
    <header className="h-10 grid grid-cols-[1fr_auto_1fr] items-center px-3 border-b panel-border panel-bg flex-shrink-0 select-none" role="banner">
      <div className="flex items-center gap-2 justify-self-start">
        <Sparkles size={16} className="text-brand-500" aria-hidden="true" />
        <h1 className="text-fluid-sm font-bold text-surface-800 dark:text-surface-100 tracking-tight">
          Co-Refine
        </h1>
        <span className="text-fluid-xs text-surface-400 dark:text-surface-500 border-l pl-2 ml-1 panel-border">
          AI-assisted qualitative analysis
        </span>
      </div>

      <div
        ref={toolbarRef}
        className="flex items-center gap-0.5 justify-self-center"
        role="toolbar"
        aria-label="View controls"
        onKeyDown={handleToolbarKeyDown}
      >
        {activeProjectId && (
          <>
            <ToolbarButton
              icon={FilePlus}
              label="Add Document"
              active={isAddDocActive}
              onClick={() => { setViewMode("document"); setShowUploadPage(true); }}
            />
            <ToolbarDivider />
            <ToolbarButton
              icon={FileText}
              label="Document View"
              active={isDocumentViewActive}
              onClick={() => { setViewMode("document"); setShowUploadPage(false); }}
            />
            <ToolbarButton
              icon={BarChart3}
              label="Visualisations"
              active={viewMode === "dashboard"}
              onClick={() => setViewMode("dashboard")}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-1 justify-self-end">
        {activeProjectId && (
          <ToolbarButton
            icon={Settings2}
            label="Settings"
            active={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          />
        )}
        {activeProjectId && activeDocumentId && !showUploadPage && (
          <ToolbarButton
            icon={History}
            label="Edit History"
            active={viewMode === "history"}
            onClick={() => setViewMode(viewMode === "history" ? "document" : "history")}
          />
        )}
      </div>
      <AgentSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Search;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300"
          : "text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-200"
      )}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-1" />;
}
