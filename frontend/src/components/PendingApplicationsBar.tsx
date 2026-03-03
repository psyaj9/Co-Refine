import { useStore } from "@/stores/store";
import { Check, X, Trash2 } from "lucide-react";
import { getContrastColor } from "@/lib/utils";

export default function PendingApplicationsBar() {
  const pending = useStore((s) => s.pendingApplications);
  const removePending = useStore((s) => s.removePendingApplication);
  const clearPending = useStore((s) => s.clearPendingApplications);
  const confirmPending = useStore((s) => s.confirmPendingApplications);

  if (pending.length === 0) return null;

  return (
    <div className="flex items-center gap-3 border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 shadow-inner">
      <span className="text-xs font-medium text-surface-500 dark:text-surface-400 whitespace-nowrap">
        {pending.length} pending
      </span>

      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
        {pending.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-medium max-w-[200px] group"
            style={{ backgroundColor: p.codeColour, color: getContrastColor(p.codeColour) }}
            title={`"${p.text.slice(0, 60)}${p.text.length > 60 ? "…" : ""}" → ${p.codeLabel}`}
          >
            <span className="truncate">{p.codeLabel}</span>
            <button
              onClick={() => removePending(p.id)}
              className="rounded-full p-0.5 hover:bg-black/20 transition-colors flex-shrink-0"
              aria-label={`Remove ${p.codeLabel}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={clearPending}
          className="flex items-center gap-1 text-xs text-surface-400 hover:text-red-500 transition-colors"
          aria-label="Clear all pending"
        >
          <Trash2 size={13} />
          Clear
        </button>
        <button
          onClick={confirmPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
        >
          <Check size={13} />
          Apply all
        </button>
      </div>
    </div>
  );
}
