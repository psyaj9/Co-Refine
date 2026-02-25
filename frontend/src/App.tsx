import { useEffect, useCallback, useState } from "react";
import { useStore } from "@/stores/store";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from "react-resizable-panels";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeIn, easeFast } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import Toolbar from "@/components/Toolbar";
import StatusBar from "@/components/StatusBar";
import LeftPanel from "@/components/LeftPanel";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentViewer from "@/components/DocumentViewer";
import Visualisations from "@/components/Visualisations";
import EditHistoryView from "@/components/EditHistoryView";
import RightPanel from "@/components/RightPanel";
import HighlightPopover from "@/components/HighlightPopover";

const PANEL_IDS = ["left-panel", "center-panel", "right-panel"];

export default function App() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeDocumentId = useStore((s) => s.activeDocumentId);
  const showUploadPage = useStore((s) => s.showUploadPage);
  const viewMode = useStore((s) => s.viewMode);
  const loadProjects = useStore((s) => s.loadProjects);

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "concept-test-layout",
    panelIds: PANEL_IDS,
    storage: localStorage,
  });

  const reduced = useReducedMotion();

  useWebSocket();

  useEffect(() => {
    loadProjects();
  }, []);

  const showUpload = !activeProjectId || showUploadPage || !activeDocumentId;
  const showRightPanel = !!(activeProjectId && activeDocumentId && !showUploadPage);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const toggleLeftPanel = useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setLeftCollapsed(false);
    } else {
      panel.collapse();
      setLeftCollapsed(true);
    }
  }, [leftPanelRef]);

  const toggleRightPanel = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setRightCollapsed(false);
    } else {
      panel.collapse();
      setRightCollapsed(true);
    }
  }, [rightPanelRef]);

  /* Keyboard shortcuts: Ctrl+B = toggle left, Ctrl+J = toggle right */
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
        >
          <nav aria-label="Project and codebook" className="h-full">
            <LeftPanel />
          </nav>
        </Panel>

        <ResizeHandle onToggle={toggleLeftPanel} side="left" collapsed={leftCollapsed} />

        <Panel id="center-panel" defaultSize="68%" minSize="30%">
          <main id="main-content" className="h-full w-full overflow-auto panel-bg" aria-label="Main content">
            <AnimatePresence mode="wait">
              {!activeProjectId ? (
                <motion.div
                  key="no-project"
                  className="h-full flex items-center justify-center p-6"
                  variants={reduced ? undefined : fadeIn}
                  initial={reduced ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeFast}
                >
                  <div className="text-center space-y-3">
                    <h2 className="text-fluid-xl font-bold text-surface-400 dark:text-surface-500">
                      Select or create a project
                    </h2>
                    <p className="text-fluid-sm text-surface-400 dark:text-surface-500 max-w-sm">
                      Use the left panel to create a new project or select an
                      existing one to get started
                    </p>
                  </div>
                </motion.div>
              ) : viewMode === "visualisation" ? (
                <motion.div
                  key="vis"
                  className="h-full"
                  variants={reduced ? undefined : fadeIn}
                  initial={reduced ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeFast}
                >
                  <Visualisations />
                </motion.div>
              ) : viewMode === "history" ? (
                <motion.div
                  key="history"
                  className="h-full"
                  variants={reduced ? undefined : fadeIn}
                  initial={reduced ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeFast}
                >
                  <EditHistoryView />
                </motion.div>
              ) : showUpload ? (
                <motion.div
                  key="upload"
                  className="h-full"
                  variants={reduced ? undefined : fadeIn}
                  initial={reduced ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeFast}
                >
                  <DocumentUpload />
                </motion.div>
              ) : (
                <motion.div
                  key="viewer"
                  className="h-full"
                  variants={reduced ? undefined : fadeIn}
                  initial={reduced ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeFast}
                >
                  <DocumentViewer />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </Panel>

        {showRightPanel && (
          <>
            <ResizeHandle onToggle={toggleRightPanel} side="right" collapsed={rightCollapsed} />
            <Panel
              id="right-panel"
              defaultSize="18%"
              minSize="12%"
              maxSize="35%"
              collapsible
              collapsedSize="0%"
              panelRef={rightPanelRef}
            >
              <aside aria-label="Alerts and AI chat" className="h-full">
                <RightPanel />
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

function ResizeHandle({
  onToggle,
  side,
  collapsed,
}: {
  onToggle?: () => void;
  side?: "left" | "right";
  collapsed?: boolean;
}): React.ReactElement {
  const labelMap = {
    left: collapsed ? "Expand left panel (Ctrl+B)" : "Collapse left panel (Ctrl+B)",
    right: collapsed ? "Expand right panel (Ctrl+J)" : "Collapse right panel (Ctrl+J)",
  };

  return (
    <div
      className="relative group/sep flex-shrink-0"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
    >
      <Separator />
      {onToggle && (
        <button
          onClick={onToggle}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-10",
            /* WCAG 2.2 Target Size: 24×40px — meets 24×24 minimum */
            "w-6 h-10 flex items-center justify-center",
            "rounded-md bg-surface-200 dark:bg-surface-700 border panel-border",
            "text-surface-500 dark:text-surface-400",
            /* Always visible at reduced opacity so keyboard/touch users can discover it */
            "opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200",
            "hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400",
            "focus-visible:ring-2 focus-visible:ring-brand-500",
            side === "left" ? "-left-3" : "-right-3"
          )}
          aria-label={side ? labelMap[side] : "Toggle panel"}
        >
          {side === "left" ? (
            collapsed
              ? <PanelLeftOpen size={12} aria-hidden="true" />
              : <PanelLeftClose size={12} aria-hidden="true" />
          ) : (
            collapsed
              ? <PanelRightOpen size={12} aria-hidden="true" />
              : <PanelRightClose size={12} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
