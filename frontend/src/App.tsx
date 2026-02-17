import { useEffect } from "react";
import { useStore } from "./stores/store";
import { useWebSocket } from "./hooks/useWebSocket";

import Sidebar from "./components/Sidebar";
import DocumentUpload from "./components/DocumentUpload";
import DocumentViewer from "./components/DocumentViewer";
import AlertPanel from "./components/AlertPanel";

export default function App() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const showUploadPage = useStore((s) => s.showUploadPage);
  const loadProjects = useStore((s) => s.loadProjects);

  useWebSocket();

  useEffect(() => {
    loadProjects();
  }, []);

  if (!activeProjectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <h1 className="text-xl font-bold text-slate-800">
              The Inductive Lens
            </h1>
            <span className="text-xs text-slate-400">
              Qualitative coding with AI-assisted analysis
            </span>
          </header>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-300 mb-2">
                Select or create a project
              </h2>
              <p className="text-sm text-slate-400">
                Use the sidebar to create a new project, or open an existing one.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const showUpload = showUploadPage || !activeDocumentId;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-xl font-bold text-slate-800">
            The Inductive Lens
          </h1>
          <span className="text-xs text-slate-400">
            Highlight text → Assign code → AI watches for drift
          </span>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {showUpload ? <DocumentUpload /> : <DocumentViewer />}
        </div>
      </main>

      <AlertPanel />
    </div>
  );
}
