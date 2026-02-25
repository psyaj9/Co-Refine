import { useEffect, useMemo, useRef, useCallback } from "react";
import { useStore } from "@/stores/store";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditEventOut } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Add ordinal suffix to day number: 1→"1st", 2→"2nd", 7→"7th" */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Format ISO string → "Sun, 7th December 2025, 21:15" */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  const day = ordinal(d.getDate());
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${weekday}, ${day} ${month} ${year}, ${time}`;
}

/** Build a human-readable summary for an edit event */
function eventSummary(ev: EditEventOut): string {
  const meta = ev.metadata_json ?? {};
  const codeLabel = (meta.code_label as string) || "Unknown code";

  if (ev.entity_type === "segment") {
    const text = (meta.segment_text as string) || "";
    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
    if (ev.action === "created") return `Applied "${codeLabel}" to "${preview}"`;
    if (ev.action === "deleted") return `Removed "${codeLabel}" from "${preview}"`;
  }

  if (ev.entity_type === "code") {
    if (ev.action === "created") return `Created code "${codeLabel}"`;
    if (ev.action === "deleted") return `Deleted code "${codeLabel}"`;
    if (ev.action === "updated" && ev.field_changed) {
      return `Changed ${ev.field_changed} of "${codeLabel}"`;
    }
  }

  return `${ev.action} ${ev.entity_type}`;
}

/** Icon for each action type */
function ActionIcon({ action }: { action: string }) {
  const cls = "flex-shrink-0";
  if (action === "created") return <Plus size={14} className={cn(cls, "text-emerald-500")} />;
  if (action === "updated") return <Pencil size={14} className={cn(cls, "text-amber-500")} />;
  if (action === "deleted") return <Trash2 size={14} className={cn(cls, "text-red-400")} />;
  return <FileText size={14} className={cls} />;
}

/** Badge colour for entity type */
function EntityBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "text-2xs font-medium px-1.5 py-0.5 rounded-full",
        type === "code"
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
      )}
    >
      {type === "code" ? "Code" : "Segment"}
    </span>
  );
}

// ─── Highlighted text builder ───────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHistoryAnnotatedText(
  fullText: string,
  selectedEvent: EditEventOut | null,
): string {
  if (!selectedEvent || !fullText) return escapeHtml(fullText);

  const meta = selectedEvent.metadata_json ?? {};
  const start = meta.start_index as number | undefined;
  const end = meta.end_index as number | undefined;

  if (start === undefined || end === undefined) return escapeHtml(fullText);
  if (start < 0 || end > fullText.length || start >= end) return escapeHtml(fullText);

  const bgColour =
    selectedEvent.action === "created"
      ? "rgba(16,185,129,0.18)"   // green tint
      : selectedEvent.action === "deleted"
        ? "rgba(239,68,68,0.15)"  // red tint
        : "rgba(245,158,11,0.18)"; // amber tint

  const borderColour =
    selectedEvent.action === "created"
      ? "rgba(16,185,129,0.55)"
      : selectedEvent.action === "deleted"
        ? "rgba(239,68,68,0.55)"
        : "rgba(245,158,11,0.55)";

  const before = escapeHtml(fullText.slice(0, start));
  const highlighted = escapeHtml(fullText.slice(start, end));
  const after = escapeHtml(fullText.slice(end));

  return `${before}<mark data-history="true" style="background-color:${bgColour};border-bottom:2px solid ${borderColour}">${highlighted}</mark>${after}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EditHistoryView() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const editHistory = useStore((s) => s.editHistory);
  const historyScope = useStore((s) => s.historyScope);
  const setHistoryScope = useStore((s) => s.setHistoryScope);
  const historySelectedEventId = useStore((s) => s.historySelectedEventId);
  const setHistorySelectedEventId = useStore((s) => s.setHistorySelectedEventId);
  const loadEditHistory = useStore((s) => s.loadEditHistory);
  const setViewMode = useStore((s) => s.setViewMode);

  const textRef = useRef<HTMLDivElement>(null);
  const doc = documents.find((d) => d.id === activeDocumentId);

  // Load history when entering the view or scope changes
  useEffect(() => {
    loadEditHistory();
  }, [activeDocumentId, historyScope]);

  const selectedEvent = useMemo(
    () => editHistory.find((e) => e.id === historySelectedEventId) ?? null,
    [editHistory, historySelectedEventId]
  );

  // Annotated HTML for the document with history markers
  const annotatedHtml = useMemo(() => {
    if (!doc) return "";
    if (!selectedEvent || selectedEvent.entity_type !== "segment") {
      return escapeHtml(doc.full_text);
    }
    return buildHistoryAnnotatedText(doc.full_text, selectedEvent);
  }, [doc, selectedEvent]);

  // Line count for gutter
  const lineCount = useMemo(() => {
    if (!doc) return 0;
    return doc.full_text.split("\n").length;
  }, [doc]);

  // Scroll to highlighted mark when selection changes
  useEffect(() => {
    if (!selectedEvent || !textRef.current) return;
    const rafId = requestAnimationFrame(() => {
      const mark = textRef.current?.querySelector<HTMLElement>("mark[data-history]");
      if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(rafId);
  }, [selectedEvent, annotatedHtml]);

  const handleEventClick = useCallback(
    (eventId: string) => {
      setHistorySelectedEventId(
        historySelectedEventId === eventId ? null : eventId
      );
    },
    [historySelectedEventId, setHistorySelectedEventId]
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Document view ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b panel-border panel-bg flex-shrink-0 flex items-center gap-3 z-10">
          <button
            onClick={() => setViewMode("document")}
            className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Back to document"
          >
            <ChevronLeft size={16} className="text-surface-500" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-surface-700 dark:text-surface-200">
              Edit History{doc ? ` — ${doc.title}` : ""}
            </h2>
            <p className="text-2xs text-surface-400">
              {editHistory.length} change{editHistory.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>

        {/* Change detail banner (for code-level events without document position) */}
        {selectedEvent && selectedEvent.entity_type === "code" && (
          <CodeChangeBanner event={selectedEvent} />
        )}

        {/* Document body */}
        {doc ? (
          <div className="flex-1 min-h-0 overflow-auto thin-scrollbar">
            <div className="flex min-h-full">
              {/* Line numbers gutter */}
              <div className="flex-shrink-0 pt-4 pb-4 select-none border-r panel-border bg-surface-50/50 dark:bg-surface-900/50">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="line-number leading-relaxed text-xs h-[1.625rem]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div
                  ref={textRef}
                  className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap cursor-default text-surface-700 dark:text-surface-200 select-text"
                  dangerouslySetInnerHTML={{ __html: annotatedHtml }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
            Select a document to view its edit history
          </div>
        )}
      </div>

      {/* ── Right: Timeline sidebar ── */}
      <div className="w-72 flex-shrink-0 border-l panel-border flex flex-col h-full bg-surface-50 dark:bg-surface-900">
        {/* Scope toggle */}
        <div className="px-3 py-2.5 border-b panel-border flex items-center gap-1.5">
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

        {/* Timeline entries */}
        <div className="flex-1 min-h-0 overflow-auto thin-scrollbar">
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
                onClick={() => handleEventClick(ev.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300"
          : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
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
      className={cn(
        "w-full text-left px-3 py-2.5 border-b panel-border transition-colors group",
        isSelected
          ? "bg-brand-50 dark:bg-brand-900/10 border-l-2 border-l-brand-500"
          : "hover:bg-surface-50 dark:hover:bg-surface-800/50 border-l-2 border-l-transparent"
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

      {/* Old → New values for updates */}
      {event.action === "updated" && event.old_value && event.new_value && (
        <div className="mt-1.5 flex items-center gap-1.5 text-2xs">
          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 line-through">
            {event.old_value.length > 40 ? event.old_value.slice(0, 40) + "…" : event.old_value}
          </span>
          <span className="text-surface-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            {event.new_value.length > 40 ? event.new_value.slice(0, 40) + "…" : event.new_value}
          </span>
        </div>
      )}

      {/* Colour chip for the code */}
      {event.entity_type === "segment" && (
        <div className="mt-1 flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: codeColour }}
          />
          <span className="text-2xs text-surface-400 truncate">
            {(meta.code_label as string) || ""}
          </span>
        </div>
      )}
    </button>
  );
}

function CodeChangeBanner({ event }: { event: EditEventOut }) {
  const meta = event.metadata_json ?? {};
  const codeColour = (meta.code_colour as string) || "#6366f1";

  return (
    <div className="px-4 py-2.5 border-b panel-border bg-amber-50/50 dark:bg-amber-900/10 flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: codeColour }}
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
            <span className="text-surface-400">→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              {event.new_value}
            </span>
          </div>
        )}
      </div>
      <Tag size={14} className="text-surface-400 flex-shrink-0" />
    </div>
  );
}
