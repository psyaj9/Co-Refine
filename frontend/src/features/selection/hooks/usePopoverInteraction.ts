import { useEffect, useCallback, useRef, useState } from "react";
import { useStore } from "@/stores/store";

/**
 * Shared interaction logic for both popover views:
 * - Keyboard Escape to dismiss
 * - Focus trap within popover
 * - dismiss / handleApply handlers
 */
export function usePopoverInteraction() {
  const clearPendingApplications = useStore((s) => s.clearPendingApplications);
  const confirmPendingApplications = useStore((s) => s.confirmPendingApplications);
  const setSelection = useStore((s) => s.setSelection);
  const setClickedSegments = useStore((s) => s.setClickedSegments);

  const [applying, setApplying] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    clearPendingApplications();
    setSelection(null);
    setClickedSegments(null);
  }, [clearPendingApplications, setSelection, setClickedSegments]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      await confirmPendingApplications();
    } finally {
      setApplying(false);
    }
    setSelection(null);
    setClickedSegments(null);
  }, [confirmPendingApplications, setSelection, setClickedSegments]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dismiss]);

  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = popoverRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return { popoverRef, applying, dismiss, handleApply, handleFocusTrap };
}
