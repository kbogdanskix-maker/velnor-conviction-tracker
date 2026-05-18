"use client";

import { useState, useMemo } from "react";
import { Umbrella, TrendingUp, Info } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { calculateRetirement, DEFAULT_INPUT } from "@/lib/retirement-calc";
import type { RetirementInput } from "@/lib/retirement-calc";
import PageTransition from "@/components/celestial/PageTransition";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import TierGate from "@/components/shared/TierGate";

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function RetirementPage() {
  const { summary, loading: pLoading, error: pError } = useDefaultPortfolio();
  const { summary: nwSummary, isLoading: nwLoading, error: nwError } = useNetWorthSummary();
  const { summary: cfSummary, isLoading: cfLoading, error: cfError } = useCashFlowSummary();

  const isLoading = pLoading || nwLoading || cfLoading;
  const error = pError || nwError || cfError;

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState message="Failed to load retirement planning data." onRetry={() => window.location.reload()} />;

  // Pre-fill from user data where available
  const portfolioValue = summary?.total_value ?? 0;
  const retirementAccounts =
    nwSummary?.assets
      ?.filter((a) => ["retirement_401k", "ira", "hsa"].includes(a.category))
      .reduce((s, a) => s + a.value, 0) ?? 0;
  const initialSavings = portfolioValue + retirementAccounts;
  const monthlySavings = cfSummary?.savings && cfSummary.savings > 0 ? Math.round(cfSummary.savings) : 500;

  const [inputs, setInputs] = useState<RetirementInput>({
    ...DEFAULT_INPUT,
    currentSavings: initialSavings,
    monthlyContribution: monthlySavings,
  });

  // Recalculate when initialSavings changes (data loads async)
  const effectiveInputs = useMemo(
    () => ({
      ...inputs,
      currentSavings: inputs.currentSavings || initialSavings,
      monthlyContribution: inputs.monthlyContribution || monthlySavings,
    }),
    [inputs, initialSavings, monthlySavings],
  );

  const result = useMemo(() => calculateRetirement(effectiveInputs), [effectiveInputs]);

  function updateInput(key: keyof RetirementInput, value: number) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Umbrella className="w-7 h-7 text-vela-teal" />
          Retirement Readiness
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          See if you're on track based on your savings, contributions, and goals.
        </p>
      </div>

      {/* Score + key metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="vela-card flex flex-col items-center justify-center py-6">
          <AnimatedNumber
            value={result.score}
            format={(n) => Math.round(n).toString()}
            className={`text-5xl font-bold tabular ${result.color}`}
          />
          <p className={`text-sm font-medium mt-1 ${result.color}`}>{result.label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Readiness Score</p>
        </div>
        <div className="vela-card">
          <p className="text-xs text-zinc-500 mb-1">Projected Nest Egg</p>
          <AnimatedNumber
            value={result.projectedNestEgg}
            format={formatCompact}
            className="text-xl font-bold tabular text-zinc-100"
          />
          <p className="text-xs text-zinc-500 mt-1">at age {effectiveInputs.retirementAge}</p>
        </div>
        <div className="vela-card">
          <p className="text-xs text-zinc-500 mb-1">Target Needed</p>
          <AnimatedNumber
            value={result.requiredNestEgg}
            format={formatCompact}
            className="text-xl font-bold tabular text-zinc-100"
          />
          <p className="text-xs text-zinc-500 mt-1">for {formatCompact(effectiveInputs.desiredAnnualIncome)}/yr</p>
        </div>
        <div className="vela-card">
          <p className="text-xs text-zinc-500 mb-1">
            {result.gap >= 0 ? "Surplus" : "Shortfall"}
          </p>
          <AnimatedNumber
            value={Math.abs(result.gap)}
            format={(n) => `${result.gap >= 0 ? "+" : "-"}${formatCompact(n)}`}
            className={`text-xl font-bold tabular ${
              result.gap >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          />
          <p className="text-xs text-zinc-500 mt-1">
            ~{formatCompact(result.projectedMonthlyIncome)}/mo income
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-400" />
          Projected Growth
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.projections} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="age"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompact(v)}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number) => [formatCompact(val), "Balance"]}
                labelFormatter={(age) => `Age ${age}`}
              />
              <ReferenceLine
                x={effectiveInputs.retirementAge}
                stroke="#71717a"
                strokeDasharray="4 4"
                label={{
                  value: "Retire",
                  position: "top",
                  fill: "#71717a",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="rgb(20, 184, 166)"
                strokeWidth={2}
                fill="url(#retGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inputs */}
      <div className="vela-card space-y-5">
        <h2 className="text-sm font-medium text-zinc-300">Adjust Assumptions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
          <SliderInput
            label="Current Age"
            value={effectiveInputs.currentAge}
            min={18}
            max={70}
            step={1}
            format={(v) => `${v}`}
            onChange={(v) => updateInput("currentAge", v)}
          />
          <SliderInput
            label="Retirement Age"
            value={effectiveInputs.retirementAge}
            min={50}
            max={80}
            step={1}
            format={(v) => `${v}`}
            onChange={(v) => updateInput("retirementAge", v)}
          />
          <SliderInput
            label="Life Expectancy"
            value={effectiveInputs.lifeExpectancy}
            min={70}
            max={100}
            step={1}
            format={(v) => `${v}`}
            onChange={(v) => updateInput("lifeExpectancy", v)}
          />
          <SliderInput
            label="Current Savings"
            value={effectiveInputs.currentSavings}
            min={0}
            max={2000000}
            step={5000}
            format={formatCompact}
            onChange={(v) => updateInput("currentSavings", v)}
          />
          <SliderInput
            label="Monthly Contribution"
            value={effectiveInputs.monthlyContribution}
            min={0}
            max={10000}
            step={100}
            format={(v) => `$${v.toLocaleString()}`}
            onChange={(v) => updateInput("monthlyContribution", v)}
          />
          <SliderInput
            label="Expected Return"
            value={effectiveInputs.expectedReturn * 100}
            min={3}
            max={12}
            step={0.5}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => updateInput("expectedReturn", v / 100)}
          />
          <SliderInput
            label="Desired Annual Income"
            value={effectiveInputs.desiredAnnualIncome}
            min={20000}
            max={200000}
            step={5000}
            format={formatCompact}
            onChange={(v) => updateInput("desiredAnnualIncome", v)}
          />
          <SliderInput
            label="Social Security (monthly)"
            value={effectiveInputs.socialSecurityMonthly}
            min={0}
            max={4000}
            step={100}
            format={(v) => `$${v.toLocaleString()}`}
            onChange={(v) => updateInput("socialSecurityMonthly", v)}
          />
          <SliderInput
            label="Inflation Rate"
            value={effectiveInputs.inflationRate * 100}
            min={1}
            max={6}
            step={0.5}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => updateInput("inflationRate", v / 100)}
          />
        </div>
      </div>

      {/* Insights */}
      {result.insights.length > 0 && (
        <div className="vela-card border-vela-teal/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-vela-teal mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-200">Insights</h3>
              {result.insights.map((insight, i) => (
                <p key={i} className="text-xs text-zinc-400 leading-relaxed">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          This calculator uses simplified assumptions and is for educational purposes only.
          Actual results will vary based on market conditions, tax implications, and personal circumstances.
          Consult a financial advisor for personalized retirement planning.
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}

// ── Slider component ───────────────────────────────────────────────

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-zinc-500">{label}</label>
        <span className="text-xs font-medium tabular text-zinc-200">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
      />
    </div>
  );
}
