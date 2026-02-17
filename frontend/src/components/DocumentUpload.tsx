import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";
import { useStore } from "../stores/store";
import * as api from "../api/client";

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
        // Navigate to the last uploaded document
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
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-700">Add Documents</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a document or paste text to begin qualitative coding.
        </p>
      </div>

      {/* Drag-and-drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition
          ${
            isDragActive
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto text-slate-400 mb-3" size={36} />
        {uploading ? (
          <p className="text-sm text-blue-600 font-medium">
            Uploading {uploadCount} of {uploadTotal}...
          </p>
        ) : isDragActive ? (
          <p className="text-sm text-blue-600 font-medium">
            Drop the file(s) here
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600 font-medium">
              Drag &amp; drop files here, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              TXT, DOCX, PDF supported · Multiple files allowed
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          or paste text
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="space-y-3">
        <input
          value={pasteTitle}
          onChange={(e) => setPasteTitle(e.target.value)}
          placeholder="Document title..."
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your transcript, poem, essay, interview, etc..."
          rows={8}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
        />
        <button
          onClick={handlePaste}
          disabled={!pasteTitle.trim() || !pasteText.trim()}
          className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <FileText size={14} />
          Import Text
        </button>
      </div>
    </div>
  );
}
