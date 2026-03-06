import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/stores/store";
import { fetchVisOverview } from "@/api/client";
import type { OverviewData } from "@/types";

export type VisLoadState = "idle" | "loading" | "error" | "success";

export function useVisOverview(projectId: string): {
  data: OverviewData | null;
  state: VisLoadState;
  reload: () => void;
} {
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const [data, setData] = useState<OverviewData | null>(null);
  const [state, setState] = useState<VisLoadState>("idle");
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setState("loading");
    fetchVisOverview(projectId)
      .then((d) => { setData(d); setState("success"); })
      .catch(() => setState("error"));
  }, [projectId, visRefreshCounter, tick]);

  return { data, state, reload };
}
