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
  Legend,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { ChartSkeleton, KPISkeleton } from "@/shared/ui";
import { useVisOverview } from "@/features/visualisations/hooks/useVisOverview";
import { KPICard } from "@/features/visualisations/components/KPICard";

function computeTrend(vals: (number | null)[]): "up" | "down" | "flat" {
  const clean = vals.filter((v): v is number => v != null);
  if (clean.length < 2) return "flat";
  const mid = Math.floor(clean.length / 2);
  const firstAvg = clean.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const lastAvg = clean.slice(mid).reduce((a, b) => a + b, 0) / (clean.length - mid);
  const diff = lastAvg - firstAvg;
  if (Math.abs(diff) < 0.02) return "flat";
  return diff > 0 ? "up" : "down";
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

interface VisOverviewTabProps {
  projectId: string;
}

export default function VisOverviewTab({ projectId }: VisOverviewTabProps) {
  const { data, state, reload } = useVisOverview(projectId);

  if (state === "loading" && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <KPISkeleton /><KPISkeleton /><KPISkeleton />
        </div>
        <ChartSkeleton height={200} />
        <ChartSkeleton height={160} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <BarChart2 className="w-8 h-8 text-surface-400" aria-hidden="true" />
        <p className="text-sm text-surface-500">Failed to load overview data.</p>
        <button
          onClick={() => reload()}
          className="text-xs text-brand-500 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { metrics_over_time: mot } = data;
  const consistencyTrend = computeTrend(mot.map((p) => p.avg_consistency));
  const noData = mot.length === 0 && data.top_variable_codes.length === 0;

  return (
    <div className="space-y-6">
      {/* KPI cards — row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Segments" value={data.total_segments} />
        <KPICard label="Codes" value={data.total_codes} />
        <KPICard
          label="Avg Consistency"
          value={pct(data.avg_consistency_score)}
          trend={consistencyTrend}
          sparkData={mot}
          sparkKey="avg_consistency"
        />
      </div>
      
      {noData ? (
        <EmptyOverview />
      ) : (
        <>
          {/* Multi-metric trend */}
          {mot.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-1 text-surface-500 uppercase tracking-wide">
                Metrics Over Time
              </h3>
              <p className="text-xs text-surface-400 mb-2">
                Consistency = LLM judgment quality &middot; Centroid Similarity = embedding fit to code
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mot}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? pct(value) : "—"
                    }
                  />
                  <Legend />
                  <Line type="monotone" dataKey="avg_consistency" stroke="#3b82f6" dot={false} strokeWidth={2} name="Consistency" />
                  <Line type="monotone" dataKey="avg_centroid_sim" stroke="#8b5cf6" dot={false} strokeWidth={2} name="Centroid Similarity" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Most Variable Codes — high std-dev of LLM consistency scores signals unclear definitions */}
          {data.top_variable_codes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-1 text-surface-500 uppercase tracking-wide">
                Most Variable Codes
              </h3>
              <p className="text-xs text-surface-400 mb-2">
                Codes with the highest variation in consistency scores &mdash; may need definitional refinement.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(120, data.top_variable_codes.length * 36 + 40)}>
                <BarChart data={data.top_variable_codes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="code_name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v != null ? v.toFixed(3) : "\u2014"} />
                  <Bar dataKey="variability_score" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Variability" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Temporal Drift by Code — Stage 1 LOGOS metric: cosine distance between early and recent centroids */}
          {data.top_temporal_drift_codes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-1 text-surface-500 uppercase tracking-wide">
                Temporal Drift by Code
              </h3>
              <p className="text-xs text-surface-400 mb-2">
                Semantic distance between early and recent coding examples &mdash; high values indicate your usage of this code has shifted over time.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(120, data.top_temporal_drift_codes.length * 36 + 40)}>
                <BarChart data={data.top_temporal_drift_codes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="code_name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v != null ? v.toFixed(3) : "\u2014"} />
                  <Bar dataKey="avg_drift" fill="#ef4444" radius={[0, 4, 4, 0]} name="Avg Drift" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </>
      )}
    </div>
  );
}

function EmptyOverview() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <BarChart2 className="w-10 h-10 text-surface-300" aria-hidden="true" />
      <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No audit data yet</p>
      <p className="text-xs text-surface-400 max-w-xs">
        Code some segments and run the audit to see metrics and trends here.
      </p>
    </div>
  );
}
