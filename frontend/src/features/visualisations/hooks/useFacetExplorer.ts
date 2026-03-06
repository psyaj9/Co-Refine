import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "@/stores/store";
import { fetchVisFacets } from "@/api/client";
import type { CodeOut, FacetData } from "@/types";

type LoadState = "idle" | "loading" | "error" | "success";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7", "#e11d48", "#22c55e", "#eab308",
  "#3b82f6", "#d946ef", "#64748b",
];

function buildColourMap(facets: FacetData[], codes: CodeOut[]): Record<string, string> {
  const codeIds = Array.from(new Set(facets.map((f) => f.code_id)));
  return Object.fromEntries(
    codeIds.map((id, i) => {
      const stored = codes.find((c) => c.id === id);
      return [id, stored?.colour ?? PALETTE[i % PALETTE.length]];
    }),
  );
}

export function useFacetExplorer(projectId: string) {
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const codes = useStore((s) => s.codes);

  const [facets, setFacets] = useState<FacetData[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [drillCodeId, setDrillCodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    setContainerWidth(Math.floor(el.getBoundingClientRect().width) || 640);
    return () => ro.disconnect();
  }, []);

  const colourMap = useMemo(() => buildColourMap(facets, codes), [facets, codes]);

  const load = useCallback(() => {
    setLoadState("loading");
    fetchVisFacets(projectId)
      .then(({ facets: data }) => { setFacets(data); setLoadState("success"); })
      .catch(() => setLoadState("error"));
  }, [projectId]);

  useEffect(() => { load(); }, [load, visRefreshCounter]);

  useEffect(() => { setDrillCodeId(null); }, [projectId]);

  const handleLabelChange = useCallback((facetId: string, newLabel: string) => {
    setFacets((prev) =>
      prev.map((f) => (f.facet_id === facetId ? { ...f, facet_label: newLabel } : f))
    );
  }, []);

  return {
    facets,
    loadState,
    drillCodeId,
    setDrillCodeId,
    colourMap,
    containerRef,
    containerWidth,
    load,
    handleLabelChange,
  };
}
