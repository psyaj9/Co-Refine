import { useEffect } from "react";
import { useStore } from "@/stores/store";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";

import Toolbar from "@/components/Toolbar";
import StatusBar from "@/components/StatusBar";
import LeftPanel from "@/components/LeftPanel";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentViewer from "@/components/DocumentViewer";
import Visualisations from "@/components/Visualisations";
import EditHistoryView from "@/components/EditHistoryView";
import RightPanel from "@/components/RightPanel";
import HighlightPopover from "@/components/HighlightPopover";
import MobileDisclaimer from "@/components/MobileDisclaimer";

function ResizeHandle() {
  return <Separator />;
}

export default function App() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const showUploadPage = useStore((s) => s.showUploadPage);
  const viewMode = useStore((s) => s.viewMode);
  const loadProjects = useStore((s) => s.loadProjects);

  useWebSocket();

  useEffect(() => {
    loadProjects();
  }, []);

  const showUpload = !activeProjectId || showUploadPage || !activeDocumentId;
  const showRightPanel = !!(activeProjectId && activeDocumentId && !showUploadPage);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100">
      {/* Skip-nav for keyboard users */}
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <Toolbar />

      <Group orientation="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize="14%" minSize="10%" maxSize="25%">
          <nav aria-label="Project and codebook">
            <LeftPanel />
          </nav>
        </Panel>

        <ResizeHandle />

        <Panel defaultSize={showRightPanel ? "68%" : "86%"} minSize="30%">
          <main id="main-content" className="h-full w-full overflow-auto panel-bg" aria-label="Main content">
            {!activeProjectId ? (
              <div className="h-full flex items-center justify-center p-6 view-enter">
                <div className="text-center space-y-3">
                  <h2 className="text-2xl font-bold text-surface-400 dark:text-surface-500">
                    Select or create a project
                  </h2>
                  <p className="text-sm text-surface-400 dark:text-surface-500 max-w-sm">
                    Use the left panel to create a new project or select an
                    existing one to get started
                  </p>
                </div>
              </div>
            ) : viewMode === "visualisation" ? (
              <div className="view-enter h-full"><Visualisations /></div>
            ) : viewMode === "history" ? (
              <div className="view-enter h-full"><EditHistoryView /></div>
            ) : showUpload ? (
              <div className="view-enter h-full"><DocumentUpload /></div>
            ) : (
              <DocumentViewer />
            )}
          </main>
        </Panel>

        {showRightPanel && (
          <>
            <ResizeHandle />
            <Panel defaultSize="18%" minSize="12%" maxSize="35%">
              <aside aria-label="Alerts and AI chat">
                <RightPanel />
              </aside>
            </Panel>
          </>
        )}
      </Group>

      <StatusBar />

      <HighlightPopover />
      <MobileDisclaimer />
    </div>
  );
}
