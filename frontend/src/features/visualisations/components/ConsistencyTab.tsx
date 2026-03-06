import { Activity } from "lucide-react";
import { useConsistencyData } from "@/features/visualisations/hooks/useConsistencyData";
import { ConsistencyBoxPlot, computeBoxStats, type BoxRowData } from "@/features/visualisations/components/ConsistencyBoxPlot";
import { ConsistencyTimeline } from "@/features/visualisations/components/ConsistencyTimeline";
import { ChartSkeleton } from "@/shared/ui";

interface ConsistencyTabProps {
  projectId: string;
}

export default function ConsistencyTab({ projectId }: ConsistencyTabProps) {
  const { data, state, selectedVisCodeId, setSelectedVisCodeId, threshold } =
    useConsistencyData(projectId);

  if (state === "loading" && !data) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={180} />
        <ChartSkeleton height={220} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Activity className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">Failed to load consistency data.</p>
        <button onClick={() => {}} className="text-xs text-brand-500 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const boxData: BoxRowData[] = data.scores_by_code
    .filter((c) => c.scores.length >= 2)
    .map((c) => ({
      code_name: c.code_name,
      code_id: c.code_id,
      ...computeBoxStats(c.scores),
    }));

  const timelineData = data.timeline.map((t) => ({
    ...t,
    date: new Date(t.date).toLocaleDateString(),
  }));

  if (boxData.length === 0 && timelineData.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Activity className="w-10 h-10 text-surface-300" aria-hidden="true" />
        <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No consistency scores yet</p>
        <p className="text-xs text-surface-400 max-w-xs">
          Code segments and run the audit to see score distributions here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedVisCodeId && (
        <button
          onClick={() => setSelectedVisCodeId(null)}
          className="text-xs text-brand-500 underline"
        >
          &larr; Show all codes
        </button>
      )}
      {boxData.length > 0 && (
        <ConsistencyBoxPlot boxData={boxData} threshold={threshold} />
      )}
      {timelineData.length > 0 && (
        <ConsistencyTimeline timelineData={timelineData} threshold={threshold} />
      )}
    </div>
  );
}