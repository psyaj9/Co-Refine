import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { MetricPoint } from "@/types";

export interface KPICardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  sparkData?: MetricPoint[];
  sparkKey?: keyof MetricPoint;
}

export function KPICard({ label, value, trend, sparkData, sparkKey }: KPICardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-surface-400";

  return (
    <div className="rounded-lg border panel-border panel-bg p-4">
      <div className="flex items-start justify-between gap-1">
        <div>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">{value}</p>
          <p className="text-xs text-surface-500 mt-1">{label}</p>
        </div>
        {trend && (
          <TrendIcon className={`w-4 h-4 shrink-0 mt-1 ${trendColor}`} aria-hidden="true" />
        )}
      </div>
      {sparkData && sparkKey && sparkData.length > 1 && (
        <div className="mt-2 -mx-1">
          <ResponsiveContainer width="100%" height={36}>
            <LineChart data={sparkData.slice(-10)}>
              <Line
                type="monotone"
                dataKey={sparkKey as string}
                stroke="#3b82f6"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
