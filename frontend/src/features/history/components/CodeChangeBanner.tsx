import { Tag } from "lucide-react";
import { eventSummary } from "@/features/history/lib/history-helpers";
import type { EditEventOut } from "@/shared/types";

export default function CodeChangeBanner({
  event,
}: {
  event: EditEventOut;
}) {
  const meta = event.metadata_json ?? {};
  const codeColour = (meta.code_colour as string) || "#6366f1";

  return (
    <div
      className="px-4 py-2.5 border-b panel-border bg-amber-50/50 dark:bg-amber-900/10 flex items-center gap-3"
      role="status"
    >
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: codeColour }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-surface-700 dark:text-surface-200">
          {eventSummary(event)}
        </p>
        {event.action === "updated" && event.old_value && event.new_value && (
          <div className="mt-1 flex items-center gap-1.5 text-2xs">
            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 line-through">
              {event.old_value}
            </span>
            <span className="text-surface-400" aria-hidden>→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              {event.new_value}
            </span>
          </div>
        )}
      </div>
      <Tag size={14} className="text-surface-400 flex-shrink-0" aria-hidden />
    </div>
  );
}
