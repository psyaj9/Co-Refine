import { useEffect, useCallback, useState } from "react";
import { useStore } from "@/shared/store";
import { useWebSocket } from "@/shared/hooks/useWebSocket";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from "react-resizable-panels";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

import { Toolbar } from "@/widgets/Toolbar";
import { StatusBar } from "@/widgets/StatusBar";
import { LeftPanel } from "@/widgets/LeftPanel";
import { RightPanel } from "@/widgets/RightPanel";
import { DocumentUpload, DocumentViewer } from "@/features/documents";
import { Visualisations } from "@/features/visualisations";
import { EditHistoryView } from "@/features/history";
import { HighlightPopover } from "@/features/selection";
import { LoginPage, RegisterPage } from "@/features/auth";

const PANEL_IDS = ["left-panel", "center-panel", "right-panel"];

export default function App() {
  const authUser = useStore((s) => s.authUser);
  const initAuth = useStore((s) => s.initAuth);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const showUploadPage = useStore((s) => s.showUploadPage);
  const viewMode = useStore((s) => s.viewMode);
  const loadProjects = useStore((s) => s.loadProjects);

  const [showRegister, setShowRegister] = useState(false);

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "concept-test-layout",
    panelIds: PANEL_IDS,
    storage: localStorage,
  });

  const logout = useStore((s) => s.logout);

  useWebSocket();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (authUser) loadProjects();
  }, [authUser]);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("co_refine:unauthorized", handler);
    return () => window.removeEventListener("co_refine:unauthorized", handler);
  }, [logout]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const showRightPanel = !!(activeProjectId && activeDocumentId && !showUploadPage);

  const toggleLeftPanel = useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [leftPanelRef]);

  const toggleRightPanel = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [rightPanelRef]);

  useEffect(() => {
    if (!showRightPanel) setRightCollapsed(false);
  }, [showRightPanel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleLeftPanel();
      }
      if (e.ctrlKey && e.key === "j" && showRightPanel) {
        e.preventDefault();
        toggleRightPanel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleLeftPanel, toggleRightPanel, showRightPanel]);

  if (!authUser) {
    return showRegister ? (
      <RegisterPage onShowLogin={() => setShowRegister(false)} />
    ) : (
      <LoginPage onShowRegister={() => setShowRegister(true)} />
    );
  }

  const showUpload = !activeProjectId || showUploadPage || !activeDocumentId;

  return (
    <div className="flex flex-col h-screen h-dvh overflow-hidden bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100">
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <Toolbar />

      <Group
        orientation="horizontal"
        className="flex-1 min-h-0"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="left-panel"
          defaultSize="14%"
          minSize="10%"
          maxSize="25%"
          collapsible
          collapsedSize="0%"
          panelRef={leftPanelRef}
          onResize={(size) => setLeftCollapsed(size.asPercentage === 0)}
        >
          <nav aria-label="Project and codebook" className="h-full">
            <LeftPanel onCollapse={toggleLeftPanel} />
          </nav>
        </Panel>

        {leftCollapsed && (
          <button
            onClick={toggleLeftPanel}
            className="flex-shrink-0 w-6 flex items-center justify-center bg-surface-100 dark:bg-surface-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-r panel-border transition-colors cursor-pointer"
            aria-label="Expand left panel (Ctrl+B)"
            title="Expand left panel (Ctrl+B)"
          >
            <PanelLeftOpen size={12} className="text-surface-400 hover:text-brand-500" aria-hidden="true" />
          </button>
        )}

        <ResizeHandle />

        <Panel id="center-panel" defaultSize="68%" minSize="30%">
          <main id="main-content" className="h-full w-full overflow-auto panel-bg" aria-label="Main content">
            {!activeProjectId ? (
              <div className="h-full flex items-center justify-center p-6 view-enter">
                <div className="text-center space-y-3">
                  <h2 className="text-fluid-xl font-bold text-surface-400 dark:text-surface-500">
                    Select or create a project
                  </h2>
                  <p className="text-fluid-sm text-surface-400 dark:text-surface-500 max-w-sm">
                    Use the left panel to create a new project or select an
                    existing one to get started
                  </p>
                </div>
              </div>
            ) : viewMode === "dashboard" ? (
              <div className="h-full view-enter">
                <Visualisations projectId={activeProjectId} />
              </div>
            ) : viewMode === "history" ? (
              <div className="h-full view-enter">
                <EditHistoryView />
              </div>
            ) : showUpload ? (
              <div className="h-full view-enter">
                <DocumentUpload />
              </div>
            ) : (
              <div className="h-full view-enter">
                <DocumentViewer />
              </div>
            )}
          </main>
        </Panel>

        {showRightPanel && (
          <>
            <ResizeHandle />

            {rightCollapsed && (
              <button
                onClick={toggleRightPanel}
                className="flex-shrink-0 w-6 flex items-center justify-center bg-surface-100 dark:bg-surface-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-l panel-border transition-colors cursor-pointer"
                aria-label="Expand right panel (Ctrl+J)"
                title="Expand right panel (Ctrl+J)"
              >
                <PanelRightOpen size={12} className="text-surface-400 hover:text-brand-500" aria-hidden="true" />
              </button>
            )}

            <Panel
              id="right-panel"
              defaultSize="18%"
              minSize="12%"
              maxSize="35%"
              collapsible
              collapsedSize="0%"
              panelRef={rightPanelRef}
              onResize={(size) => setRightCollapsed(size.asPercentage === 0)}
            >
              <aside aria-label="Alerts and AI chat" className="h-full">
                <RightPanel onCollapse={toggleRightPanel} />
              </aside>
            </Panel>
          </>
        )}
      </Group>

      <StatusBar />

      <HighlightPopover />
    </div>
  );
}

function ResizeHandle(): React.ReactElement {
  return <Separator className="separator-handle" />;
}
