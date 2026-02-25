import { useMemo } from "react";
import { useStore } from "@/stores/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function FrequencyChart() {
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
    <div className="p-4 h-full tab-content-enter">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
        Code Frequency
      </h3>
      <figure role="img" aria-label={`Bar chart showing frequency of ${data.length} codes. ${data.length > 0 ? `Top code: ${data[0].name} with ${data[0].count} segments.` : ''}`}>
        <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 80, right: 20, top: 5, bottom: 5 }}
        >
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
      </figure>
    </div>
  );
}
