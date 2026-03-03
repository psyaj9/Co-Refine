import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface OverviewData {
  total_segments: number;
  total_codes: number;
  avg_consistency_score: number;
  score_over_time: { date: string; avg_score: number }[];
  top_drifting_codes: { code_name: string; drift_score: number }[];
}

export default function VisOverviewTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/vis/overview`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [projectId]);

  if (!data) return <p className="text-sm text-surface-400">Loading overview…</p>;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Segments" value={data.total_segments} />
        <KPICard label="Codes" value={data.total_codes} />
        <KPICard
          label="Avg Consistency"
          value={`${(data.avg_consistency_score * 100).toFixed(1)}%`}
        />
      </div>

      {/* Trend line */}
      <div>
        <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
          Consistency Over Time
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.score_over_time}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : "-"} />
            <Line
              type="monotone"
              dataKey="avg_score"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Drift bar chart */}
      {data.top_drifting_codes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 text-surface-500 uppercase tracking-wide">
            Top Drifting Codes
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.top_drifting_codes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="code_name"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(v: number | undefined) => v != null ? v.toFixed(3) : "-"} />
              <Bar dataKey="drift_score" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.top_drifting_codes.length === 0 && data.score_over_time.length === 0 && (
        <p className="text-xs text-surface-400">
          No consistency scores yet. Code some segments and run the audit to see data here.
        </p>
      )}
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border panel-border panel-bg p-4 text-center">
      <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
    </div>
  );
}
