import { useEffect, useState, useCallback } from "react";
import { fetchVisCooccurrence } from "@/shared/api/client";
import type { CodeCooccurrenceData } from "@/shared/types";

type LoadState = "idle" | "loading" | "error" | "success";

export function useCooccurrence(projectId: string): {
  state: LoadState;
  data: CodeCooccurrenceData | null;
  reload: () => void;
} {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<CodeCooccurrenceData | null>(null);

  const load = useCallback(() => {
    setState("loading");
    fetchVisCooccurrence(projectId)
      .then((d) => { setData(d); setState("success"); })
      .catch(() => setState("error"));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return { state, data, reload: load };
}
