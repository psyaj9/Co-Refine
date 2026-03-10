import { useStore } from "@/shared/store";
import { FileText, X, ArrowRight } from "lucide-react";
import { hexToRgba } from "@/shared/lib/utils";

export default function RetrievedSegments() {
  const retrievedSegments = useStore((s) => s.retrievedSegments);
  const retrievedCodeId = useStore((s) => s.retrievedCodeId);
  const codes = useStore((s) => s.codes);
  const documents = useStore((s) => s.documents);
  const setActiveDocument = useStore((s) => s.setActiveDocument);
  const loadSegments = useStore((s) => s.loadSegments);
  const clearRetrievedSegments = useStore((s) => s.clearRetrievedSegments);
  const setShowUploadPage = useStore((s) => s.setShowUploadPage);
  const setScrollToSegmentId = useStore((s) => s.setScrollToSegmentId);

  const activeCode = codes.find((c) => c.id === retrievedCodeId);

  if (!activeCode) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-xs text-surface-400 dark:text-surface-500 italic">
            Double-click a code in the explorer to retrieve all its segments across documents.
          </p>
        </div>
      </div>
    );
  }

  const byDoc = new Map<string, typeof retrievedSegments>();
  for (const seg of retrievedSegments) {
    if (!byDoc.has(seg.document_id)) byDoc.set(seg.document_id, []);
    byDoc.get(seg.document_id)!.push(seg);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b panel-border flex-shrink-0">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: activeCode.colour }}
        />
        <button
          onClick={clearRetrievedSegments}
          title="Close"
          aria-label="Close segments panel"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-3 thin-scrollbar">
        {Array.from(byDoc.entries()).map(([docId, segs]) => {
          const doc = documents.find((d) => d.id === docId);
          return (
            <div key={docId}>
              <button
                onClick={() => {
                  setActiveDocument(docId);
                  loadSegments(docId);
                  setShowUploadPage(false);
                }}
                className="flex items-center gap-1 text-2xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 mb-1"
              >
                <FileText size={10} />
                {doc?.title || "Unknown Document"}
                <ArrowRight size={8} />
              </button>
              <ul className="space-y-1" role="list" aria-label={`Segments in ${doc?.title || 'document'}`}>
                {segs.map((seg) => (
                  <li
                    key={seg.id}
                    role="button"
                    tabIndex={0}
                    className="rounded p-2 text-2xs leading-relaxed cursor-pointer panel-hover transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                    style={{
                      borderLeft: `3px solid ${seg.code_colour}`,
                      backgroundColor: `${hexToRgba(seg.code_colour, 0.05)}`,
                    }}
                    onClick={() => {
                      setActiveDocument(seg.document_id);
                      loadSegments(seg.document_id);
                      setShowUploadPage(false);
                      setScrollToSegmentId(seg.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveDocument(seg.document_id);
                        loadSegments(seg.document_id);
                        setShowUploadPage(false);
                        setScrollToSegmentId(seg.id);
                      }
                    }}
                  >
                    <p className="text-surface-600 dark:text-surface-300 line-clamp-4">
                      "{seg.text}"
                    </p>
                    <p className="text-2xs text-surface-400 mt-1">
                      chars {seg.start_index}–{seg.end_index}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
