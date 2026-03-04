import { useState, useRef, useCallback, type ReactNode } from "react";
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
 * Uses CSS positioning (no portal) to keep it simple and accessible.
 */
export default function MetricTooltip({
  children,
  explanation,
  className,
}: MetricTooltipProps): React.ReactElement {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(true);
  }, []);

  const close = useCallback(() => {
    timeoutRef.current = setTimeout(() => setShow(false), 120);
  }, []);

  return (
    <span
      className={cn("relative inline-flex items-center cursor-help", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      tabIndex={0}
      role="note"
      aria-label={explanation}
    >
      {children}
      {show && (
        <span
          className={cn(
            "absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5",
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
        </span>
      )}
    </span>
  );
}
