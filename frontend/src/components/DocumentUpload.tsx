import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";
import { useStore } from "@/stores/store";
import * as api from "@/api/client";

export default function DocumentUpload() {
  const {
    activeProjectId,
    loadDocuments,
    setActiveDocument,
    loadSegments,
    setShowUploadPage,
  } = useStore();

  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || !activeProjectId) return;
      setUploading(true);
      setUploadTotal(acceptedFiles.length);
      setUploadCount(0);

      let lastId = "";
      try {
        for (const file of acceptedFiles) {
          const res = await api.uploadDocument(file, "", "transcript", activeProjectId);
          lastId = res.id;
          setUploadCount((c) => c + 1);
        }
        await loadDocuments();
        if (lastId) {
          setActiveDocument(lastId);
          loadSegments(lastId);
          setShowUploadPage(false);
        }
      } catch (e: any) {
        alert(`Upload failed: ${e.message}`);
      } finally {
        setUploading(false);
        setUploadCount(0);
        setUploadTotal(0);
      }
    },
    [activeProjectId, loadDocuments, setActiveDocument, loadSegments, setShowUploadPage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    multiple: true,
  });

  const handlePaste = async () => {
    if (!pasteTitle.trim() || !pasteText.trim() || !activeProjectId) return;
    try {
      const res = await api.pasteDocument(
        pasteTitle.trim(),
        pasteText.trim(),
        "transcript",
        activeProjectId
      );
      await loadDocuments();
      setActiveDocument(res.id);
      loadSegments(res.id);
      setShowUploadPage(false);
      setPasteTitle("");
      setPasteText("");
    } catch (e: any) {
      alert(`Paste failed: ${e.message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-10 px-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-surface-700 dark:text-surface-100">
          Add Documents
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Upload a document or paste text to begin qualitative coding.
        </p>
      </div>

      {/* Drag-and-drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition
          ${
            isDragActive
              ? "border-brand-400 bg-brand-50 dark:bg-brand-700/20"
              : "border-surface-300 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800"
          }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto text-surface-400 dark:text-surface-500 mb-3" size={36} />
        {uploading ? (
          <p className="text-sm text-brand-600 dark:text-brand-400 font-medium">
            Uploading {uploadCount} of {uploadTotal}...
          </p>
        ) : isDragActive ? (
          <p className="text-sm text-brand-600 dark:text-brand-400 font-medium">
            Drop the file(s) here
          </p>
        ) : (
          <>
            <p className="text-sm text-surface-600 dark:text-surface-300 font-medium">
              Drag &amp; drop files here, or click to browse
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
              TXT, DOCX, PDF supported · Multiple files allowed
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
        <span className="text-xs text-surface-400 uppercase tracking-wider">
          or paste text
        </span>
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
      </div>

      <div className="space-y-3">
        <input
          value={pasteTitle}
          onChange={(e) => setPasteTitle(e.target.value)}
          placeholder="Document title..."
          className="w-full rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600"
        />
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your transcript, poem, essay, interview, etc..."
          rows={8}
          className="w-full rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 resize-y"
        />
        <button
          onClick={handlePaste}
          disabled={!pasteTitle.trim() || !pasteText.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 transition"
        >
          <FileText size={14} />
          Import Text
        </button>
      </div>
    </div>
  );
}
