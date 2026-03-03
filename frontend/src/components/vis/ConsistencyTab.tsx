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
import { useStore } from "@/stores/store";

interface ConsistencyData {
  scores_by_code: { code_name: string; code_id: string; scores: number[] }[];
  timeline: { date: string; score: number; code_name: string; code_id: string }[];
}

function computeBoxStats(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const min = sorted[0];
  const max = sorted[n - 1];
  return { min, q1, median, q3, max };
}

export default function ConsistencyTab({ projectId }: { projectId: string }) {
  const selectedVisCodeId = useStore((s) => s.selectedVisCodeId);
  const setSelectedVisCodeId = useStore((s) => s.setSelectedVisCodeId);
  const [data, setData] = useState<ConsistencyData | null>(null);

  useEffect(() => {
    const url = selectedVisCodeId
      ? `/api/projects/${projectId}/vis/consistency?code_id=${selectedVisCodeId}`
      : `/api/projects/${projectId}/vis/consistency`;
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [projectId, selectedVisCodeId]);

  if (!data) return <p className="text-sm text-surface-400">Loading consistency data…</p>;

  const boxData = data.scores_by_code
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

      {/* Box plots */}
      <div>
        <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
          Score Distribution by Code (min / Q1 / median / Q3 / max)
        </h3>
        {boxData.length === 0 ? (
          <p className="text-xs text-surface-400">
            Need at least 2 scored segments per code to show distributions.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, boxData.length * 40 + 60)}>
            <ComposedChart data={boxData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="code_name"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined) => [
                  v != null ? `${(v * 100).toFixed(1)}%` : "-",
                  name ?? "",
                ]}
              />
              <Bar dataKey="min" stackId="box" fill="transparent" name="Min" />
              <Bar dataKey="q1" stackId="box" fill="#bfdbfe" name="Q1" />
              <Bar dataKey="median" stackId="box" fill="#3b82f6" name="Median" barSize={3} />
              <Bar dataKey="q3" stackId="box" fill="#93c5fd" name="Q3" />
              <ReferenceLine
                x={0.7}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: "0.7", fontSize: 10 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
          Score Timeline
        </h3>
        {timelineData.length === 0 ? (
          <p className="text-xs text-surface-400">No scored segments yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : "-"} />
                <Legend />
                <ReferenceLine y={0.7} stroke="#ef4444" strokeDasharray="4 4" />
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
            <p className="text-xs text-surface-400 mt-1">
              Click a code in the Overview or Facet Explorer to filter this timeline.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
