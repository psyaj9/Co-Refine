import { useState, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface MetricTooltipProps {
  /** The content to wrap (typically a metric label + value) */
  children: ReactNode;
  /** Plain-language explanation shown on hover */
  explanation: string;
  /** Optional extra class on the wrapper */
  className?: string;
}

/**
 * Lightweight tooltip that shows a plain-language explanation on hover/focus.
 * Uses a React portal (renders to document.body) so it escapes any overflow:hidden
 * ancestor (e.g. react-resizable-panels) and is never clipped.
 */
export default function MetricTooltip({
  children,
  explanation,
  className,
}: MetricTooltipProps): React.ReactElement {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  }, []);

  const close = useCallback(() => {
    timeoutRef.current = setTimeout(() => setShow(false), 120);
  }, []);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex items-center cursor-help", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      tabIndex={0}
      role="note"
      aria-label={explanation}
    >
      {children}
      {show &&
        createPortal(
          <span
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className={cn(
              "w-56 px-2.5 py-2 rounded-md shadow-lg",
              "bg-surface-800 dark:bg-surface-100 text-white dark:text-surface-900",
              "text-[10px] leading-snug font-normal",
              "pointer-events-none",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
            role="tooltip"
          >
            {explanation}
            {/* Arrow */}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-800 dark:border-t-surface-100" />
          </span>,
          document.body,
        )}
    </span>
  );
}
