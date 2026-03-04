import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/stores/store";
import { useCodeActions } from "@/features/codes/hooks/useCodeActions";
import CodeListItem from "@/features/codes/components/CodeListItem";

export default function CodesTabContent() {
  const codes = useStore((s) => s.codes);
  const activeCodeId = useStore((s) => s.activeCodeId);
  const setActiveCode = useStore((s) => s.setActiveCode);
  const updateCode = useStore((s) => s.updateCode);
  const analyses = useStore((s) => s.analyses);
  const loadRetrievedSegments = useStore((s) => s.loadRetrievedSegments);
  const codeSearchQuery = useStore((s) => s.codeSearchQuery);
  const setCodeSearchQuery = useStore((s) => s.setCodeSearchQuery);
  const retrievedCodeId = useStore((s) => s.retrievedCodeId);

  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDefinition, setNewCodeDefinition] = useState("");
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [editingDefCodeId, setEditingDefCodeId] = useState<string | null>(null);
  const [editDefText, setEditDefText] = useState("");

  const { handleAddCode, handleDeleteCode, handleAnalyse } = useCodeActions();

  const filteredCodes = codes.filter((c) =>
    c.label.toLowerCase().includes(codeSearchQuery.toLowerCase()),
  );

  const onAdd = async () => {
    await handleAddCode(newCodeLabel, newCodeDefinition);
    setNewCodeLabel("");
    setNewCodeDefinition("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Add-code form ──────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <div className="flex items-center gap-1 mb-1">
          <input
            value={newCodeLabel}
            onChange={(e) => setNewCodeLabel(e.target.value)}
            placeholder="New code..."
            aria-label="New code name"
            className="flex-1 min-w-0 rounded border panel-border px-2 py-0.5 text-xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onAdd()}
          />
          <button
            onClick={onAdd}
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

      {/* ── Code list ──────────────────────────────────────────── */}
      <ul
        className="flex-1 overflow-auto px-2 pb-2 thin-scrollbar space-y-0.5"
        role="listbox"
        aria-label="Codebook"
      >
        {filteredCodes.map((code) => (
          <CodeListItem
            key={code.id}
            code={code}
            isActive={activeCodeId === code.id}
            isExpanded={expandedCodeId === code.id}
            isEditingDef={editingDefCodeId === code.id}
            editDefText={editDefText}
            setEditDefText={setEditDefText}
            setEditingDefCodeId={setEditingDefCodeId}
            setActiveCode={setActiveCode}
            setExpandedCodeId={setExpandedCodeId}
            loadRetrievedSegments={loadRetrievedSegments}
            updateCode={updateCode}
            handleDeleteCode={handleDeleteCode}
            handleAnalyse={handleAnalyse}
            retrievedCodeId={retrievedCodeId}
            analyses={analyses}
          />
        ))}
      </ul>
    </div>
  );
}
