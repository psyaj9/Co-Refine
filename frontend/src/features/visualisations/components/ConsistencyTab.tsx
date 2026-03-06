import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Legend,
} from "recharts";
import { Activity } from "lucide-react";
import { useStore } from "@/stores/store";
import { fetchVisConsistency } from "@/api/client";
import type { ConsistencyData, TimelineEntry } from "@/types";
import { ChartSkeleton } from "@/shared/ui";

type LoadState = "idle" | "loading" | "error" | "success";

/** Range-based box stats for correct stacked bar rendering. */
function computeBoxStats(scores: number[]) {
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const min = s[0];
  const q1 = s[Math.floor(n * 0.25)];
  const median = s[Math.floor(n * 0.5)];
  const q3 = s[Math.floor(n * 0.75)];
  const max = s[n - 1];
  // Convert to ranges so stacked bars represent actual spans, not additive values
  return {
    base: min,            // transparent spacer — pushes stack to min
    iqr_lower: q1 - min, // lower whisker box
    iqr_mid: median - q1, // Q1 → median
    iqr_upper: q3 - median, // median → Q3
    top: max - q3,        // upper whisker
    _min: min, _q1: q1, _median: median, _q3: q3, _max: max,
  };
}

function pct(v: number | undefined | null) {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}

interface ConsistencyTabProps {
  projectId: string;
}

export default function ConsistencyTab({ projectId }: ConsistencyTabProps) {
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
        <button onClick={() => setState("idle")} className="text-xs text-brand-500 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const boxData = data.scores_by_code
    .filter((c) => c.scores.length >= 2)
    .map((c) => ({
      code_name: c.code_name,
      code_id: c.code_id,
      ...computeBoxStats(c.scores),
    }));

  const timelineData: (TimelineEntry & { date: string })[] = data.timeline.map((t) => ({
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
          ← Show all codes
        </button>
      )}

      {/* Box plots — range-stacked (correct math) */}
      {boxData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
            Score Distribution by Code (min / Q1 / median / Q3 / max)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(180, boxData.length * 40 + 60)}>
            <ComposedChart data={boxData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
              <YAxis dataKey="code_name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload as ReturnType<typeof computeBoxStats> & { code_name: string };
                  return (
                    <div className="bg-white dark:bg-surface-800 border panel-border rounded p-2 text-xs shadow-sm space-y-0.5">
                      <p className="font-semibold mb-1">{d.code_name}</p>
                      <p>Min: {pct(d._min)}</p>
                      <p>Q1: {pct(d._q1)}</p>
                      <p>Median: {pct(d._median)}</p>
                      <p>Q3: {pct(d._q3)}</p>
                      <p>Max: {pct(d._max)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="box" fill="transparent" legendType="none" />
              <Bar dataKey="iqr_lower" stackId="box" fill="#bfdbfe" name="Lower whisker" />
              <Bar dataKey="iqr_mid" stackId="box" fill="#3b82f6" name="IQR (Q1→median)" />
              <Bar dataKey="iqr_upper" stackId="box" fill="#93c5fd" name="IQR (median→Q3)" />
              <Bar dataKey="top" stackId="box" fill="#dbeafe" name="Upper whisker" />
              <ReferenceLine
                x={threshold}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: `${(threshold * 100).toFixed(0)}%`, fontSize: 10 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline — multi-metric when a code is selected */}
      {timelineData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
            Score Timeline
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | undefined) => pct(v)} />
              <Legend />
              <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                dot={{ r: 3 }}
                name="Consistency Score"
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
