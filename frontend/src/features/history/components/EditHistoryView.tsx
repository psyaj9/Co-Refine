import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/shared/store";
import { ChevronLeft } from "lucide-react";
import { escapeHtml } from "@/shared/lib/utils";
import { buildHistoryAnnotatedText } from "@/features/history/lib/history-helpers";
import HistoryTimeline from "@/features/history/components/HistoryTimeline";
import CodeChangeBanner from "@/features/history/components/CodeChangeBanner";

export default function EditHistoryView() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const editHistory = useStore((s) => s.editHistory);
  const historySelectedEventId = useStore((s) => s.historySelectedEventId);
  const loadEditHistory = useStore((s) => s.loadEditHistory);
  const setViewMode = useStore((s) => s.setViewMode);
  const historyScope = useStore((s) => s.historyScope);

  const textRef = useRef<HTMLDivElement>(null);
  const doc = documents.find((d) => d.id === activeDocumentId);

  useEffect(() => {
    loadEditHistory();
  }, [activeDocumentId, historyScope]);

  const selectedEvent = useMemo(
    () => editHistory.find((e) => e.id === historySelectedEventId) ?? null,
    [editHistory, historySelectedEventId],
  );

  const annotatedHtml = useMemo(() => {
    if (!doc) return "";
    if (!selectedEvent || selectedEvent.entity_type !== "segment")
      return escapeHtml(doc.full_text);
    return buildHistoryAnnotatedText(doc.full_text, selectedEvent);
  }, [doc, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent || !textRef.current) return;
    const raf = requestAnimationFrame(() => {
      const mark = textRef.current?.querySelector<HTMLElement>(
        "mark[data-history]",
      );
      if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedEvent, annotatedHtml]);

  return (
    <div className="flex h-full overflow-hidden view-enter">
      <div
        className="flex-1 min-w-0 flex flex-col h-full overflow-hidden"
        role="region"
        aria-label={doc ? `Edit history for ${doc.title}` : "Edit history"}
      >
        <div className="px-4 pt-3 pb-2 border-b panel-border panel-bg flex-shrink-0 flex items-center gap-3 z-10">
          <button
            onClick={() => setViewMode("document")}
            className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Back to document view"
          >
            <ChevronLeft size={16} className="text-surface-500" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-surface-700 dark:text-surface-200">
              Edit History{doc ? ` — ${doc.title}` : ""}
            </h2>
            <p className="text-2xs text-surface-400">
              {editHistory.length} change
              {editHistory.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>

        {selectedEvent && selectedEvent.entity_type === "code" && (
          <CodeChangeBanner event={selectedEvent} />
        )}

        {doc ? (
          <div className="flex-1 min-h-0 overflow-auto thin-scrollbar">
            <div className="flex min-h-full">
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

      <HistoryTimeline />
    </div>
  );
}
