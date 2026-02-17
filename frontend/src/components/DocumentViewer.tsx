import { useRef, useEffect, useMemo, useCallback } from "react";
import { useStore } from "../stores/store";
import { useTextSelection } from "../hooks/useTextSelection";
import HighlightPopover from "./HighlightPopover";
import type { SegmentOut } from "../types";

export default function DocumentViewer() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const segments = useStore((s) => s.segments);
  const selection = useStore((s) => s.selection);
  const clickedSegments = useStore((s) => s.clickedSegments);
  const setClickedSegments = useStore((s) => s.setClickedSegments);
  const loadSegments = useStore((s) => s.loadSegments);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleMouseUp = useTextSelection(containerRef);

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
      if (matched.length > 0) {
        setClickedSegments(matched);
      }
    },
    [segments, setClickedSegments]
  );

  const annotatedHtml = useMemo(() => {
    if (!doc) return "";
    return buildAnnotatedText(doc.full_text, segments);
  }, [doc, segments]);

  if (!doc) return null;

  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-700">{doc.title}</h2>
        <p className="text-xs text-slate-400">
          {doc.doc_type} · {doc.full_text.length.toLocaleString()} characters ·{" "}
          {segments.length} coded segment{segments.length !== 1 && "s"}
        </p>
      </div>

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        className="bg-white rounded-xl border border-slate-200 p-6 text-sm leading-relaxed whitespace-pre-wrap selection:bg-blue-100 shadow-sm cursor-text"
        dangerouslySetInnerHTML={{ __html: annotatedHtml }}
      />

      {(selection || clickedSegments) && (
        <HighlightPopover containerRef={containerRef} />
      )}
    </div>
  );
}

function mergeRanges(
  segments: SegmentOut[]
): { start: number; end: number }[] {
  if (segments.length === 0) return [];

  const sorted = segments
    .map((s) => ({ start: s.start_index, end: s.end_index }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    if (sorted[i].start <= prev.end) {
      prev.end = Math.max(prev.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function buildAnnotatedText(
  fullText: string,
  segments: SegmentOut[]
): string {
  if (segments.length === 0) return escapeHtml(fullText);

  const ranges = mergeRanges(segments);
  const parts: string[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (cursor < range.start) {
      parts.push(escapeHtml(fullText.slice(cursor, range.start)));
    }
    parts.push(
      `<mark data-start="${range.start}" data-end="${range.end}">${escapeHtml(
        fullText.slice(range.start, range.end)
      )}</mark>`
    );
    cursor = range.end;
  }

  if (cursor < fullText.length) {
    parts.push(escapeHtml(fullText.slice(cursor)));
  }

  return parts.join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
