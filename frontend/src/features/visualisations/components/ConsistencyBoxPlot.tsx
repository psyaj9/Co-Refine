import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/** Range-based box stats for correct stacked bar rendering. */
export function computeBoxStats(scores: number[]) {
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const min = s[0];
  const q1 = s[Math.floor(n * 0.25)];
  const median = s[Math.floor(n * 0.5)];
  const q3 = s[Math.floor(n * 0.75)];
  const max = s[n - 1];
  return {
    base: min,
    iqr_lower: q1 - min,
    iqr_mid: median - q1,
    iqr_upper: q3 - median,
    top: max - q3,
    _min: min, _q1: q1, _median: median, _q3: q3, _max: max,
  };
}

export type BoxRowData = ReturnType<typeof computeBoxStats> & {
  code_name: string;
  code_id: string;
};

function pct(v: number | undefined | null) {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}

interface ConsistencyBoxPlotProps {
  boxData: BoxRowData[];
  threshold: number;
}

export function ConsistencyBoxPlot({ boxData, threshold }: ConsistencyBoxPlotProps) {
  return (
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
              const d = payload[0].payload as BoxRowData;
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
  );
}
