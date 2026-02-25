import { useState } from "react";
import { useStore } from "@/stores/store";
import {
  Plus,
  Trash2,
  Upload,
  FolderOpen,
  ChevronLeft,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  BookOpen,
  Search,
  FileText,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "@/api/client";

const COLOUR_PALETTE = [
  "#F44336", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
  "#00BCD4", "#E91E63", "#8BC34A", "#FF5722", "#3F51B5",
  "#009688", "#FFC107", "#673AB7", "#CDDC39", "#795548",
  "#607D8B", "#03A9F4", "#FFEB3B", "#1B5E20", "#AD1457",
];

function getNextColour(existingCodes: { colour: string }[]): string {
  const used = new Set(existingCodes.map((c) => c.colour));
  for (const colour of COLOUR_PALETTE) {
    if (!used.has(colour)) return colour;
  }
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`;
}

export default function ProjectExplorer() {
  const {
    currentUser,
    projects, activeProjectId, setActiveProject, createProject, deleteProject,
    codes, activeCodeId, setActiveCode, addCode, deleteCode, loadCodes,
    updateCodeDefinition,
    documents, activeDocumentId, setActiveDocument, loadSegments,
    deleteDocument,
    analyses, loadAnalyses, loadRetrievedSegments,
    setShowUploadPage,
    codeSearchQuery, setCodeSearchQuery,
    docSearchQuery, setDocSearchQuery,
  } = useStore();

  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDefinition, setNewCodeDefinition] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [editingDefCodeId, setEditingDefCodeId] = useState<string | null>(null);
  const [editDefText, setEditDefText] = useState("");
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [codesExpanded, setCodesExpanded] = useState(true);

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

  const handleAddCode = async () => {
    if (!newCodeLabel.trim()) return;
    const colour = getNextColour(codes);
    await addCode(newCodeLabel.trim(), colour, newCodeDefinition.trim() || undefined);
    setNewCodeLabel("");
    setNewCodeDefinition("");
  };

  const handleDeleteCode = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteCode(id);
  };

  const handleAnalyse = async (codeId: string) => {
    try {
      await api.triggerAnalysis(codeId, currentUser);
      await loadAnalyses();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this document and all its coded segments?")) return;
    await deleteDocument(id);
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(docSearchQuery.toLowerCase())
  );
  const filteredCodes = codes.filter((c) =>
    c.label.toLowerCase().includes(codeSearchQuery.toLowerCase())
  );

  // --- Project list view ---
  if (!activeProjectId) {
    return (
      <div className="flex flex-col h-full panel-bg overflow-hidden">
        <div className="p-3 border-b panel-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Projects
            </h2>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1 text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
              title="New project"
            >
              <Plus size={11} />
              New
            </button>
          </div>

          {showNewProject && (
            <div className="flex items-center gap-1 mb-2">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="flex-1 min-w-0 rounded border panel-border px-2 py-1 text-sm bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                autoFocus
              />
              <button onClick={handleCreateProject} className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700" title="Create project">
                <Plus size={14} />
              </button>
              <button onClick={() => { setShowNewProject(false); setNewProjectName(""); }} className="rounded p-1.5 text-surface-400 hover:text-surface-600">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3 thin-scrollbar">
          {projects.length === 0 && !showNewProject ? (
            <div className="text-center py-12">
              <FolderOpen className="mx-auto text-surface-300 dark:text-surface-600 mb-3" size={36} />
              <p className="text-sm text-surface-500 font-medium">No projects yet</p>
              <p className="text-xs text-surface-400 mt-1">Create a project to start coding.</p>
              <button
                onClick={() => setShowNewProject(true)}
                className="mt-4 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create Project
              </button>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {projects.map((p) => (
                <li
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  className="group flex items-center gap-2 cursor-pointer rounded px-2 py-2 text-sm panel-hover transition"
                >
                  <FolderOpen size={14} className="text-surface-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-surface-700 dark:text-surface-200">{p.name}</p>
                    <p className="text-2xs text-surface-400">
                      {p.document_count} doc{p.document_count !== 1 ? "s" : ""} · {p.code_count} code{p.code_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500"
                    title="Delete project"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // --- Project active view ---
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      {/* Project header */}
      <div className="p-2 border-b panel-border flex items-center gap-2">
        <button
          onClick={() => useStore.getState().setActiveProject("")}
          className="rounded p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
          title="Back to projects"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-surface-700 dark:text-surface-200 truncate">
            {activeProject?.name || "Project"}
          </p>
        </div>
      </div>

      {/* Documents section */}
      <div className="border-b panel-border">
        <button
          onClick={() => setDocsExpanded(!docsExpanded)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800"
        >
          {docsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <FileText size={10} />
          Documents
          <span className="ml-auto text-surface-300 dark:text-surface-600 font-normal normal-case">
            {documents.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setShowUploadPage(true); }}
            className="ml-1 text-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
            title="Add document"
          >
            <Upload size={10} />
          </button>
        </button>

        {docsExpanded && (
          <div className="px-2 pb-2">
            {documents.length > 3 && (
              <div className="relative mb-1">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="w-full rounded border panel-border pl-6 pr-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
            )}
            <ul className="space-y-0.5 max-h-36 overflow-auto thin-scrollbar">
              {filteredDocs.map((doc) => (
                <li
                  key={doc.id}
                  onClick={() => {
                    setActiveDocument(doc.id);
                    loadSegments(doc.id);
                    setShowUploadPage(false);
                  }}
                  className={cn(
                    "group cursor-pointer rounded px-2 py-1 text-xs flex items-center gap-1.5 transition",
                    activeDocumentId === doc.id
                      ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                      : "text-surface-600 dark:text-surface-300 panel-hover"
                  )}
                >
                  <FileText size={11} className="flex-shrink-0 text-surface-400" />
                  <span className="flex-1 truncate">{doc.title}</span>
                  <button
                    onClick={(e) => handleDeleteDocument(e, doc.id)}
                    className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500 flex-shrink-0"
                    title="Delete document"
                  >
                    <Trash2 size={10} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Codes section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={() => setCodesExpanded(!codesExpanded)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800 flex-shrink-0"
        >
          {codesExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Hash size={10} />
          Codebook
          <span className="ml-auto text-surface-300 dark:text-surface-600 font-normal normal-case">
            {codes.length}
          </span>
        </button>

        {codesExpanded && (
          <div className="flex-1 overflow-auto px-2 pb-2 thin-scrollbar">
            {/* Search */}
            {codes.length > 3 && (
              <div className="relative mb-1">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  value={codeSearchQuery}
                  onChange={(e) => setCodeSearchQuery(e.target.value)}
                  placeholder="Filter codes..."
                  className="w-full rounded border panel-border pl-6 pr-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
            )}

            {/* Add code */}
            <div className="flex items-center gap-1 mb-1">
              <input
                value={newCodeLabel}
                onChange={(e) => setNewCodeLabel(e.target.value)}
                placeholder="New code..."
                className="flex-1 min-w-0 rounded border panel-border px-2 py-0.5 text-xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddCode()}
              />
              <button onClick={handleAddCode} className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700" title="Add code">
                <Plus size={12} />
              </button>
            </div>
            {newCodeLabel.trim() && (
              <textarea
                value={newCodeDefinition}
                onChange={(e) => setNewCodeDefinition(e.target.value)}
                placeholder="Definition (optional)..."
                className="w-full rounded border panel-border px-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 mb-1 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                rows={2}
              />
            )}

            {/* Code list */}
            <ul className="space-y-0.5">
              {filteredCodes.map((code) => {
                const analysis = analyses.find((a) => a.code_id === code.id);
                const isExpanded = expandedCodeId === code.id;
                const isEditingDef = editingDefCodeId === code.id;

                return (
                  <li key={code.id}>
                    <div
                      onClick={() => setActiveCode(code.id)}
                      onDoubleClick={() => loadRetrievedSegments(code.id)}
                      className={cn(
                        "group flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer transition text-xs",
                        activeCodeId === code.id
                          ? "ring-1 ring-brand-400 bg-brand-50 dark:bg-brand-900/20"
                          : "panel-hover"
                      )}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCodeId(isExpanded ? null : code.id);
                          if (isEditingDef) setEditingDefCodeId(null);
                        }}
                        className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex-shrink-0"
                      >
                        {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      </button>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: code.colour }}
                      />
                      <span className="flex-1 truncate text-surface-700 dark:text-surface-200">
                        {code.label}
                      </span>
                      <span className="text-2xs text-surface-400 font-mono w-4 text-right flex-shrink-0">
                        {code.segment_count}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAnalyse(code.id); }}
                        className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-brand-600"
                        title="Run analysis"
                      >
                        <BookOpen size={10} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCode(e, code.id)}
                        className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500"
                        title="Delete code"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Expanded: definitions */}
                    {isExpanded && (
                      <div className="ml-6 mr-1 mt-1 mb-2 space-y-1.5">
                        {/* User definition */}
                        <div className="rounded bg-surface-50 dark:bg-surface-800 p-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-2xs uppercase tracking-wider text-surface-400 font-semibold">Definition</p>
                            {!isEditingDef && (
                              <button
                                onClick={() => { setEditingDefCodeId(code.id); setEditDefText(code.definition || ""); }}
                                className="text-surface-400 hover:text-brand-600"
                                title="Edit definition"
                              >
                                <Pencil size={9} />
                              </button>
                            )}
                          </div>
                          {isEditingDef ? (
                            <div className="space-y-1">
                              <textarea
                                value={editDefText}
                                onChange={(e) => setEditDefText(e.target.value)}
                                className="w-full rounded border panel-border px-2 py-1 text-2xs bg-transparent dark:text-surface-300 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setEditingDefCodeId(null)} className="rounded p-1 text-surface-400 hover:text-surface-600">
                                  <X size={10} />
                                </button>
                                <button
                                  onClick={async () => { await updateCodeDefinition(code.id, editDefText.trim()); setEditingDefCodeId(null); }}
                                  className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700"
                                >
                                  <Check size={10} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-2xs text-surface-500 dark:text-surface-400 line-clamp-3">
                              {code.definition || <span className="italic text-surface-400">No definition — click ✏ to add</span>}
                            </p>
                          )}
                        </div>


                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
