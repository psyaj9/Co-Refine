/**
 * Shared D3 utilities for the visualisation layer.
 *
 * - useD3: React hook that binds a D3 render function to a ref with ResizeObserver
 * - Colormaps: sequential (Plasma), diverging (RdYlBu) wrappers
 * - Margin convention helper
 */

import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: Margin = { top: 24, right: 16, bottom: 32, left: 100 };

/* ── useD3 hook ─────────────────────────────────────────────────────── */

/**
 * Binds a D3 render function to a container ref.
 * Re-renders on data changes (via `deps`) and on resize.
 */
export function useD3<E extends SVGSVGElement | HTMLCanvasElement>(
  renderFn: (
    container: d3.Selection<E, unknown, null, undefined>,
    width: number,
    height: number,
  ) => void,
  deps: unknown[],
) {
  const ref = useRef<E | null>(null);

  const render = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const sel = d3.select(el) as d3.Selection<E, unknown, null, undefined>;
    renderFn(sel, width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderFn, ...deps]);

  useEffect(() => {
    render();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(el);
    return () => ro.disconnect();
  }, [render]);

  return ref;
}

/* ── Colour-scale factories ─────────────────────────────────────────── */

/** Sequential Plasma scale: 0 → dark purple, 1 → bright yellow */
export function plasmaScale(domain: [number, number] = [0, 1]) {
  return d3.scaleSequential(d3.interpolatePlasma).domain(domain);
}

/** Diverging RdYlBu: 0 → red, 0.5 → yellow, 1 → blue */
export function agreementScale(domain: [number, number] = [0, 1]) {
  return d3.scaleSequential(d3.interpolateRdYlBu).domain(domain);
}

/* ── Tooltip helpers ────────────────────────────────────────────────── */

let _tip: HTMLDivElement | null = null;

function ensureTip(): HTMLDivElement {
  if (_tip) return _tip;
  _tip = document.createElement("div");
  Object.assign(_tip.style, {
    position: "fixed",
    pointerEvents: "none",
    padding: "6px 10px",
    fontSize: "12px",
    lineHeight: "1.4",
    background: "rgba(15,15,15,0.92)",
    color: "#e5e5e5",
    borderRadius: "6px",
    zIndex: "9999",
    maxWidth: "280px",
    transition: "opacity 80ms",
    opacity: "0",
    whiteSpace: "pre-line",
  });
  document.body.appendChild(_tip);
  return _tip;
}

export function showTooltip(html: string, event: MouseEvent) {
  const tip = ensureTip();
  tip.innerHTML = html;
  tip.style.opacity = "1";
  const x = event.clientX + 12;
  const y = event.clientY + 12;
  tip.style.left = `${Math.min(x, window.innerWidth - 300)}px`;
  tip.style.top = `${Math.min(y, window.innerHeight - 80)}px`;
}

export function hideTooltip() {
  if (_tip) _tip.style.opacity = "0";
}

/* ── Misc ───────────────────────────────────────────────────────────── */

/** Inner dimensions after subtracting margins */
export function innerSize(w: number, h: number, m: Margin) {
  return {
    iw: Math.max(0, w - m.left - m.right),
    ih: Math.max(0, h - m.top - m.bottom),
  };
}
