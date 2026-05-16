"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";

interface DataPoint {
  date: string;
  value: number;
  cost_basis: number;
}

interface PerfResponse {
  period: string;
  data: DataPoint[];
}

const PERIODS = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
  { value: "5y", label: "5Y" },
] as const;

function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  portfolioId: string;
}

export default function PerformanceChart({ portfolioId }: Props) {
  const [period, setPeriod] = useState("1y");

  const { data, isLoading } = useSWR<PerfResponse>(
    portfolioId ? `/portfolios/${portfolioId}/performance?period=${period}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const series = data?.data ?? [];
  const hasData = series.length > 1;

  // Compute return over selected period
  const firstVal = series[0]?.value ?? 0;
  const lastVal = series[series.length - 1]?.value ?? 0;
  const costBasis = series[0]?.cost_basis ?? 0;
  const periodReturn = lastVal - firstVal;
  const periodPct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
  const totalReturn = lastVal - costBasis;
  const totalReturnPct = costBasis > 0 ? ((lastVal - costBasis) / costBasis) * 100 : 0;
  const isPositive = periodReturn >= 0;

  // Chart color
  const lineColor = isPositive ? "#34d399" : "#f43f5e";
  const gradientId = "perf-gradient";

  return (
    <div className="vela-card">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Portfolio Performance</h3>
          {/* Period pills */}
          <div className="flex gap-0.5 sm:gap-1 shrink-0">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-1.5 sm:px-2 py-1 rounded text-[11px] sm:text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-vela-teal/15 text-vela-teal"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-lg font-bold tabular text-zinc-100">
              {formatCurrency(lastVal)}
            </span>
            <span className={`flex items-center gap-0.5 text-xs font-medium tabular ${isPositive ? "text-gain" : "text-loss"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? "+" : ""}{periodPct.toFixed(2)}%
              <span className="text-zinc-500 ml-1">
                ({isPositive ? "+" : ""}{formatCurrency(periodReturn)})
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-vela-teal/30 border-t-vela-teal rounded-full animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-zinc-500">
          No performance data available yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={["auto", "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={shortDate}
              formatter={(value: number) => [formatCurrency(value), "Value"]}
            />
            <ReferenceLine
              y={costBasis}
              stroke="#3f3f46"
              strokeDasharray="4 4"
              label={{
                value: "Cost basis",
                position: "right",
                fill: "#52525b",
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Total return footer */}
      {hasData && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Total return vs cost basis</span>
          <span className={`tabular font-medium ${totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
            {totalReturn >= 0 ? "+" : ""}{formatCurrency(totalReturn)} ({totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%)
          </span>
        </div>
      )}
    </div>
  );
}
