import { Check, X, Plus, Trash2, Loader2 } from "lucide-react";
import { useStore } from "@/stores/store";
import { getContrastColor } from "@/lib/utils";
import type { TextSelection } from "@/types";

interface SelectionViewProps {
  selection: TextSelection;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

/** Popover content shown when the user has an active text selection. */
export default function SelectionView({ selection, applying, onApply, onDismiss }: SelectionViewProps) {
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const activeCodeId = useStore((s) => s.activeCodeId);
  const queueCodeApplication = useStore((s) => s.queueCodeApplication);
  const pendingApplications = useStore((s) => s.pendingApplications);
  const removePendingApplication = useStore((s) => s.removePendingApplication);
  const clearPendingApplications = useStore((s) => s.clearPendingApplications);
  const activeDocumentId = useStore((s) => s.activeDocumentId);

  const appliedCodeIds = new Set(
    segments
      .filter(
        (seg) =>
          seg.start_index === selection.startIndex &&
          seg.end_index === selection.endIndex,
      )
      .map((seg) => seg.code_id),
  );

  const pendingForSpan = pendingApplications.filter(
    (p) =>
      p.startIndex === selection.startIndex &&
      p.endIndex === selection.endIndex &&
      p.documentId === activeDocumentId,
  );
  const pendingCodeIds = new Set(pendingForSpan.map((p) => p.codeId));

  const activeCode = codes.find((c) => c.id === activeCodeId);
  const activeAlreadyApplied = activeCode
    ? appliedCodeIds.has(activeCode.id) || pendingCodeIds.has(activeCode.id)
    : false;

  const handleQueue = (codeId: string) => {
    if (appliedCodeIds.has(codeId) || pendingCodeIds.has(codeId)) return;
    queueCodeApplication(selection, codeId);
  };

  const availableCodes = codes.filter((c) => !appliedCodeIds.has(c.id) && !pendingCodeIds.has(c.id));
  const appliedCodes = codes.filter((c) => appliedCodeIds.has(c.id));

  return (
    <>
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
          Selected text
        </p>
        <p className="text-xs text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-900 rounded p-2 max-h-20 overflow-auto line-clamp-4">
          &ldquo;{selection.text}&rdquo;
        </p>
      </div>

      {appliedCodes.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            Applied codes
          </p>
          <div className="flex flex-wrap gap-1">
            {appliedCodes.map((code) => (
              <span
                key={code.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: code.colour, color: getContrastColor(code.colour) }}
              >
                <Check size={10} aria-hidden="true" />
                {code.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeCode && !activeAlreadyApplied && (
        <button
          onClick={() => handleQueue(activeCode.id)}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: activeCode.colour, color: getContrastColor(activeCode.colour) }}
        >
          <Plus size={14} aria-hidden="true" />
          Queue &ldquo;{activeCode.label}&rdquo;
        </button>
      )}

      {pendingForSpan.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            Queued codes
          </p>
          <div className="flex flex-wrap gap-1">
            {pendingForSpan.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: p.codeColour, color: getContrastColor(p.codeColour) }}
              >
                <Plus size={10} aria-hidden="true" />
                {p.codeLabel}
                <button
                  onClick={() => removePendingApplication(p.id)}
                  className="rounded-full p-0.5 hover:bg-black/20 transition-colors flex-shrink-0 ml-0.5"
                  aria-label={`Remove queued ${p.codeLabel}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {availableCodes.filter((c) => c.id !== activeCodeId).length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            {appliedCodes.length > 0 || pendingForSpan.length > 0 ? "Add another code" : "Choose a code"}
          </p>
          <ul className="max-h-40 overflow-auto space-y-0.5" aria-label="Available codes">
            {availableCodes
              .filter((c) => c.id !== activeCodeId)
              .map((code) => (
                <li key={code.id}>
                  <button
                    onClick={() => handleQueue(code.id)}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: code.colour }}
                      aria-hidden="true"
                    />
                    {code.label}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {availableCodes.length === 0 && (appliedCodes.length > 0 || pendingForSpan.length > 0) && (
        <p className="text-xs text-green-600 text-center py-2 font-medium" role="status">
          All codes applied to this segment
        </p>
      )}

      {pendingForSpan.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onApply}
            disabled={applying}
            aria-label={`Apply ${pendingForSpan.length} queued code${pendingForSpan.length > 1 ? "s" : ""}`}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
            style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
          >
            {applying ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={13} aria-hidden="true" />
            )}
            {applying ? "Applying…" : `Apply ${pendingForSpan.length} code${pendingForSpan.length > 1 ? "s" : ""}`}
          </button>
          <button
            onClick={() => clearPendingApplications()}
            className="flex items-center gap-1 text-xs text-surface-400 hover:text-red-500 transition-colors"
            aria-label="Clear all queued codes"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      <button
        onClick={onDismiss}
        className="mt-2 w-full text-center text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center justify-center gap-1 transition-colors"
      >
        <X size={12} aria-hidden="true" />
        Done
      </button>
    </>
  );
}
