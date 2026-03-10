import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { TimelineEntry } from "@/shared/types";

function pct(v: number | undefined) {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}

export type TimelineRow = TimelineEntry & { date: string };

interface ConsistencyTimelineProps {
  timelineData: TimelineRow[];
  threshold: number;
}

export function ConsistencyTimeline({ timelineData, threshold }: ConsistencyTimelineProps) {
  return (
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
  );
}
