import { useEffect, useState } from "react";
import { useStore } from "@/shared/store";
import { fetchVisConsistency } from "@/shared/api/client";
import type { ConsistencyData } from "@/shared/types";

type LoadState = "idle" | "loading" | "error" | "success";

export function useConsistencyData(projectId: string): {
  data: ConsistencyData | null;
  state: LoadState;
  selectedVisCodeId: string | null;
  setSelectedVisCodeId: (id: string | null) => void;
  threshold: number;
} {
  const selectedVisCodeId = useStore((s) => s.selectedVisCodeId);
  const setSelectedVisCodeId = useStore((s) => s.setSelectedVisCodeId);
  const visRefreshCounter = useStore((s) => s.visRefreshCounter);
  const projectSettings = useStore((s) => s.projectSettings);

  const [data, setData] = useState<ConsistencyData | null>(null);
  const [state, setState] = useState<LoadState>("idle");

  const threshold =
    projectSettings?.thresholds?.consistency_escalation_threshold ?? 0.7;

  useEffect(() => {
    setState("loading");
    fetchVisConsistency(projectId, selectedVisCodeId)
      .then((d) => { setData(d); setState("success"); })
      .catch(() => setState("error"));
  }, [projectId, selectedVisCodeId, visRefreshCounter]);

  return { data, state, selectedVisCodeId, setSelectedVisCodeId, threshold };
}
