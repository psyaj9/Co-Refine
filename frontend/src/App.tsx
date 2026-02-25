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
import DocumentViewerNew from "@/components/DocumentViewerNew";
import Visualisations from "@/components/Visualisations";
import RightPanel from "@/components/RightPanel";
import HighlightPopover from "@/components/HighlightPopover";

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
      <Toolbar />

      <Group orientation="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize="14%" minSize="10%" maxSize="25%">
          <LeftPanel />
        </Panel>

        <ResizeHandle />

        <Panel defaultSize={showRightPanel ? "68%" : "86%"} minSize="30%">
          <div className="h-full w-full overflow-auto panel-bg">
            {!activeProjectId ? (
              <div className="h-full flex items-center justify-center p-6">
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
              <Visualisations />
            ) : showUpload ? (
              <DocumentUpload />
            ) : (
              <DocumentViewerNew />
            )}
          </div>
        </Panel>

        {showRightPanel && (
          <>
            <ResizeHandle />
            <Panel defaultSize="18%" minSize="12%" maxSize="35%">
              <RightPanel />
            </Panel>
          </>
        )}
      </Group>

      <StatusBar />

      <HighlightPopover />
    </div>
  );
}
