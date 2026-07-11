"use client";

import { useMemo, useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Users, TrendingUp, TrendingDown, Info, Sliders, Shield, Sparkles } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useDividendSummary } from "@/hooks/useDividends";
import { calculateBenchmarks, DEFAULT_PROFILE } from "@/lib/benchmarks";
import { formatCompact, formatPercent, formatNumber } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import type {
  BenchmarkInput, BenchmarkMetric, RiskProfile,
  RiskTolerance, CareerStage, IncomeLevel,
} from "@/lib/benchmarks";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a benchmark metric value based on its unit type. */
function fmtMetric(v: number, unit: string): string {
  if (unit === "currency") return formatCompact(v);
  if (unit === "percent") return formatPercent(v, false);
  if (unit === "number") return formatNumber(v, Number.isInteger(v) ? 0 : 1);
  return v.toFixed(2);
}

function percentileColor(pct: number): string {
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 50) return "text-teal-400";
  if (pct >= 30) return "text-amber-400";
  return "text-rose-400";
}

function percentileBarColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-400";
  if (pct >= 50) return "bg-teal-400";
  if (pct >= 30) return "bg-amber-400";
  return "bg-rose-400";
}

function percentileLabel(pct: number): string {
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Above Average";
  if (pct >= 40) return "Average";
  if (pct >= 20) return "Below Average";
  return "Needs Attention";
}

// ── Profile option configs ───────────────────────────────────────────────────

const RISK_OPTIONS: { value: RiskTolerance; label: string; color: string }[] = [
  { value: "conservative", label: "Conservative", color: "text-blue-400" },
  { value: "moderate", label: "Moderate", color: "text-teal-400" },
  { value: "aggressive", label: "Aggressive", color: "text-amber-400" },
];

const CAREER_OPTIONS: { value: CareerStage; label: string }[] = [
  { value: "early", label: "Early Career" },
  { value: "mid", label: "Mid Career" },
  { value: "established", label: "Established" },
  { value: "pre-retirement", label: "Pre-Retirement" },
  { value: "retired", label: "Retired" },
];

const INCOME_OPTIONS: { value: IncomeLevel; label: string; range: string }[] = [
  { value: "low", label: "Low", range: "<$40K/yr" },
  { value: "moderate", label: "Moderate", range: "$40-80K" },
  { value: "high", label: "High", range: "$80-150K" },
  { value: "very-high", label: "Very High", range: "$150K+" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const { summary, loading, error } = useDefaultPortfolio();
  const hasHoldings = !!summary?.holdings?.length;
  const { dividends } = useDividendSummary(hasHoldings ? (summary as any)?.portfolio_id ?? null : null);
  const { summary: nwSummary } = useNetWorthSummary();
  const { summary: cfSummary } = useCashFlowSummary();
  const { profile: userProfile } = useProfile();

  const [age, setAge] = useState(userProfile.age);
  const [profile, setProfile] = useState<RiskProfile>({
    ...DEFAULT_PROFILE,
    riskTolerance: userProfile.riskTolerance,
    hasDependents: userProfile.dependents > 0,
  });
  const [showProfile, setShowProfile] = useState(true);

  // useProfile loads from an async cloud store, so the initial useState above
  // captures DEFAULT_PROFILE (age 30, moderate) before the real values arrive.
  // Sync the benchmark's age/risk/dependents once the actual profile resolves.
  // What-if overrides change local state (not userProfile), so they're preserved.
  useEffect(() => {
    setAge(userProfile.age);
    setProfile((prev) => ({
      ...prev,
      riskTolerance: userProfile.riskTolerance,
      hasDependents: userProfile.dependents > 0,
    }));
  }, [userProfile.age, userProfile.riskTolerance, userProfile.dependents]);

  function updateProfile<K extends keyof RiskProfile>(key: K, value: RiskProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  const result = useMemo(() => {
    const totalValue = summary?.total_value ?? 0;
    const holdings = summary?.holdings ?? [];
    const topWeight = holdings.length > 0
      ? Math.max(...holdings.map((h) => (h.market_value ?? h.total_cost ?? 0) / (totalValue || 1)))
      : 0;

    const input: BenchmarkInput = {
      age,
      netWorth: nwSummary?.net_worth ?? null,
      totalAssets: nwSummary?.total_assets ?? null,
      totalLiabilities: nwSummary?.total_liabilities ?? null,
      savingsRate: cfSummary?.savings_rate != null ? cfSummary.savings_rate / 100 : null,
      portfolioValue: totalValue,
      numHoldings: holdings.length,
      topHoldingWeight: topWeight,
      dividendYield: dividends?.portfolio_yield ?? null,
      totalIncome: cfSummary?.total_income ?? null,
      totalExpenses: cfSummary?.total_expenses ?? null,
      profile,
    };

    return calculateBenchmarks(input);
  }, [summary, nwSummary, cfSummary, dividends, age, profile]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message="Failed to load data for benchmarking." onRetry={() => window.location.reload()} />;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Users className="w-7 h-7 text-vela-teal" />
          Benchmarking
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          See how your finances compare to a typical profile for your age and risk tolerance.
        </p>
      </div>

      {/* Profile configurator */}
      <div className="vela-card">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-vela-teal" />
            <h2 className="text-sm font-medium text-zinc-200">Your Profile</h2>
            <span className="text-[10px] text-vela-teal bg-vela-teal/10 px-1.5 py-0.5 rounded">
              Personalized
            </span>
          </div>
          <span className={`text-xs text-zinc-500 transition-transform ${showProfile ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>

        {showProfile && (
          <div className="mt-4 space-y-4">
            {/* Age */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-zinc-500">Age</label>
                <span className="text-xs font-medium tabular text-zinc-200">{age} ({result.ageGroup})</span>
              </div>
              <input
                type="range"
                min={18}
                max={80}
                step={1}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1.5">Risk Tolerance</label>
              <div className="flex gap-2">
                {RISK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateProfile("riskTolerance", opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      profile.riskTolerance === opt.value
                        ? `${opt.color} border-current bg-zinc-800`
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Career Stage */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1.5">Career Stage</label>
              <div className="flex flex-wrap gap-1.5">
                {CAREER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateProfile("careerStage", opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      profile.careerStage === opt.value
                        ? "text-vela-teal border-vela-teal/40 bg-vela-teal/10"
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Income Level */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1.5">Income Level</label>
              <div className="flex gap-2">
                {INCOME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateProfile("incomeLevel", opt.value)}
                    className={`flex-1 px-2 py-2 rounded-lg text-center border transition-colors ${
                      profile.incomeLevel === opt.value
                        ? "text-vela-teal border-vela-teal/40 bg-vela-teal/10"
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-medium block">{opt.label}</span>
                    <span className="text-[9px] text-zinc-600">{opt.range}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle flags */}
            <div className="flex flex-wrap gap-3">
              <TogglePill
                label="Stable Income"
                active={profile.hasStableIncome}
                onToggle={() => updateProfile("hasStableIncome", !profile.hasStableIncome)}
              />
              <TogglePill
                label="Has Dependents"
                active={profile.hasDependents}
                onToggle={() => updateProfile("hasDependents", !profile.hasDependents)}
              />
              <TogglePill
                label="Emergency Fund"
                active={profile.hasEmergencyFund}
                onToggle={() => updateProfile("hasEmergencyFund", !profile.hasEmergencyFund)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Profile summary + score */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="vela-card flex flex-col items-center justify-center py-5 sm:col-span-1">
          <p className={`text-4xl font-bold tabular ${percentileColor(result.overallPercentile)}`}>
            {result.overallPercentile}<span className="text-lg">th</span>
          </p>
          <p className={`text-sm font-medium mt-0.5 ${percentileColor(result.overallPercentile)}`}>
            {percentileLabel(result.overallPercentile)}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Overall Percentile</p>
        </div>
        <div className="vela-card py-5 sm:col-span-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-vela-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-400">
                Benchmarks adjusted for: <span className="text-zinc-200">{result.profileSummary}</span>
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {result.metrics.length} metrics compared. Thresholds are personalized to your risk tolerance, career stage, and income level.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="space-y-3">
        {result.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Missing data hint */}
      {result.metrics.length < 5 && (
        <div className="vela-card border-vela-teal/20 px-4 py-3">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-vela-teal mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-400">
              Add more data to unlock additional benchmarks. Fill in your{" "}
              {!nwSummary && <span className="text-vela-teal">Net Worth</span>}
              {!nwSummary && !cfSummary && ", "}
              {!cfSummary && <span className="text-vela-teal">Cash Flow</span>}
              {" "}for a more complete picture.
            </p>
          </div>
        </div>
      )}

      {/* Sources */}
      <div className="vela-card border-zinc-700">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">Privacy & Sources</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Your data never leaves your browser. All comparisons are calculated locally against
              statistical benchmarks from the Federal Reserve Survey of Consumer Finances and BLS data,
              then adjusted based on your profile settings.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Benchmarks are approximate. Individual circumstances vary. This is not financial advice.
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}

// ── Toggle Pill ──────────────────────────────────────────────────────────────

function TogglePill({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
        active
          ? "bg-vela-teal/10 text-vela-teal border-vela-teal/30"
          : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${active ? "bg-vela-teal" : "bg-zinc-600"}`} />
      {label}
    </button>
  );
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: BenchmarkMetric }) {
  const pct = metric.percentile ?? 50;
  const isAbove = metric.higherIsBetter
    ? (metric.userValue ?? 0) >= metric.benchmarkValue
    : (metric.userValue ?? 0) <= metric.benchmarkValue;

  return (
    <div className="vela-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-100">{metric.label}</h3>
            {isAbove ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
            {metric.personalized && (
              <span className="text-[8px] text-vela-teal bg-vela-teal/10 px-1 py-0.5 rounded">
                PERSONALIZED
              </span>
            )}
          </div>

          {/* Comparison */}
          <div className="flex items-baseline gap-4 mt-2">
            <div>
              <p className="text-xs text-zinc-500">You</p>
              <p className={`text-lg font-bold tabular ${percentileColor(pct)}`}>
                {metric.userValue !== null ? fmtMetric(metric.userValue, metric.unit) : "--"}
              </p>
            </div>
            <div className="text-zinc-600 text-xs">vs</div>
            <div>
              <p className="text-xs text-zinc-500">{metric.benchmarkLabel}</p>
              <p className="text-lg font-bold tabular text-zinc-400">
                {fmtMetric(metric.benchmarkValue, metric.unit)}
              </p>
            </div>
          </div>

          {/* Percentile bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden relative">
              <div className="absolute left-1/2 top-0 w-px h-full bg-zinc-600 z-10" />
              <div
                className={`h-full rounded-full transition-all ${percentileBarColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-medium tabular w-12 text-right ${percentileColor(pct)}`}>
              {pct}th
            </span>
          </div>

          {/* Insight */}
          <p className="text-xs text-zinc-500 mt-2">{metric.insight}</p>
        </div>
      </div>
    </div>
  );
}
