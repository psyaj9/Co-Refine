import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import ExpandedCodeDetail from "@/features/codes/components/ExpandedCodeDetail";
import type { CodeOut, AnalysisOut } from "@/shared/types";

interface CodeListItemProps {
  code: CodeOut;
  isActive: boolean;
  isExpanded: boolean;
  isEditingDef: boolean;
  editDefText: string;
  setEditDefText: (v: string) => void;
  setEditingDefCodeId: (id: string | null) => void;
  setActiveCode: (id: string) => void;
  setExpandedCodeId: (id: string | null) => void;
  loadRetrievedSegments: (codeId: string) => Promise<void>;
  updateCode: (id: string, patch: { definition: string }) => Promise<void>;
  handleDeleteCode: (e: React.MouseEvent, id: string) => void;
  handleAnalyse: (codeId: string) => void;
  retrievedCodeId: string | null;
  analyses: AnalysisOut[];
}

export default function CodeListItem({
  code,
  isActive,
  isExpanded,
  isEditingDef,
  editDefText,
  setEditDefText,
  setEditingDefCodeId,
  setActiveCode,
  setExpandedCodeId,
  loadRetrievedSegments,
  updateCode,
  handleDeleteCode,
  handleAnalyse,
  retrievedCodeId,
  analyses,
}: CodeListItemProps) {
  return (
    <li>
      <div
        role="option"
        aria-selected={isActive}
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
          isActive
            ? "ring-1 ring-brand-400 bg-brand-50 dark:bg-brand-900/20"
            : "panel-hover",
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
}
