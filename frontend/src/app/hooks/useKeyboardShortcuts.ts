import { useEffect } from "react";

/**
 * Registers Ctrl+B (toggle left panel) and Ctrl+J (toggle right panel)
 * keyboard shortcuts for the main layout.
 */
export function useKeyboardShortcuts(
  toggleLeftPanel: () => void,
  toggleRightPanel: () => void,
  showRightPanel: boolean,
): void {
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
}
