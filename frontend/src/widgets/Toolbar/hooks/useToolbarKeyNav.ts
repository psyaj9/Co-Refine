import { useRef, useCallback } from "react";

export function useToolbarKeyNav() {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons || buttons.length === 0) return;

    const btnArr = Array.from(buttons);
    const idx = btnArr.indexOf(e.target as HTMLButtonElement);
    if (idx === -1) return;

    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % btnArr.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + btnArr.length) % btnArr.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btnArr.length - 1;

    if (next >= 0) {
      e.preventDefault();
      btnArr[next].focus();
    }
  }, []);

  return { toolbarRef, handleToolbarKeyDown };
}
