import { useMemo } from "react";
import { useStore } from "@/stores/store";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Legend,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  TrendingUp,
} from "lucide-react";

export default function AIAnalytics() {
  const alerts = useStore((s) => s.alerts);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const analyses = useStore((s) => s.analyses);

  const metrics = useMemo(() => {
    const consistencyAlerts = alerts.filter((a) => a.type === "consistency");
    const ghostAlerts = alerts.filter((a) => a.type === "ghost_partner");

    const consistentCount = consistencyAlerts.filter((a) => a.is_consistent !== false).length;
    const driftCount = consistencyAlerts.filter((a) => a.is_consistent === false).length;
    const totalConsistency = consistentCount + driftCount;
    const consistencyRate = totalConsistency > 0 ? (consistentCount / totalConsistency) * 100 : 0;
    const driftRate = totalConsistency > 0 ? (driftCount / totalConsistency) * 100 : 0;

    const ghostAgrees = ghostAlerts.filter((a) => !a.is_conflict).length;
    const ghostConflicts = ghostAlerts.filter((a) => a.is_conflict).length;
    const totalGhost = ghostAgrees + ghostConflicts;
    const ghostAgreementRate = totalGhost > 0 ? (ghostAgrees / totalGhost) * 100 : 0;

    const codeMetrics = codes
      .map((code) => {
        const codeConsistency = consistencyAlerts.filter((a) => a.code_id === code.id);
        const codeDrifts = codeConsistency.filter((a) => a.is_consistent === false).length;
        const codeTotal = codeConsistency.length;
        const codeGhost = ghostAlerts.filter((a) => a.code_id === code.id);
        const codeConflicts = codeGhost.filter((a) => a.is_conflict).length;
        return {
          name: code.label,
          colour: code.colour,
          segments: code.segment_count,
          drifts: codeDrifts,
          checks: codeTotal,
          driftRate: codeTotal > 0 ? (codeDrifts / codeTotal) * 100 : 0,
          ghostConflicts: codeConflicts,
          ghostChecks: codeGhost.length,
          hasAnalysis: analyses.some((a) => a.code_id === code.id),
        };
      })
      .filter((c) => c.checks > 0 || c.ghostChecks > 0 || c.segments > 0);

    return {
      consistentCount,
      driftCount,
      totalConsistency,
      consistencyRate,
      driftRate,
      ghostAgrees,
      ghostConflicts,
      totalGhost,
      ghostAgreementRate,
      codeMetrics,
      totalSegments: segments.length,
      totalCodes: codes.length,
      analysedCodes: analyses.length,
    };
  }, [alerts, codes, segments, analyses]);

  const consistencyPieData = useMemo(
    () =>
      [
        { name: "Consistent", value: metrics.consistentCount, fill: "#22c55e" },
        { name: "Drift Detected", value: metrics.driftCount, fill: "#f59e0b" },
      ].filter((d) => d.value > 0),
    [metrics]
  );

  const ghostPieData = useMemo(
    () =>
      [
        { name: "Agrees", value: metrics.ghostAgrees, fill: "#6366f1" },
        { name: "Conflicts", value: metrics.ghostConflicts, fill: "#a855f7" },
      ].filter((d) => d.value > 0),
    [metrics]
  );

  if (metrics.totalConsistency === 0 && metrics.totalGhost === 0 && metrics.totalSegments === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <TrendingUp size={32} className="mx-auto text-surface-300 dark:text-surface-600" aria-hidden="true" />
          <p className="text-sm text-surface-400 italic">
            Start coding segments to see AI analytics.
          </p>
          <p className="text-2xs text-surface-400">
            Consistency checks, ghost partner results, and drift rates will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto thin-scrollbar h-full space-y-6 tab-content-enter">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
        AI Analytics Overview
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={<CheckCircle2 size={16} className="text-green-500" />}
          label="Consistency Rate"
          value={metrics.totalConsistency > 0 ? `${metrics.consistencyRate.toFixed(1)}%` : "—"}
          sub={`${metrics.consistentCount} of ${metrics.totalConsistency} checks`}
          colour="green"
        />
        <MetricCard
          icon={<AlertTriangle size={16} className="text-amber-500" />}
          label="Drift Rate"
          value={metrics.totalConsistency > 0 ? `${metrics.driftRate.toFixed(1)}%` : "—"}
          sub={`${metrics.driftCount} drift${metrics.driftCount !== 1 ? "s" : ""} detected`}
          colour="amber"
        />
        <MetricCard
          icon={<Ghost size={16} className="text-purple-500" />}
          label="Ghost Agreement"
          value={metrics.totalGhost > 0 ? `${metrics.ghostAgreementRate.toFixed(1)}%` : "—"}
          sub={`${metrics.ghostAgrees} agree / ${metrics.ghostConflicts} conflict`}
          colour="purple"
        />
        <MetricCard
          icon={<TrendingUp size={16} className="text-brand-500" />}
          label="Coverage"
          value={`${metrics.analysedCodes}/${metrics.totalCodes}`}
          sub={`${metrics.totalSegments} total segment${metrics.totalSegments !== 1 ? "s" : ""}`}
          colour="brand"
        />
      </div>

      {(consistencyPieData.length > 0 || ghostPieData.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {consistencyPieData.length > 0 && (
            <div className="rounded-lg border panel-border p-3">
              <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
                Self-Consistency Results
              </p>
              <figure role="img" aria-label={`Pie chart: ${metrics.consistentCount} consistent, ${metrics.driftCount} drifted`}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={consistencyPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {consistencyPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              </figure>
            </div>
          )}
          {ghostPieData.length > 0 && (
            <div className="rounded-lg border panel-border p-3">
              <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
                Ghost Partner Results
              </p>
              <figure role="img" aria-label={`Pie chart: ${metrics.ghostAgrees} agrees, ${metrics.ghostConflicts} conflicts`}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ghostPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {ghostPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              </figure>
            </div>
          )}
        </div>
      )}

      {metrics.codeMetrics.length > 0 && <PerCodeTable codeMetrics={metrics.codeMetrics} />}
    </div>
  );
}

function PerCodeTable({
  codeMetrics,
}: {
  codeMetrics: {
    name: string;
    colour: string;
    segments: number;
    checks: number;
    driftRate: number;
    ghostConflicts: number;
    ghostChecks: number;
    hasAnalysis: boolean;
  }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
        Per-Code Breakdown
      </p>
      <div className="overflow-auto" role="region" aria-label="Per-code breakdown">
        <table className="text-2xs border-collapse w-full">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-surface-500 font-semibold border panel-border" scope="col">Code</th>
              <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border" scope="col">Segments</th>
              <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border" scope="col">Checks</th>
              <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border" scope="col">Drift Rate</th>
              <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border" scope="col">Ghost</th>
              <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border" scope="col">AI</th>
            </tr>
          </thead>
          <tbody>
            {codeMetrics.map((cm) => (
              <tr key={cm.name} className="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                <td className="p-1.5 border panel-border">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cm.colour }}
                      aria-hidden="true"
                    />
                    <span className="text-surface-700 dark:text-surface-200 font-medium">
                      {cm.name}
                    </span>
                  </div>
                </td>
                <td className="p-1.5 text-center border panel-border text-surface-600 dark:text-surface-300 tabular-nums">
                  {cm.segments}
                </td>
                <td className="p-1.5 text-center border panel-border text-surface-600 dark:text-surface-300 tabular-nums">
                  {cm.checks}
                </td>
                <td
                  className={cn(
                    "p-1.5 text-center border panel-border tabular-nums font-medium",
                    cm.driftRate > 50
                      ? "text-red-600 dark:text-red-400"
                      : cm.driftRate > 20
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-green-600 dark:text-green-400"
                  )}
                >
                  {cm.checks > 0 ? `${cm.driftRate.toFixed(0)}%` : "—"}
                </td>
                <td
                  className={cn(
                    "p-1.5 text-center border panel-border tabular-nums",
                    cm.ghostConflicts > 0
                      ? "text-purple-600 dark:text-purple-400 font-medium"
                      : "text-surface-400"
                  )}
                >
                  {cm.ghostChecks > 0 ? `${cm.ghostConflicts}/${cm.ghostChecks}` : "—"}
                </td>
                <td className="p-1.5 text-center border panel-border">
                  {cm.hasAnalysis ? (
                    <CheckCircle2 size={12} className="mx-auto text-green-500" aria-label="Analysed" />
                  ) : (
                    <span className="text-surface-400" aria-label="Not analysed">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  colour,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  colour: string;
}) {
  const bgMap: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    brand: "bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800",
  };
  return (
    <div className={cn("rounded-lg border p-3 transition-colors", bgMap[colour] || "border-surface-200")}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-2xs font-medium text-surface-500 dark:text-surface-400">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-surface-800 dark:text-surface-100">{value}</p>
      <p className="text-2xs text-surface-400 dark:text-surface-500 mt-0.5">{sub}</p>
    </div>
  );
}
