import { useEffect } from "react";
import { GripHorizontal } from "lucide-react";
import { useStore } from "@/shared/store";
import { useDraggable } from "@/shared/hooks/useDraggable";
import { usePopoverInteraction } from "@/features/selection/hooks/usePopoverInteraction";
import ClickedSegmentsView from "@/features/selection/components/ClickedSegmentsView";
import SelectionView from "@/features/selection/components/SelectionView";

interface Props {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const POPOVER_W = 288;
const POPOVER_H = 300;
const GAP = 12;

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

  const { popoverRef, applying, dismiss, handleApply, handleFocusTrap } =
    usePopoverInteraction();

  const [dx, dy] = defaultPosition(selection, containerRef);
  const { pos, onPointerDown, onPointerMove, onPointerUp } = useDraggable(dx, dy);

  // Focus the popover root on mount/change
  useEffect(() => {
    popoverRef.current?.focus();
  }, [selection, clickedSegments, popoverRef]);

  if (!clickedSegments?.length && !selection) return null;

  return (
    <div
      ref={popoverRef}
      tabIndex={-1}
      role="dialog"
      aria-label={clickedSegments?.length ? "Coded segment details" : "Apply code to selection"}
      aria-modal="true"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={handleFocusTrap}
      className="fixed z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 p-3 w-72 outline-none popover-enter"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing py-1 -mt-1 mb-1 text-surface-300 dark:text-surface-600 hover:text-surface-400 dark:hover:text-surface-500 select-none"
        aria-hidden="true"
      >
        <GripHorizontal size={14} aria-hidden="true" />
      </div>

      {clickedSegments && clickedSegments.length > 0 ? (
        <ClickedSegmentsView clickedSegments={clickedSegments} onDismiss={dismiss} />
      ) : selection ? (
        <SelectionView
          selection={selection}
          applying={applying}
          onApply={handleApply}
          onDismiss={dismiss}
        />
      ) : null}
    </div>
  );
}
