import { useState } from "react";
import { useStore } from "../stores/store";
import {
  Plus,
  Trash2,
  BookOpen,
  Upload,
  FolderOpen,
  ChevronLeft,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import * as api from "../api/client";

// Auto-assigned colour palette — 20 visually distinct colours
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
  // Fallback: random hue
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`;
}

export default function Sidebar() {
  const {
    currentUser,
    projects, activeProjectId, setActiveProject, createProject, deleteProject,
    codes, activeCodeId, setActiveCode, addCode, deleteCode, loadCodes,
    updateCodeDefinition,
    documents, activeDocumentId, setActiveDocument, loadSegments,
    deleteDocument,
    loadAnalyses,
    setShowUploadPage,
  } = useStore();

  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDefinition, setNewCodeDefinition] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [editingDefCodeId, setEditingDefCodeId] = useState<string | null>(null);
  const [editDefText, setEditDefText] = useState("");
  const [analysingCodeId, setAnalysingCodeId] = useState<string | null>(null);

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
    setAnalysingCodeId(codeId);
    try {
      await api.triggerAnalysis(codeId, currentUser);
      // Analysis now runs in background via WS — no need to await loadAnalyses
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAnalysingCodeId(null);
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this document and all its coded segments?")) return;
    await deleteDocument(id);
  };

  if (!activeProjectId) {
    return (
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Projects
            </h2>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
              title="New project"
            >
              <Plus size={11} />
              New
            </button>
          </div>

          {showNewProject && (
            <div className="flex items-center gap-1 mb-3">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="flex-1 min-w-0 rounded border border-slate-200 px-2 py-1 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                autoFocus
              />
              <button
                onClick={handleCreateProject}
                className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                title="Create project"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
                className="rounded p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {projects.length === 0 && !showNewProject ? (
            <div className="text-center py-12">
              <FolderOpen className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-sm text-slate-500 font-medium">No projects yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create a project to start coding documents.
              </p>
              <button
                onClick={() => setShowNewProject(true)}
                className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Project
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  className="group flex items-center gap-2 cursor-pointer rounded px-2 py-2 text-sm hover:bg-slate-50 transition"
                >
                  <FolderOpen size={14} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-slate-700">{p.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {p.document_count} doc{p.document_count !== 1 ? "s" : ""} · {p.code_count} code{p.code_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                    title="Delete project"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    );
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <aside className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-100 flex items-center gap-2">
        <button
          onClick={() => useStore.getState().setActiveProject("")}
          className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Back to projects"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {activeProject?.name || "Project"}
          </p>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Documents
          </h2>
          <button
            onClick={() => {
              setShowUploadPage(true);
            }}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
            title="Upload more documents"
          >
            <Upload size={11} />
            Add
          </button>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No documents yet</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-auto">
            {documents.map((doc) => (
              <li
                key={doc.id}
                onClick={() => {
                  setActiveDocument(doc.id);
                  loadSegments(doc.id);
                  setShowUploadPage(false);
                }}
                className={`group cursor-pointer rounded px-2 py-1 text-sm flex items-center gap-1 ${
                  activeDocumentId === doc.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex-1 truncate">{doc.title}</span>
                <button
                  onClick={(e) => handleDeleteDocument(e, doc.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 flex-shrink-0"
                  title="Delete document"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Codes
        </h2>

        <div className="flex items-center gap-1 mb-1">
          <input
            value={newCodeLabel}
            onChange={(e) => setNewCodeLabel(e.target.value)}
            placeholder="New code..."
            className="flex-1 min-w-0 rounded border border-slate-200 px-2 py-1 text-sm"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddCode()}
          />
          <button
            onClick={handleAddCode}
            className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700"
            title="Add code"
          >
            <Plus size={14} />
          </button>
        </div>
        {newCodeLabel.trim() && (
          <textarea
            value={newCodeDefinition}
            onChange={(e) => setNewCodeDefinition(e.target.value)}
            placeholder="Definition (optional) — what does this code mean?"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 mb-2 resize-none"
            rows={2}
          />
        )}

        <ul className="space-y-1">
          {codes.map((code) => {
            const isExpanded = expandedCodeId === code.id;
            const isEditingDef = editingDefCodeId === code.id;
            return (
              <li key={code.id}>
                <div
                  onClick={() => setActiveCode(code.id)}
                  className={`group flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition ${
                    activeCodeId === code.id
                      ? "ring-2 ring-blue-400 bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCodeId(isExpanded ? null : code.id);
                      if (isEditingDef) {
                        setEditingDefCodeId(null);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: code.colour }}
                  />
                  <span className="flex-1 text-sm truncate">{code.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {code.segment_count}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAnalyse(code.id);
                    }}
                    disabled={analysingCodeId === code.id}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 disabled:opacity-100"
                    title="Run analysis"
                  >
                    {analysingCodeId === code.id ? (
                      <Loader2 size={12} className="animate-spin text-blue-500" />
                    ) : (
                      <BookOpen size={12} />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleDeleteCode(e, code.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                    title="Delete code"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-7 mr-1 mt-1 mb-2 space-y-2">
                    {/* User definition */}
                    <div className="rounded bg-slate-50 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Definition
                        </p>
                        {!isEditingDef && (
                          <button
                            onClick={() => {
                              setEditingDefCodeId(code.id);
                              setEditDefText(code.definition || "");
                            }}
                            className="text-slate-400 hover:text-blue-600"
                            title="Edit definition"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                      {isEditingDef ? (
                        <div className="space-y-1">
                          <textarea
                            value={editDefText}
                            onChange={(e) => setEditDefText(e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditingDefCodeId(null)}
                              className="rounded p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                await updateCodeDefinition(code.id, editDefText.trim());
                                setEditingDefCodeId(null);
                              }}
                              className="rounded bg-blue-600 p-1 text-white hover:bg-blue-700"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 line-clamp-3">
                          {code.definition || (
                            <span className="italic text-slate-400">
                              No definition — click ✏ to add one
                            </span>
                          )}
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
    </aside>
  );
}
