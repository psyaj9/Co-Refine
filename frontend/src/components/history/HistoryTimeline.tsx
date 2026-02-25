import { useStore } from "@/stores/store";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, eventSummary } from "./history-helpers";
import type { EditEventOut } from "@/types";


function ActionIcon({ action }: { action: string }) {
  const cls = "flex-shrink-0";
  if (action === "created")
    return <Plus size={14} className={cn(cls, "text-emerald-500")} aria-hidden />;
  if (action === "updated")
    return <Pencil size={14} className={cn(cls, "text-amber-500")} aria-hidden />;
  if (action === "deleted")
    return <Trash2 size={14} className={cn(cls, "text-red-400")} aria-hidden />;
  return <FileText size={14} className={cls} aria-hidden />;
}

function EntityBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "text-2xs font-medium px-1.5 py-0.5 rounded-full",
        type === "code"
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
      )}
    >
      {type === "code" ? "Code" : "Segment"}
    </span>
  );
}

function ScopeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300"
          : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800",
      )}
    >
      {label}
    </button>
  );
}

function TimelineEntry({
  event,
  isSelected,
  onClick,
}: {
  event: EditEventOut;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meta = event.metadata_json ?? {};
  const codeColour = (meta.code_colour as string) || "#6366f1";

  return (
    <button
      onClick={onClick}
      aria-selected={isSelected}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b panel-border transition-colors group",
        isSelected
          ? "bg-brand-50 dark:bg-brand-900/10 border-l-2 border-l-brand-500"
          : "hover:bg-surface-50 dark:hover:bg-surface-800/50 border-l-2 border-l-transparent",
      )}
    >
      <p className="text-2xs text-surface-400 mb-1">
        {formatDateTime(event.created_at)}
      </p>
      <div className="flex items-center gap-2 mb-1">
        <ActionIcon action={event.action} />
        <EntityBadge type={event.entity_type} />
      </div>

      <p className="text-xs text-surface-700 dark:text-surface-300 leading-snug line-clamp-2">
        {eventSummary(event)}
      </p>

      {event.action === "updated" && event.old_value && event.new_value && (
        <div className="mt-1.5 flex items-center gap-1.5 text-2xs">
          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 line-through">
            {event.old_value.length > 40
              ? event.old_value.slice(0, 40) + "…"
              : event.old_value}
          </span>
          <span className="text-surface-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            {event.new_value.length > 40
              ? event.new_value.slice(0, 40) + "…"
              : event.new_value}
          </span>
        </div>
      )}

      {event.entity_type === "segment" && (
        <div className="mt-1 flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: codeColour }}
            aria-hidden
          />
          <span className="text-2xs text-surface-400 truncate">
            {(meta.code_label as string) || ""}
          </span>
        </div>
      )}
    </button>
  );
}


export default function HistoryTimeline() {
  const editHistory = useStore((s) => s.editHistory);
  const historyScope = useStore((s) => s.historyScope);
  const setHistoryScope = useStore((s) => s.setHistoryScope);
  const historySelectedEventId = useStore((s) => s.historySelectedEventId);
  const setHistorySelectedEventId = useStore(
    (s) => s.setHistorySelectedEventId,
  );

  const handleClick = (eventId: string) => {
    setHistorySelectedEventId(
      historySelectedEventId === eventId ? null : eventId,
    );
  };

  return (
    <aside
      className="w-72 flex-shrink-0 border-l panel-border flex flex-col h-full bg-surface-50 dark:bg-surface-900"
      aria-label="Edit history timeline"
    >
      <div
        className="px-3 py-2.5 border-b panel-border flex items-center gap-1.5"
        role="group"
        aria-label="History scope"
      >
        <ScopeButton
          label="Document"
          active={historyScope === "document"}
          onClick={() => setHistoryScope("document")}
        />
        <ScopeButton
          label="Project"
          active={historyScope === "project"}
          onClick={() => setHistoryScope("project")}
        />
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto thin-scrollbar"
        role="listbox"
        aria-label="History events"
      >
        {editHistory.length === 0 ? (
          <div className="p-4 text-center text-surface-400 text-sm">
            No edits recorded yet.
            <br />
            <span className="text-2xs">
              Code and segment changes will appear here.
            </span>
          </div>
        ) : (
          editHistory.map((ev) => (
            <TimelineEntry
              key={ev.id}
              event={ev}
              isSelected={historySelectedEventId === ev.id}
              onClick={() => handleClick(ev.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
