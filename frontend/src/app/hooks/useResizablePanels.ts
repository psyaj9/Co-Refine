import { useState, useCallback, useEffect } from "react";
import { usePanelRef } from "react-resizable-panels";

/**
 * Manages collapse state for the left and right resizable panels.
 * Returns panel refs, collapse state flags, and toggle callbacks.
 */
export function useResizablePanels(showRightPanel: boolean) {
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

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

  // Reset right panel collapse state when panel becomes hidden
  useEffect(() => {
    if (!showRightPanel) setRightCollapsed(false);
  }, [showRightPanel]);

  return {
    leftPanelRef,
    rightPanelRef,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
  };
}
