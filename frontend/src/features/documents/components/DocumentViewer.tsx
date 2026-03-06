import { useRef, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/stores/store";
import { useTextSelection } from "@/hooks/useTextSelection";
import { buildAnnotatedText } from "@/lib/annotated-text";
import MarginPills from "./MarginPills";

export default function DocumentViewer() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const segments = useStore((s) => s.segments);
  const setClickedSegments = useStore((s) => s.setClickedSegments);
  const loadSegments = useStore((s) => s.loadSegments);
  const inconsistentSegmentIds = useStore((s) => s.inconsistentSegmentIds);
  const scrollToSegmentId = useStore((s) => s.scrollToSegmentId);
  const setScrollToSegmentId = useStore((s) => s.setScrollToSegmentId);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const handleMouseUp = useTextSelection(textRef);

  const doc = documents.find((d) => d.id === activeDocumentId);

  useEffect(() => {
    if (activeDocumentId) loadSegments(activeDocumentId);
  }, [activeDocumentId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-start]") as HTMLElement | null;
      if (!mark) return;

      const start = Number(mark.dataset.start);
      const end = Number(mark.dataset.end);

      const matched = segments.filter(
        (seg) => seg.start_index < end && seg.end_index > start
      );
      if (matched.length > 0) setClickedSegments(matched);
    },
    [segments, setClickedSegments]
  );

  const annotatedHtml = useMemo(() => {
    if (!doc) return "";
    return buildAnnotatedText(doc.full_text, segments, inconsistentSegmentIds);
  }, [doc, segments, inconsistentSegmentIds]);

  useEffect(() => {
    if (!scrollToSegmentId || !textRef.current) return;
    const seg = segments.find((s) => s.id === scrollToSegmentId);
    if (!seg) return;
    const rafId = requestAnimationFrame(() => {
      const mark = textRef.current?.querySelector<HTMLElement>(
        `mark[data-start="${seg.start_index}"][data-end="${seg.end_index}"]`
      );
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        setScrollToSegmentId(null);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [scrollToSegmentId, annotatedHtml]);

  const lineCount = useMemo(() => {
    if (!doc) return 0;
    return doc.full_text.split("\n").length;
  }, [doc]);

  if (!doc) return null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden view-enter"
      role="region"
      aria-label={`Document: ${doc.title}`}
    >
      <div className="px-4 pt-3 pb-2 border-b panel-border panel-bg flex-shrink-0 z-10">
        <h2 className="text-sm font-bold text-surface-700 dark:text-surface-200">
          {doc.title}
        </h2>
        <p className="text-2xs text-surface-400">
          {doc.doc_type} · {doc.full_text.length.toLocaleString()} chars ·{" "}
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto thin-scrollbar">
        <div className="flex min-h-full">
          <div
            className="flex-shrink-0 pt-4 pb-4 select-none border-r panel-border bg-surface-50/50 dark:bg-surface-900/50"
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="line-number leading-relaxed text-xs h-[1.625rem]">
                {i + 1}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              className="px-4 py-4 text-fluid-sm leading-relaxed whitespace-pre-wrap selection:bg-brand-100 dark:selection:bg-brand-700/30 cursor-text text-surface-700 dark:text-surface-200"
              dangerouslySetInnerHTML={{ __html: annotatedHtml }}
            />
          </div>

          <div className="w-44 flex-shrink-0 border-l panel-border bg-surface-50/50 dark:bg-surface-900/50 relative">
            <MarginPills
              segments={segments}
              textRef={textRef}
              annotatedHtml={annotatedHtml}
              onClickSegments={setClickedSegments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
