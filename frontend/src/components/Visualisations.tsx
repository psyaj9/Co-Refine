import { useState, useMemo } from "react";
import { useStore } from "@/stores/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Ghost, TrendingUp } from "lucide-react";

type VisTabId = "frequencies" | "crosstab" | "analytics";

export default function Visualisations() {
  const [visTab, setVisTab] = useState<VisTabId>("frequencies");

  const tabs: { id: VisTabId; label: string }[] = [
    { id: "frequencies", label: "Frequencies" },
    { id: "crosstab", label: "Code × Document" },
    { id: "analytics", label: "AI Analytics" },
  ];

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b panel-border flex-shrink-0 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setVisTab(tab.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              visTab === tab.id
                ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500"
                : "text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {visTab === "frequencies" && <FrequencyChart />}
        {visTab === "crosstab" && <CrossTabulation />}
        {visTab === "analytics" && <AIAnalytics />}
      </div>
    </div>
  );
}

// ========== Frequency Chart ==========
function FrequencyChart() {
  const codes = useStore((s) => s.codes);

  const data = useMemo(
    () =>
      [...codes]
        .sort((a, b) => b.segment_count - a.segment_count)
        .map((c) => ({
          name: c.label,
          count: c.segment_count,
          colour: c.colour,
        })),
    [codes]
  );

  if (codes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-surface-400 italic">No codes to chart.</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
        Code Frequency
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, "auto"]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            width={75}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.colour} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========== Cross-tabulation ==========
function CrossTabulation() {
  const codes = useStore((s) => s.codes);
  const documents = useStore((s) => s.documents);
  const segments = useStore((s) => s.segments);

  // Build a matrix: documents × codes
  const matrix = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const doc of documents) {
      result[doc.id] = {};
      for (const code of codes) {
        result[doc.id][code.id] = 0;
      }
    }
    for (const seg of segments) {
      if (result[seg.document_id] && result[seg.document_id][seg.code_id] !== undefined) {
        result[seg.document_id][seg.code_id]++;
      }
    }
    return result;
  }, [documents, codes, segments]);

  if (codes.length === 0 || documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-surface-400 italic">Need documents and codes for cross-tabulation.</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto thin-scrollbar h-full">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
        Code × Document Matrix
      </h3>
      <div className="overflow-auto">
        <table className="text-2xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface-50 dark:bg-surface-800 p-1.5 text-left text-surface-500 font-semibold border panel-border min-w-[120px]">
                Document
              </th>
              {codes.map((code) => (
                <th
                  key={code.id}
                  className="p-1.5 text-center font-semibold border panel-border min-w-[60px]"
                  title={code.label}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: code.colour }}
                    />
                    <span className="truncate max-w-[60px] text-surface-600 dark:text-surface-300">
                      {code.label}
                    </span>
                  </div>
                </th>
              ))}
              <th className="p-1.5 text-center font-semibold border panel-border text-surface-500 min-w-[40px]">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const rowTotal = codes.reduce(
                (sum, c) => sum + (matrix[doc.id]?.[c.id] || 0),
                0
              );
              return (
                <tr key={doc.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                  <td className="sticky left-0 bg-white dark:bg-panel-dark p-1.5 text-left text-surface-600 dark:text-surface-300 font-medium border panel-border truncate max-w-[120px]">
                    {doc.title}
                  </td>
                  {codes.map((code) => {
                    const count = matrix[doc.id]?.[code.id] || 0;
                    return (
                      <td
                        key={code.id}
                        className={cn(
                          "p-1.5 text-center border panel-border tabular-nums",
                          count > 0
                            ? "text-surface-700 dark:text-surface-200 font-medium"
                            : "text-surface-300 dark:text-surface-600"
                        )}
                        style={
                          count > 0
                            ? { backgroundColor: hexToRgba(code.colour, 0.1) }
                            : undefined
                        }
                      >
                        {count || "–"}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center border panel-border font-semibold text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
            {/* Column totals */}
            <tr className="bg-surface-50 dark:bg-surface-800 font-semibold">
              <td className="sticky left-0 bg-surface-50 dark:bg-surface-800 p-1.5 border panel-border text-surface-500">
                Σ
              </td>
              {codes.map((code) => {
                const colTotal = documents.reduce(
                  (sum, d) => sum + (matrix[d.id]?.[code.id] || 0),
                  0
                );
                return (
                  <td key={code.id} className="p-1.5 text-center border panel-border text-surface-600 dark:text-surface-300">
                    {colTotal}
                  </td>
                );
              })}
              <td className="p-1.5 text-center border panel-border text-surface-700 dark:text-surface-200">
                {segments.length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== AI Analytics ==========
function AIAnalytics() {
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

    // Per-code breakdown
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

  // Pie chart data for consistency
  const consistencyPieData = useMemo(
    () =>
      [
        { name: "Consistent", value: metrics.consistentCount, fill: "#22c55e" },
        { name: "Drift Detected", value: metrics.driftCount, fill: "#f59e0b" },
      ].filter((d) => d.value > 0),
    [metrics]
  );

  // Pie chart data for ghost partner
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
          <TrendingUp size={32} className="mx-auto text-surface-300 dark:text-surface-600" />
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
    <div className="p-4 overflow-auto thin-scrollbar h-full space-y-6">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
        AI Analytics Overview
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Pie charts row */}
      {(consistencyPieData.length > 0 || ghostPieData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consistencyPieData.length > 0 && (
            <div className="rounded-lg border panel-border p-3">
              <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
                Self-Consistency Results
              </p>
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
            </div>
          )}
          {ghostPieData.length > 0 && (
            <div className="rounded-lg border panel-border p-3">
              <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
                Ghost Partner Results
              </p>
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
            </div>
          )}
        </div>
      )}

      {/* Per-code breakdown table */}
      {metrics.codeMetrics.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">
            Per-Code Breakdown
          </p>
          <div className="overflow-auto">
            <table className="text-2xs border-collapse w-full">
              <thead>
                <tr>
                  <th className="p-1.5 text-left text-surface-500 font-semibold border panel-border">Code</th>
                  <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border">Segments</th>
                  <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border">Consistency Checks</th>
                  <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border">Drift Rate</th>
                  <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border">Ghost Conflicts</th>
                  <th className="p-1.5 text-center text-surface-500 font-semibold border panel-border">AI Analysed</th>
                </tr>
              </thead>
              <tbody>
                {metrics.codeMetrics.map((cm) => (
                  <tr key={cm.name} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="p-1.5 border panel-border">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cm.colour }}
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
                        <CheckCircle2 size={12} className="mx-auto text-green-500" />
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
    <div className={cn("rounded-lg border p-3", bgMap[colour] || "border-surface-200")}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-2xs font-medium text-surface-500 dark:text-surface-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-surface-800 dark:text-surface-100">{value}</p>
      <p className="text-2xs text-surface-400 dark:text-surface-500 mt-0.5">{sub}</p>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("hsl")) return hex.replace(")", `, ${alpha})`).replace("hsl", "hsla");
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
