"use client";

import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Target, Sunset, GraduationCap, Home, Shield, PiggyBank } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { computeProjection, monthsUntil, type Goal } from "@/hooks/useGoals";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  target: Target,
  sunset: Sunset,
  "graduation-cap": GraduationCap,
  home: Home,
  shield: Shield,
  "piggy-bank": PiggyBank,
};

interface Props {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GoalDetailPanel({ goal, open, onOpenChange }: Props) {
  const [cagrOverride, setCagrOverride] = useState<number | null>(null);

  // Reset slider when goal changes
  const effectiveCagr = cagrOverride ?? Number(goal?.cagr ?? 7);

  const totalMonths = goal ? monthsUntil(goal.target_date) : 0;

  const projection = useMemo(() => {
    if (!goal) return [];
    return computeProjection(
      Number(goal.current_amount),
      Number(goal.monthly_contribution),
      effectiveCagr,
      Math.max(totalMonths, 12),
    );
  }, [goal, effectiveCagr, totalMonths]);

  if (!goal) return null;

  const Icon = ICON_MAP[goal.icon] ?? Target;
  const projectedFinal = projection[projection.length - 1]?.value ?? 0;
  const targetAmount = Number(goal.target_amount);
  const hitsTarget = projectedFinal >= targetAmount;
  const progress = targetAmount > 0
    ? Math.min(100, (Number(goal.current_amount) / targetAmount) * 100)
    : 0;

  // Thin down chart data for performance  - show ~60 points max
  const step = Math.max(1, Math.floor(projection.length / 60));
  const chartData = projection.filter((_, i) => i % step === 0 || i === projection.length - 1);

  // Format chart label
  function formatChartDate(dateStr: string) {
    const [y, m] = dateStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[Number(m) - 1]} ${y}`;
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setCagrOverride(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-vela-card border border-vela-border rounded-lg shadow-xl">
          {/* Header */}
          <div className="sticky top-0 bg-vela-card z-10 flex items-center justify-between px-5 py-4 border-b border-vela-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-vela-teal/15 flex items-center justify-center">
                <Icon className="w-4 h-4 text-vela-teal" />
              </div>
              <Dialog.Title className="text-base font-semibold text-zinc-100">
                {goal.name}
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-5">
            {/* Progress summary */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl tabular font-semibold text-zinc-100">
                  {formatCurrency(goal.current_amount)}
                </span>
                <span className="text-sm tabular text-zinc-500">
                  of {formatCurrency(goal.target_amount)}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-vela-teal transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{progress.toFixed(0)}% saved</p>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 text-center">
                <p className="text-xs text-zinc-500">Monthly</p>
                <p className="text-sm tabular font-medium text-zinc-100">
                  {formatCurrency(goal.monthly_contribution)}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 text-center">
                <p className="text-xs text-zinc-500">Return</p>
                <p className="text-sm tabular font-medium text-zinc-100">
                  {effectiveCagr.toFixed(1)}%
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 text-center">
                <p className="text-xs text-zinc-500">Projected</p>
                <p className={`text-sm tabular font-medium ${hitsTarget ? "text-gain" : "text-loss"}`}>
                  {formatCurrency(projectedFinal)}
                </p>
              </div>
            </div>

            {/* CAGR Slider */}
            <div>
              <h3 className="text-sm text-zinc-400 font-medium mb-2">
                Expected annual return
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular text-zinc-500 w-8">1%</span>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={effectiveCagr}
                  onChange={(e) => setCagrOverride(Number(e.target.value))}
                  className="flex-1 accent-vela-teal h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-xs tabular text-zinc-500 w-8">15%</span>
              </div>
              <p className="text-center text-sm tabular font-medium text-vela-teal mt-1">
                {effectiveCagr.toFixed(1)}% per year
              </p>
            </div>

            {/* Projection Chart */}
            <div>
              <h3 className="text-sm text-zinc-400 font-medium mb-3">Projection</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0CB5C9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0CB5C9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrency(v, "USD", true)}
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "#27272a",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={formatChartDate}
                      formatter={(val: number, name: string) => [
                        formatCurrency(val),
                        name === "value" ? "Projected" : "Contributed",
                      ]}
                    />
                    <ReferenceLine
                      y={targetAmount}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <Area
                      type="monotone"
                      dataKey="contributed"
                      stroke="#71717a"
                      strokeWidth={1}
                      fill="url(#contribGrad)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0CB5C9"
                      strokeWidth={2}
                      fill="url(#projGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-vela-teal rounded" /> Projected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-zinc-500 rounded" /> Contributions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-loss rounded border-dashed" style={{ borderTop: "1px dashed" }} /> Target
                </span>
              </div>
            </div>

            {/* Status */}
            <div className={`text-center text-sm font-medium px-4 py-2.5 rounded-lg ${
              hitsTarget
                ? "bg-gain/10 text-gain"
                : "bg-loss/10 text-loss"
            }`}>
              {hitsTarget
                ? `On track \u2014 projected to reach ${formatCurrency(targetAmount)} before your target date`
                : `Gap of ${formatCurrency(targetAmount - projectedFinal)} \u2014 consider increasing contributions or return rate`}
            </div>

            {/* Notes */}
            {goal.notes && (
              <div>
                <h3 className="text-sm text-zinc-400 font-medium mb-1">Notes</h3>
                <p className="text-sm text-zinc-300">{goal.notes}</p>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
              This is not financial advice. Projections are hypothetical and do not guarantee future results.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
