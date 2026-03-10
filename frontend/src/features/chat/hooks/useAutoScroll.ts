import { useEffect, useRef } from "react";

/** Returns a ref to attach to a scrollable container. Scrolls to bottom whenever deps change. */
export function useAutoScroll<T = unknown>(deps: T[]): React.RefObject<HTMLDivElement | null> {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scrollRef;
}
