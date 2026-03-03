import { useStore } from "@/stores/store";
import { Check, X, Trash2, GripHorizontal, Plus } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { useDraggable } from "@/hooks/useDraggable";
import { getContrastColor } from "@/lib/utils";

interface Props {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const POPOVER_W = 288;
const POPOVER_H = 300; // approximate max
const GAP = 12;

/** Compute initial (x, y) near the selection or container edge. */
function defaultPosition(
  selection: { rect?: { top: number; left: number; right: number } } | null,
  containerRef?: React.RefObject<HTMLDivElement | null>,
): [number, number] {
  let x = 200;
  let y = 128;

  if (selection?.rect) {
    x = selection.rect.right + GAP;
    if (x + POPOVER_W > window.innerWidth - GAP)
      x = selection.rect.left - POPOVER_W - GAP;
    y = selection.rect.top;
  } else if (containerRef?.current) {
    const r = containerRef.current.getBoundingClientRect();
    x = r.right - POPOVER_W;
    y = r.top + 16;
  }

  x = Math.max(GAP, Math.min(x, window.innerWidth - POPOVER_W - GAP));
  y = Math.max(GAP, Math.min(y, window.innerHeight - POPOVER_H - GAP));
  return [x, y];
}

export default function HighlightPopover({ containerRef }: Props = {}) {
  const selection = useStore((s) => s.selection);
  const clickedSegments = useStore((s) => s.clickedSegments);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const activeCodeId = useStore((s) => s.activeCodeId);
  const queueCodeApplication = useStore((s) => s.queueCodeApplication);
  const pendingApplications = useStore((s) => s.pendingApplications);
  const setSelection = useStore((s) => s.setSelection);
  const setClickedSegments = useStore((s) => s.setClickedSegments);
  const removeSegment = useStore((s) => s.removeSegment);

  const [dx, dy] = defaultPosition(selection, containerRef);
  const { pos, onPointerDown, onPointerMove, onPointerUp } = useDraggable(dx, dy);

  const popoverRef = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    setSelection(null);
    setClickedSegments(null);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus trap — focus the popover root on mount
  useEffect(() => {
    popoverRef.current?.focus();
  }, [selection, clickedSegments]);

  /** Trap focus inside the popover so Tab doesn't escape */
  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = popoverRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);


  const dragHandle = (
    <div
      onPointerDown={onPointerDown}
      className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing py-1 -mt-1 mb-1 text-surface-300 dark:text-surface-600 hover:text-surface-400 dark:hover:text-surface-500 select-none"
      aria-hidden="true"
    >
      <GripHorizontal size={14} aria-hidden="true" />
    </div>
  );

  const doneButton = (
    <button
      onClick={dismiss}
      className="mt-2 w-full text-center text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center justify-center gap-1 transition-colors"
    >
      <X size={12} aria-hidden="true" />
      Done
    </button>
  );


  if (clickedSegments && clickedSegments.length > 0) {
    const segText = clickedSegments[0].text;

    return (
      <div
        ref={popoverRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Coded segment details"
        aria-modal="true"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={handleFocusTrap}
        className="fixed z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 p-3 w-72 outline-none popover-enter"
        style={{ left: pos.x, top: pos.y }}
      >
        {dragHandle}
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            Coded segment
          </p>
          <p className="text-xs text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-900 rounded p-2 max-h-20 overflow-auto line-clamp-4">
            &ldquo;{segText}&rdquo;
          </p>
        </div>

        <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
          Applied codes
        </p>
        <ul className="space-y-0.5 mb-2" aria-label="Applied codes">
          {clickedSegments.map((seg) => (
            <li
              key={seg.id}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs text-surface-700 dark:text-surface-200">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.code_colour }}
                  aria-hidden="true"
                />
                {seg.code_label}
              </span>
              <button
                onClick={() => removeSegment(seg.id)}
                className="text-surface-300 dark:text-surface-600 hover:text-red-500 transition-colors"
                aria-label={`Remove code ${seg.code_label}`}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>

        {doneButton}
      </div>
    );
  }


  if (!selection) return null;

  const appliedCodeIds = new Set(
    segments
      .filter(
        (seg) =>
          seg.start_index === selection.startIndex &&
          seg.end_index === selection.endIndex,
      )
      .map((seg) => seg.code_id),
  );

  // Codes already queued for this exact span
  const pendingForSpan = pendingApplications.filter(
    (p) =>
      p.startIndex === selection.startIndex &&
      p.endIndex === selection.endIndex &&
      p.documentId === useStore.getState().activeDocumentId,
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
  const pendingCodes = codes.filter((c) => pendingCodeIds.has(c.id));

  return (
    <div
      ref={popoverRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Apply code to selection"
      aria-modal="true"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={handleFocusTrap}
      className="fixed z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 p-3 w-72 outline-none popover-enter"
      style={{ left: pos.x, top: pos.y }}
    >
      {dragHandle}

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

      {pendingCodes.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            Queued codes
          </p>
          <div className="flex flex-wrap gap-1">
            {pendingCodes.map((code) => (
              <span
                key={code.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium opacity-80"
                style={{ backgroundColor: code.colour, color: getContrastColor(code.colour) }}
              >
                <Plus size={10} aria-hidden="true" />
                {code.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {availableCodes.filter((c) => c.id !== activeCodeId).length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            {appliedCodes.length > 0 || pendingCodes.length > 0 ? "Add another code" : "Choose a code"}
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

      {availableCodes.length === 0 && (appliedCodes.length > 0 || pendingCodes.length > 0) && (
        <p className="text-xs text-green-600 text-center py-2 font-medium" role="status">
          All codes applied to this segment
        </p>
      )}

      {doneButton}
    </div>
  );
}
