import { useState } from "react";
import { useStore } from "@/stores/store";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  BookOpen,
  Search,
  Tag,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNextColour } from "@/lib/constants";
import * as api from "@/api/client";
import RetrievedSegments from "@/components/RetrievedSegments";
import type { CodeOut, AnalysisOut } from "@/types";

export default function CodesTabContent() {
  const currentUser = useStore((s) => s.currentUser);
  const codes = useStore((s) => s.codes);
  const activeCodeId = useStore((s) => s.activeCodeId);
  const setActiveCode = useStore((s) => s.setActiveCode);
  const addCode = useStore((s) => s.addCode);
  const deleteCode = useStore((s) => s.deleteCode);
  const updateCode = useStore((s) => s.updateCode);
  const analyses = useStore((s) => s.analyses);
  const loadAnalyses = useStore((s) => s.loadAnalyses);
  const loadRetrievedSegments = useStore((s) => s.loadRetrievedSegments);
  const codeSearchQuery = useStore((s) => s.codeSearchQuery);
  const setCodeSearchQuery = useStore((s) => s.setCodeSearchQuery);
  const retrievedCodeId = useStore((s) => s.retrievedCodeId);

  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDefinition, setNewCodeDefinition] = useState("");
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [editingDefCodeId, setEditingDefCodeId] = useState<string | null>(null);
  const [editDefText, setEditDefText] = useState("");

  const filteredCodes = codes.filter((c) =>
    c.label.toLowerCase().includes(codeSearchQuery.toLowerCase())
  );

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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Analysis failed");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <div className="flex items-center gap-1 mb-1">
          <input
            value={newCodeLabel}
            onChange={(e) => setNewCodeLabel(e.target.value)}
            placeholder="New code..."
            aria-label="New code name"
            className="flex-1 min-w-0 rounded border panel-border px-2 py-0.5 text-xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddCode()}
          />
          <button
            onClick={handleAddCode}
            className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700 transition-colors"
            title="Add code"
            aria-label="Add code"
          >
            <Plus size={12} aria-hidden="true" />
          </button>
        </div>
        {newCodeLabel.trim() && (
          <textarea
            value={newCodeDefinition}
            onChange={(e) => setNewCodeDefinition(e.target.value)}
            placeholder="Definition (optional)..."
            aria-label="Code definition"
            className="w-full rounded border panel-border px-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 mb-1 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
            rows={2}
          />
        )}
        {codes.length > 3 && (
          <div className="relative mb-1">
            <Search
              size={10}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400"
              aria-hidden="true"
            />
            <input
              value={codeSearchQuery}
              onChange={(e) => setCodeSearchQuery(e.target.value)}
              placeholder="Filter codes..."
              aria-label="Filter codes"
              className="w-full rounded border panel-border pl-6 pr-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
        )}
      </div>

      <ul className="flex-1 overflow-auto px-2 pb-2 thin-scrollbar space-y-0.5" role="listbox" aria-label="Codebook">
          {filteredCodes.map((code) => {
            const isExpanded = expandedCodeId === code.id;
            const isEditingDef = editingDefCodeId === code.id;

            return (
              <li
                key={code.id}
              >
                <div
                  role="option"
                  aria-selected={activeCodeId === code.id}
                  tabIndex={0}
                  onClick={() => setActiveCode(code.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadRetrievedSegments(code.id);
                      setExpandedCodeId(code.id);
                    }
                    if (e.key === " ") {
                      e.preventDefault();
                      setActiveCode(code.id);
                    }
                  }}
                  onDoubleClick={() => {
                    loadRetrievedSegments(code.id);
                    setExpandedCodeId(code.id);
                  }}
                  className={cn(
                    "group flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer transition-colors text-xs",
                    "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                    activeCodeId === code.id
                      ? "ring-1 ring-brand-400 bg-brand-50 dark:bg-brand-900/20"
                      : "panel-hover"
                  )}
                  title="Space to select · Enter to load segments"
                >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCodeId(isExpanded ? null : code.id);
                    if (isEditingDef) setEditingDefCodeId(null);
                  }}
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex-shrink-0"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${code.label}`}
                >
                  {isExpanded ? (
                    <ChevronDown size={10} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={10} aria-hidden="true" />
                  )}
                </button>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: code.colour }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-surface-700 dark:text-surface-200">
                  {code.label}
                </span>
                <span className="text-2xs text-surface-400 font-mono w-4 text-right flex-shrink-0">
                  {code.segment_count}
                </span>
                <button
                  onClick={(e) => handleDeleteCode(e, code.id)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-surface-400 hover:text-red-500 transition-opacity"
                  title="Delete code"
                  aria-label={`Delete ${code.label}`}
                >
                  <Trash2 size={10} aria-hidden="true" />
                </button>
                </div>

                {isExpanded && (
                  <ExpandedCodeDetail
                  code={code}
                  isEditingDef={isEditingDef}
                  editDefText={editDefText}
                  setEditDefText={setEditDefText}
                  setEditingDefCodeId={setEditingDefCodeId}
                  updateCodeDefinition={(id, def) => updateCode(id, { definition: def })}
                  loadRetrievedSegments={loadRetrievedSegments}
                  setExpandedCodeId={setExpandedCodeId}
                  handleAnalyse={handleAnalyse}
                  retrievedCodeId={retrievedCodeId}
                  analyses={analyses}
                />
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

interface ExpandedCodeDetailProps {
  code: CodeOut;
  isEditingDef: boolean;
  editDefText: string;
  setEditDefText: (v: string) => void;
  setEditingDefCodeId: (id: string | null) => void;
  updateCodeDefinition: (id: string, def: string) => Promise<void>;
  loadRetrievedSegments: (codeId: string) => Promise<void>;
  setExpandedCodeId: (id: string | null) => void;
  handleAnalyse: (codeId: string) => void;
  retrievedCodeId: string | null;
  analyses: AnalysisOut[];
}

function ExpandedCodeDetail({
  code,
  isEditingDef,
  editDefText,
  setEditDefText,
  setEditingDefCodeId,
  updateCodeDefinition,
  loadRetrievedSegments,
  setExpandedCodeId,
  handleAnalyse,
  retrievedCodeId,
  analyses,
}: ExpandedCodeDetailProps): React.ReactElement {
  const analysis = analyses.find((a) => a.code_id === code.id);

  return (
    <div className="ml-6 mr-1 mt-1 mb-2 space-y-1.5 tab-content-enter">
      <div className="rounded bg-surface-50 dark:bg-surface-800 p-2">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-2xs uppercase tracking-wider text-surface-400 font-semibold">
            Your Definition
          </p>
          {!isEditingDef && (
            <button
              onClick={() => {
                setEditingDefCodeId(code.id);
                setEditDefText(code.definition || "");
              }}
              className="text-surface-400 hover:text-brand-600 transition-colors"
              title="Edit definition"
              aria-label={`Edit definition for ${code.label}`}
            >
              <Pencil size={9} aria-hidden="true" />
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
              aria-label="Code definition"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setEditingDefCodeId(null)}
                className="rounded p-1 text-surface-400 hover:text-surface-600 transition-colors"
                aria-label="Cancel editing"
              >
                <X size={10} aria-hidden="true" />
              </button>
              <button
                onClick={async () => {
                  await updateCodeDefinition(code.id, editDefText.trim());
                  setEditingDefCodeId(null);
                }}
                className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700 transition-colors"
                aria-label="Save definition"
              >
                <Check size={10} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-2xs text-surface-500 dark:text-surface-400 line-clamp-3">
            {code.definition || (
              <span className="italic text-surface-400">
                No definition — click pencil to add
              </span>
            )}
          </p>
        )}
      </div>

      {analysis && (
        <div className="rounded bg-brand-50 dark:bg-brand-900/10 p-2">
          <p className="text-2xs uppercase tracking-wider text-brand-500 dark:text-brand-400 font-semibold mb-0.5 flex items-center gap-1">
            <Sparkles size={8} aria-hidden="true" />
            AI-Inferred
          </p>
          <p className="text-2xs text-surface-600 dark:text-surface-300">
            {analysis.definition || "No AI definition yet"}
          </p>
          {analysis.lens && (
            <div className="mt-1.5 rounded bg-amber-50 dark:bg-amber-900/10 p-1.5">
              <p className="text-2xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
                Interpretive Lens
              </p>
              <p className="text-2xs text-surface-600 dark:text-surface-300">
                {analysis.lens}
              </p>
            </div>
          )}
          {analysis.reasoning && (
            <details className="mt-1">
              <summary className="text-2xs text-surface-400 cursor-pointer hover:text-surface-600">
                View reasoning
              </summary>
              <p className="text-2xs text-surface-500 dark:text-surface-400 mt-1 pl-2 border-l-2 panel-border">
                {analysis.reasoning}
              </p>
            </details>
          )}
        </div>
      )}

      <div className="flex gap-1">
        <button
          onClick={() => {
            loadRetrievedSegments(code.id);
            setExpandedCodeId(code.id);
          }}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium transition-colors",
            retrievedCodeId === code.id
              ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
              : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600"
          )}
          title="View all segments for this code"
        >
          <Tag size={9} aria-hidden="true" />
          Segments
        </button>
        <button
          onClick={() => handleAnalyse(code.id)}
          className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 transition-colors"
          title="Run AI analysis"
        >
          <BookOpen size={9} aria-hidden="true" />
          Analyse
        </button>
      </div>

      {retrievedCodeId === code.id && (
        <div className="rounded border panel-border overflow-hidden">
          <div className="max-h-72 overflow-y-auto thin-scrollbar">
            <RetrievedSegments />
          </div>
        </div>
      )}
    </div>
  );
}
