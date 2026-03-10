import { useStore } from "@/shared/store";
import { ChevronLeft, Upload, PanelLeftClose } from "lucide-react";

interface ProjectHeaderProps {
  onCollapse?: () => void;
}

export default function ProjectHeader({ onCollapse }: ProjectHeaderProps) {
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setShowUploadPage = useStore((s) => s.setShowUploadPage);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="p-2 border-b panel-border flex items-center gap-2 flex-shrink-0">
      <button
        onClick={() => useStore.getState().setActiveProject("")}
        className="rounded p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        title="Back to projects"
        aria-label="Back to projects"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <p className="flex-1 min-w-0 text-xs font-semibold text-surface-700 dark:text-surface-200 truncate">
        {activeProject?.name || "Project"}
      </p>
      <button
        onClick={() => setShowUploadPage(true)}
        className="rounded p-1 text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
        title="Upload document"
        aria-label="Upload document"
      >
        <Upload size={12} aria-hidden="true" />
      </button>
      {onCollapse && (
        <button
          onClick={onCollapse}
          className="rounded p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          title="Collapse panel (Ctrl+B)"
          aria-label="Collapse left panel"
        >
          <PanelLeftClose size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
