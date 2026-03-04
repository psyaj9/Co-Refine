import { Trash2, X } from "lucide-react";
import { useStore } from "@/stores/store";
import type { SegmentOut } from "@/types";

interface ClickedSegmentsViewProps {
  clickedSegments: SegmentOut[];
  onDismiss: () => void;
}

/** Popover content shown when the user clicks an already-coded text span. */
export default function ClickedSegmentsView({ clickedSegments, onDismiss }: ClickedSegmentsViewProps) {
  const removeSegment = useStore((s) => s.removeSegment);
  const segText = clickedSegments[0].text;

  return (
    <>
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
