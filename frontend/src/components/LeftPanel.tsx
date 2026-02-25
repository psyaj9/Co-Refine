import { useState, useCallback } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/store";
import {
  Plus,
  X,
  FolderOpen,
  ChevronLeft,
  ChevronDown,
  FileText,
  Hash,
  Upload,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { collapsible, easeMedium, listItem } from "@/lib/motion";
import DocumentsTabContent from "@/components/DocumentsTabContent";
import CodesTabContent from "@/components/CodesTabContent";

export default function LeftPanel() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const [docsOpen, setDocsOpen] = useState(true);
  const [codesOpen, setCodesOpen] = useState(true);
  const reduced = useReducedMotion();

  if (!activeProjectId) return <ProjectList />;

  /** Trigger class shared by both section headers */
  const triggerCn = cn(
    "flex items-center gap-1.5 px-2 py-2 border-b panel-border flex-shrink-0 cursor-pointer transition-colors",
    "text-2xs font-semibold uppercase tracking-wider",
    "text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800",
    "focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-[-2px]"
  );

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      <ProjectHeader />

      {/* Both sections share flex-1 so each gets 50% when both open, 100% when alone */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* ---- DOCUMENTS ---- */}
        <Collapsible.Root
          open={docsOpen}
          onOpenChange={setDocsOpen}
          className={cn("flex flex-col min-h-0 overflow-hidden", docsOpen && "flex-1")}
        >
          <Collapsible.Trigger
            className={triggerCn}
            aria-label={docsOpen ? "Collapse documents section" : "Expand documents section"}
          >
            <ChevronDown
              size={10}
              className={cn("transition-transform duration-200", !docsOpen && "-rotate-90")}
              aria-hidden="true"
            />
            <FileText size={10} aria-hidden="true" />
            <span>Documents</span>
          </Collapsible.Trigger>

          <AnimatePresence initial={false}>
            {docsOpen && (
              <motion.div
                key="docs-content"
                initial={reduced ? false : "closed"}
                animate="open"
                exit="closed"
                variants={collapsible}
                transition={easeMedium}
                className="flex-1 min-h-0 overflow-hidden"
              >
                <DocumentsTabContent />
              </motion.div>
            )}
          </AnimatePresence>
        </Collapsible.Root>

        {/* ---- CODES ---- */}
        <Collapsible.Root
          open={codesOpen}
          onOpenChange={setCodesOpen}
          className={cn("flex flex-col min-h-0 overflow-hidden", codesOpen && "flex-1")}
        >
          <Collapsible.Trigger
            className={triggerCn}
            aria-label={codesOpen ? "Collapse codes section" : "Expand codes section"}
          >
            <ChevronDown
              size={10}
              className={cn("transition-transform duration-200", !codesOpen && "-rotate-90")}
              aria-hidden="true"
            />
            <Hash size={10} aria-hidden="true" />
            <span>Codes</span>
          </Collapsible.Trigger>

          <AnimatePresence initial={false}>
            {codesOpen && (
              <motion.div
                key="codes-content"
                initial={reduced ? false : "closed"}
                animate="open"
                exit="closed"
                variants={collapsible}
                transition={easeMedium}
                className="flex-1 min-h-0 overflow-hidden"
              >
                <CodesTabContent />
              </motion.div>
            )}
          </AnimatePresence>
        </Collapsible.Root>
      </div>
    </div>
  );
}

function ProjectHeader() {
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
    </div>
  );
}

function ProjectList() {
  const projects = useStore((s) => s.projects);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const createProject = useStore((s) => s.createProject);
  const deleteProject = useStore((s) => s.deleteProject);

  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
    setActiveProject(project.id);
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project and ALL its documents, codes, and analyses?")) return;
    await deleteProject(id);
  };

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
              onClick={() => {
                setShowNewProject(false);
                setNewProjectName("");
              }}
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
            <p className="text-xs text-surface-400 mt-1">
              Create a project to start coding.
            </p>
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
              <li
                key={p.id}
                role="option"
                aria-selected={false}
                tabIndex={0}
                onClick={() => setActiveProject(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveProject(p.id);
                  }
                }}
                className="group flex items-center gap-2 cursor-pointer rounded px-2 py-2 text-sm panel-hover transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              >
                <FolderOpen
                  size={14}
                  className="text-surface-400 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-surface-700 dark:text-surface-200">
                    {p.name}
                  </p>
                  <p className="text-2xs text-surface-400">
                    {p.document_count} doc{p.document_count !== 1 ? "s" : ""} ·{" "}
                    {p.code_count} code{p.code_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteProject(e, p.id)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-surface-400 hover:text-red-500 transition-opacity"
                  title="Delete project"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

