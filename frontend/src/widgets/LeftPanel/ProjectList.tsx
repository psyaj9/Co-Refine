import { useStore } from "@/stores/store";
import { Plus, X, FolderOpen } from "lucide-react";
import { useProjectActions } from "./hooks/useProjectActions";
import ProjectListItem from "./ProjectListItem";

export default function ProjectList() {
  const projects = useStore((s) => s.projects);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const {
    newProjectName,
    setNewProjectName,
    showNewProject,
    setShowNewProject,
    handleCreateProject,
    handleDeleteProject,
  } = useProjectActions();

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      <div className="p-3 border-b panel-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Projects
          </h2>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1 text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium transition-colors"
            title="New project"
            aria-label="Create new project"
          >
            <Plus size={11} aria-hidden="true" />
            New
          </button>
        </div>

        {showNewProject && (
          <div className="flex items-center gap-1 mb-2 view-enter">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              aria-label="New project name"
              className="flex-1 min-w-0 rounded border panel-border px-2 py-1 text-sm bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700 transition-colors"
              title="Create project"
              aria-label="Create project"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
            <button
              onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
              className="rounded p-1.5 text-surface-400 hover:text-surface-600 transition-colors"
              aria-label="Cancel"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 thin-scrollbar">
        {projects.length === 0 && !showNewProject ? (
          <div className="text-center py-12 view-enter">
            <FolderOpen
              className="mx-auto text-surface-300 dark:text-surface-600 mb-3"
              size={36}
              aria-hidden="true"
            />
            <p className="text-sm text-surface-500 font-medium">No projects yet</p>
            <p className="text-xs text-surface-400 mt-1">Create a project to start coding.</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="mt-4 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              aria-label="Create new project"
            >
              Create Project
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5" role="listbox" aria-label="Projects">
            {projects.map((p) => (
              <ProjectListItem
                key={p.id}
                id={p.id}
                name={p.name}
                documentCount={p.document_count}
                codeCount={p.code_count}
                onSelect={setActiveProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
