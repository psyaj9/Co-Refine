import { useStore } from "@/stores/store";
import { FileText, Hash, FolderOpen } from "lucide-react";

export default function StatusBar() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const documents = useStore((s) => s.documents);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const agentsRunning = useStore((s) => s.agentsRunning);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <footer className="h-6 flex items-center justify-between px-3 border-t panel-border panel-bg text-2xs text-surface-400 dark:text-surface-500 flex-shrink-0 select-none">
      <div className="flex items-center gap-3">
        {activeProject ? (
          <>
            <span className="flex items-center gap-1">
              <FolderOpen size={10} />
              {activeProject.name}
            </span>
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {documents.length} doc{documents.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Hash size={10} />
              {codes.length} code{codes.length !== 1 ? "s" : ""}
            </span>
            <span>
              {segments.length} segment{segments.length !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span>No project selected</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {agentsRunning && (
          <span className="flex items-center gap-1 text-brand-500 dark:text-brand-400 animate-pulse-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
            Agents running
          </span>
        )}
        <span className="text-surface-300 dark:text-surface-600">v1.0</span>
      </div>
    </footer>
  );
}
