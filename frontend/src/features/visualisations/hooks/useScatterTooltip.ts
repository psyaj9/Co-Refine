import { useState } from "react";

export interface ScatterTooltip {
  x: number;
  y: number;
  text: string;
}

const TOOLTIP_W = 260;
const TOOLTIP_H = 120;

export function useScatterTooltip(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [tooltip, setTooltip] = useState<ScatterTooltip | null>(null);

  function showTooltip(e: React.MouseEvent, text: string): void {
    if (!text) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let x = e.clientX - rect.left + 12;
    let y = e.clientY - rect.top + 12;
    if (x + TOOLTIP_W > rect.width) x = e.clientX - rect.left - TOOLTIP_W - 8;
    if (y + TOOLTIP_H > rect.height) y = e.clientY - rect.top - TOOLTIP_H - 8;
    setTooltip({ x, y, text });
  }

  function hideTooltip(): void {
    setTooltip(null);
  }

  return { tooltip, showTooltip, hideTooltip };
}
