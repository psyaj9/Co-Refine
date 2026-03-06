import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/stores/store";
import { fetchVisOverlap } from "@/api/client";
import type { CodeOverlapData } from "@/types";

type LoadState = "idle" | "loading" | "error" | "success";

export function useCodeOverlap(projectId: string): {
  state: LoadState;
  matrix: Record<string, Record<string, number>> | null;
  labels: string[];
  threshold: number;
  reload: () => void;
} {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<CodeOverlapData | null>(null);
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const liveMatrix = useStore((s) => s.overlapMatrix);

  const load = useCallback(() => {
    setState("loading");
    fetchVisOverlap(projectId)
      .then((d) => { setData(d); setState("success"); })
      .catch(() => setState("error"));
  }, [projectId]);

  useEffect(() => { load(); }, [load, visRefreshCounter]);

  const matrix = liveMatrix ?? data?.matrix ?? null;
  const labels = liveMatrix ? Object.keys(liveMatrix) : data?.code_labels ?? [];
  const threshold = data?.threshold ?? 0.85;

  return { state, matrix, labels, threshold, reload: load };
}
