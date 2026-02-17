import { useStore } from "@/stores/store";
import { Tag, Check, X, Trash2, GripHorizontal } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

function useDraggable(initialX: number, initialY: number) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPos({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { pos, onPointerDown, onPointerMove, onPointerUp };
}

export default function HighlightPopover({ containerRef }: Props = {}) {
  const selection = useStore((s) => s.selection);
  const clickedSegments = useStore((s) => s.clickedSegments);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const activeCodeId = useStore((s) => s.activeCodeId);
  const applyCode = useStore((s) => s.applyCode);
  const setSelection = useStore((s) => s.setSelection);
  const setClickedSegments = useStore((s) => s.setClickedSegments);
  const removeSegment = useStore((s) => s.removeSegment);

  // Position the popover near the actual selection / clicked segment on screen
  const popoverWidth = 288;
  const popoverHeight = 300; // approximate max height
  const margin = 12;

  let defaultX = 200;
  let defaultY = 128;

  if (selection?.rect) {
    // Place to the right of the selection, or to the left if no room
    defaultX = selection.rect.right + margin;
    if (defaultX + popoverWidth > window.innerWidth - margin) {
      defaultX = selection.rect.left - popoverWidth - margin;
    }
    // Vertically align with the top of the selection
    defaultY = selection.rect.top;
  } else if (containerRef?.current) {
    const cRect = containerRef.current.getBoundingClientRect();
    defaultX = cRect.right - popoverWidth;
    defaultY = cRect.top + 16;
  }

  // Clamp to viewport so the popover is always visible
  defaultX = Math.max(margin, Math.min(defaultX, window.innerWidth - popoverWidth - margin));
  defaultY = Math.max(margin, Math.min(defaultY, window.innerHeight - popoverHeight - margin));

  const { pos, onPointerDown, onPointerMove, onPointerUp } = useDraggable(defaultX, defaultY);

  const handleDismiss = () => {
    setSelection(null);
    setClickedSegments(null);
  };

  const dragHandle = (
    <div
      onPointerDown={onPointerDown}
      className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing py-1 -mt-1 mb-1 text-surface-300 dark:text-surface-600 hover:text-surface-400 dark:hover:text-surface-500 select-none"
    >
      <GripHorizontal size={14} />
    </div>
  );

  if (clickedSegments && clickedSegments.length > 0) {
    const segText = clickedSegments[0].text;

    return (
      <div
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="popover-enter fixed z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 p-3 w-72"
        style={{ left: pos.x, top: pos.y }}
      >
        {dragHandle}
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            Coded segment
          </p>
          <p className="text-xs text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-900 rounded p-2 max-h-20 overflow-auto line-clamp-4">
            "{segText}"
          </p>
        </div>

        <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
          Applied codes
        </p>
        <ul className="space-y-0.5 mb-2">
          {clickedSegments.map((seg) => (
            <li
              key={seg.id}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition"
            >
              <span className="flex items-center gap-2 text-xs text-surface-700 dark:text-surface-200">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.code_colour }}
                />
                {seg.code_label}
              </span>
              <button
                onClick={() => removeSegment(seg.id)}
                className="text-surface-300 dark:text-surface-600 hover:text-red-500 transition"
                title="Remove this code"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={handleDismiss}
          className="mt-1 w-full text-center text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center justify-center gap-1"
        >
          <X size={12} />
          Done
        </button>
      </div>
    );
  }

  if (!selection) return null;

  const appliedCodeIds = new Set(
    segments
      .filter(
        (seg) =>
          seg.start_index === selection.startIndex &&
          seg.end_index === selection.endIndex
      )
      .map((seg) => seg.code_id)
  );

  const activeCode = codes.find((c) => c.id === activeCodeId);
  const activeAlreadyApplied = activeCode
    ? appliedCodeIds.has(activeCode.id)
    : false;

  const handleApply = async (codeId: string) => {
    if (appliedCodeIds.has(codeId)) return;
    await applyCode(selection, codeId);
  };

  const availableCodes = codes.filter((c) => !appliedCodeIds.has(c.id));
  const appliedCodes = codes.filter((c) => appliedCodeIds.has(c.id));

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="popover-enter fixed z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 p-3 w-72"
      style={{ left: pos.x, top: pos.y }}
    >
      {dragHandle}
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
          Selected text
        </p>
        <p className="text-xs text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-900 rounded p-2 max-h-20 overflow-auto line-clamp-4">
          "{selection.text}"
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
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: code.colour }}
              >
                <Check size={10} />
                {code.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeCode && !activeAlreadyApplied && (
        <button
          onClick={() => handleApply(activeCode.id)}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm font-medium text-white transition"
          style={{ backgroundColor: activeCode.colour }}
        >
          <Tag size={14} />
          Apply "{activeCode.label}"
        </button>
      )}

      {availableCodes.filter((c) => c.id !== activeCodeId).length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">
            {appliedCodes.length > 0 ? "Add another code" : "Choose a code"}
          </p>
          <ul className="max-h-40 overflow-auto space-y-0.5">
            {availableCodes
              .filter((c) => c.id !== activeCodeId)
              .map((code) => (
                <li key={code.id}>
                  <button
                    onClick={() => handleApply(code.id)}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: code.colour }}
                    />
                    {code.label}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {availableCodes.length === 0 && appliedCodes.length > 0 && (
        <p className="text-xs text-green-600 text-center py-2 font-medium">
          ✓ All codes applied to this segment
        </p>
      )}

      <button
        onClick={handleDismiss}
        className="mt-2 w-full text-center text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center justify-center gap-1"
      >
        <X size={12} />
        Done
      </button>
    </div>
  );
}
