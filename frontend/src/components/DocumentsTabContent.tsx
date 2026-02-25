import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/store";
import {
  FileText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listItem, easeFast } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function DocumentsTabContent() {
  const documents = useStore((s) => s.documents);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const setActiveDocument = useStore((s) => s.setActiveDocument);
  const loadSegments = useStore((s) => s.loadSegments);
  const setShowUploadPage = useStore((s) => s.setShowUploadPage);
  const deleteDocument = useStore((s) => s.deleteDocument);
  const docSearchQuery = useStore((s) => s.docSearchQuery);
  const setDocSearchQuery = useStore((s) => s.setDocSearchQuery);
  const reduced = useReducedMotion();

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const handleDeleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this document and all its coded segments?")) return;
    await deleteDocument(id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden tab-content-enter">
      {documents.length > 3 && (
        <div className="px-2 pt-2 pb-1 flex-shrink-0">
          <div className="relative">
            <Search
              size={10}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400"
              aria-hidden="true"
            />
            <input
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              placeholder="Filter documents..."
              aria-label="Filter documents"
              className="w-full rounded border panel-border pl-6 pr-2 py-0.5 text-2xs bg-transparent dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
        </div>
      )}

      <ul className="flex-1 overflow-auto px-2 pb-2 thin-scrollbar space-y-0.5" role="listbox" aria-label="Documents">
        {filteredDocs.length === 0 && (
          <li role="presentation" className="text-center py-8">
            <FileText
              size={24}
              className="mx-auto text-surface-300 dark:text-surface-600 mb-2"
              aria-hidden="true"
            />
            <p className="text-xs text-surface-400 italic">No documents yet</p>
            <button
              onClick={() => setShowUploadPage(true)}
              className="mt-3 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Upload size={11} className="inline mr-1" aria-hidden="true" />
              Upload Document
            </button>
          </li>
        )}
        <AnimatePresence initial={false}>
          {filteredDocs.map((doc) => (
            <motion.li
              key={doc.id}
              variants={reduced ? undefined : listItem}
              initial={reduced ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={easeFast}
              layout={!reduced}
              role="option"
              aria-selected={activeDocumentId === doc.id}
              tabIndex={0}
              onClick={() => {
                setActiveDocument(doc.id);
                loadSegments(doc.id);
                setShowUploadPage(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveDocument(doc.id);
                  loadSegments(doc.id);
                  setShowUploadPage(false);
                }
              }}
              className={cn(
                "group cursor-pointer rounded px-2 py-1.5 text-xs flex items-center gap-1.5 transition-colors",
                "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                activeDocumentId === doc.id
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                  : "text-surface-600 dark:text-surface-300 panel-hover"
              )}
            >
              <FileText size={11} className="flex-shrink-0 text-surface-400" aria-hidden="true" />
              <span className="flex-1 truncate">{doc.title}</span>
              <button
                onClick={(e) => handleDeleteDocument(e, doc.id)}
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-surface-400 hover:text-red-500 flex-shrink-0 transition-opacity"
                title="Delete document"
                aria-label={`Delete ${doc.title}`}
              >
                <Trash2 size={10} aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
