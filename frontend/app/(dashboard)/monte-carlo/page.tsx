"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Dice5,
  ArrowRight,
  RefreshCw,
  Info,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(n: number, compact = false): string {
  if (compact) return formatCompact(n);
  return formatCurrency(n, "USD");
}

// ── Random normal (Box-Muller) ───────────────────────────────────────

function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Monte Carlo engine ───────────────────────────────────────────────

interface SimParams {
  startingBalance: number;
  annualContribution: number;
  annualWithdrawal: number;
  expectedReturn: number; // decimal
  volatility: number; // decimal
  inflationRate: number; // decimal
  years: number;
  simulations: number;
  phase: "accumulation" | "withdrawal";
}

interface SimResult {
  percentiles: { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  successRate: number; // % of sims that don't go to zero (withdrawal phase)
  medianFinal: number;
  p10Final: number;
  p90Final: number;
  bestCase: number;
  worstCase: number;
}

function runSimulation(params: SimParams): SimResult {
  const { startingBalance, annualContribution, annualWithdrawal, expectedReturn, volatility, inflationRate, years, simulations, phase } = params;

  // Store all paths: simulations x (years+1)
  const paths: number[][] = [];
  let failures = 0;

  for (let s = 0; s < simulations; s++) {
    const path: number[] = [startingBalance];
    let balance = startingBalance;
    let failed = false;

    for (let y = 1; y <= years; y++) {
      const inflationAdj = Math.pow(1 + inflationRate, y);
      const yearReturn = expectedReturn + volatility * randNormal();
      balance = balance * (1 + yearReturn);

      if (phase === "accumulation") {
        balance += annualContribution * inflationAdj;
      } else {
        balance -= annualWithdrawal * inflationAdj;
      }

      if (balance < 0) {
        balance = 0;
        if (!failed) { failures++; failed = true; }
      }
      path.push(Math.round(balance));
    }
    paths.push(path);
  }

  // Compute percentiles per year
  const percentiles: SimResult["percentiles"] = [];
  for (let y = 0; y <= years; y++) {
    const vals = paths.map((p) => p[y]).sort((a, b) => a - b);
    const idx = (pct: number) => Math.floor(pct * (vals.length - 1));
    percentiles.push({
      year: y,
      p10: vals[idx(0.1)],
      p25: vals[idx(0.25)],
      p50: vals[idx(0.5)],
      p75: vals[idx(0.75)],
      p90: vals[idx(0.9)],
    });
  }

  const finals = paths.map((p) => p[years]).sort((a, b) => a - b);
  const successRate = phase === "withdrawal" ? ((simulations - failures) / simulations) * 100 : 100;

  return {
    percentiles,
    successRate,
    medianFinal: finals[Math.floor(finals.length * 0.5)],
    p10Final: finals[Math.floor(finals.length * 0.1)],
    p90Final: finals[Math.floor(finals.length * 0.9)],
    bestCase: finals[finals.length - 1],
    worstCase: finals[0],
  };
}

// ── Confidence badge ─────────────────────────────────────────────────

function ConfidenceBadge({ rate }: { rate: number }) {
  let color: string, bg: string, label: string, Icon: typeof CheckCircle2;
  if (rate >= 90) {
    color = "text-gain"; bg = "bg-gain/10"; label = "High confidence"; Icon = CheckCircle2;
  } else if (rate >= 75) {
    color = "text-teal-400"; bg = "bg-teal-400/10"; label = "Good odds"; Icon = TrendingUp;
  } else if (rate >= 50) {
    color = "text-amber-400"; bg = "bg-amber-400/10"; label = "Moderate risk"; Icon = AlertTriangle;
  } else {
    color = "text-loss"; bg = "bg-loss/10"; label = "High risk"; Icon = AlertTriangle;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bg} ${color} text-xs font-medium`}>
      <Icon className="w-3.5 h-3.5" />
      {label} — {rate.toFixed(0)}% success
    </div>
  );
}

// ── Chart tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const names: Record<string, string> = {
    p90: "90th percentile (optimistic)",
    p75: "75th percentile",
    p50: "Median outcome",
    p25: "25th percentile",
    p10: "10th percentile (pessimistic)",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1.5">Year {label}</p>
      {payload
        .filter((p) => ["p10", "p25", "p50", "p75", "p90"].includes(p.dataKey))
        .map((p) => (
          <p key={p.dataKey} className={p.dataKey === "p50" ? "text-teal-400 font-medium" : "text-zinc-500"}>
            {names[p.dataKey] ?? p.dataKey}: {fmt(p.value, true)}
          </p>
        ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyMonteCarlo() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <Dice5 className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">Set up your financial data first</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          The Monte Carlo simulator uses your net worth and cash flow to model thousands of possible futures.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link href="/net-worth" className="btn-primary text-sm inline-flex items-center gap-2">
          Net Worth <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/cash-flow" className="btn-primary text-sm inline-flex items-center gap-2">
          Cash Flow <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function MonteCarloPage() {
  const { summary: nwSummary, isLoading: nwLoading } = useNetWorthSummary();
  const { summary: cfSummary, isLoading: cfLoading } = useCashFlowSummary();
  const { loading: pLoading, portfolio } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);

  // Parameters — seeded from real risk metrics when available
  const [phase, setPhase] = useState<"accumulation" | "withdrawal">("accumulation");
  const [years, setYears] = useState(30);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [volatility, setVolatility] = useState(15);
  const [inflationRate, setInflationRate] = useState(3);
  const [simCount, setSimCount] = useState(1000);
  const [annualWithdrawal, setAnnualWithdrawal] = useState(40000);
  const [seed, setSeed] = useState(0); // to force re-run
  const [seededFromRisk, setSeededFromRisk] = useState(false);

  // Auto-seed from real portfolio risk metrics once
  if (risk && !seededFromRisk) {
    if (risk.annualized_return != null && Number(risk.annualized_return) !== 0) {
      setExpectedReturn(parseFloat(Number(risk.annualized_return).toFixed(1)));
    }
    if (risk.annualized_volatility != null && Number(risk.annualized_volatility) > 0) {
      setVolatility(parseFloat(Number(risk.annualized_volatility).toFixed(1)));
    }
    setSeededFromRisk(true);
  }

  const loading = nwLoading || cfLoading || pLoading;
  const hasData = nwSummary && cfSummary && cfSummary.total_income > 0;

  const result = useMemo(() => {
    if (!nwSummary || !cfSummary) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    seed; // dependency to re-run
    const annualSavings = (cfSummary.total_income - cfSummary.total_expenses) * 12;
    return runSimulation({
      startingBalance: nwSummary.net_worth,
      annualContribution: phase === "accumulation" ? annualSavings : 0,
      annualWithdrawal: phase === "withdrawal" ? annualWithdrawal : 0,
      expectedReturn: expectedReturn / 100,
      volatility: volatility / 100,
      inflationRate: inflationRate / 100,
      years,
      simulations: simCount,
      phase,
    });
  }, [nwSummary, cfSummary, phase, years, expectedReturn, volatility, inflationRate, simCount, annualWithdrawal, seed]);

  const handleRerun = useCallback(() => setSeed((s) => s + 1), []);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Dice5 className="w-6 h-6 text-purple-400" />
            Monte Carlo Simulator
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {simCount.toLocaleString()} simulated futures for your portfolio
          </p>
        </div>
        {result && (
          <button
            onClick={handleRerun}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Re-run</span>
          </button>
        )}
      </div>

      {!hasData ? (
        <EmptyMonteCarlo />
      ) : result ? (
        <>
          {/* Phase toggle + success rate */}
          <FloatingCard glowColor="rgba(168, 85, 247, 0.10)" tilt={false}>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
              {/* Phase toggle */}
              <div className="flex bg-zinc-800 rounded-lg p-1">
                {(["accumulation", "withdrawal"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPhase(p)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      phase === p
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {p === "accumulation" ? "Growing Wealth" : "Spending Down"}
                  </button>
                ))}
              </div>

              {/* Success / outcome */}
              <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
                {phase === "withdrawal" && (
                  <ConfidenceBadge rate={result.successRate} />
                )}
                <div className="flex items-center gap-6 text-center sm:text-left">
                  <div>
                    <p className="text-xs text-zinc-500">Median Outcome</p>
                    <p className="text-lg font-display font-bold text-teal-400 tabular-nums">
                      {fmt(result.medianFinal, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Pessimistic (10th)</p>
                    <p className="text-lg font-display font-bold text-zinc-400 tabular-nums">
                      {fmt(result.p10Final, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Optimistic (90th)</p>
                    <p className="text-lg font-display font-bold text-zinc-200 tabular-nums">
                      {fmt(result.p90Final, true)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FloatingCard>

          {/* Fan chart */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Probability Fan</h2>
              <div className="h-[320px] sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.percentiles} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mcP90" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="mcP75" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="mcP50" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Years", position: "bottom", fill: "#52525b", fontSize: 11, offset: -5 }}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => fmt(v, true)}
                      width={65}
                    />
                    <Tooltip content={<ChartTooltip />} />

                    {/* Outer band (10-90) */}
                    <Area type="monotone" dataKey="p90" stackId="none" stroke="none" fill="url(#mcP90)" />
                    <Area type="monotone" dataKey="p10" stackId="none" stroke="rgb(113, 113, 122)" strokeWidth={1} strokeDasharray="4 4" fill="none" />

                    {/* Mid band (25-75) */}
                    <Area type="monotone" dataKey="p75" stackId="none" stroke="none" fill="url(#mcP75)" />
                    <Area type="monotone" dataKey="p25" stackId="none" stroke="rgb(113, 113, 122)" strokeWidth={0.5} strokeDasharray="2 2" fill="none" />

                    {/* Median */}
                    <Area type="monotone" dataKey="p50" stackId="none" stroke="rgb(20, 184, 166)" strokeWidth={2.5} fill="url(#mcP50)" />

                    {/* Zero line for withdrawal phase */}
                    {phase === "withdrawal" && (
                      <ReferenceLine y={0} stroke="rgb(244, 63, 94)" strokeDasharray="4 4" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-500 justify-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-teal-500 rounded" /> Median
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-purple-500/20 rounded" /> 25th – 75th
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-purple-500/10 rounded" /> 10th – 90th
                </span>
              </div>
            </div>
          </RevealOnScroll>

          {/* Parameters panel */}
          <RevealOnScroll delay={0.05}>
            <div className="vela-card">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-zinc-500" />
                <h2 className="section-heading !mb-0">Simulation Parameters</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { label: "Time Horizon", value: years, set: setYears, min: 5, max: 50, step: 1, suffix: " yrs", desc: "How far ahead to simulate" },
                  { label: seededFromRisk ? "Expected Return (live)" : "Expected Return", value: expectedReturn, set: setExpectedReturn, min: -10, max: 30, step: 0.5, suffix: "%", desc: "Average annual return" },
                  { label: seededFromRisk ? "Volatility (live)" : "Volatility", value: volatility, set: setVolatility, min: 5, max: 60, step: 1, suffix: "%", desc: "Annual standard deviation" },
                  { label: "Inflation", value: inflationRate, set: setInflationRate, min: 0, max: 8, step: 0.5, suffix: "%", desc: "Annual price increases" },
                  { label: "Simulations", value: simCount, set: setSimCount, min: 100, max: 5000, step: 100, suffix: "", desc: "More = smoother, slower" },
                  ...(phase === "withdrawal"
                    ? [{ label: "Annual Withdrawal", value: annualWithdrawal, set: setAnnualWithdrawal, min: 10000, max: 200000, step: 5000, suffix: "", desc: "Yearly spending in today's dollars", isMoney: true }]
                    : []),
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="text-xs text-zinc-400 font-medium">{s.label}</label>
                      <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">
                        {"isMoney" in s && s.isMoney ? fmt(s.value) : `${s.value}${s.suffix}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="w-full accent-purple-500 h-1.5"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Outcome distribution */}
          <RevealOnScroll delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Best Case", value: result.bestCase, color: "text-gain" },
                { label: "90th Percentile", value: result.p90Final, color: "text-zinc-200" },
                { label: "10th Percentile", value: result.p10Final, color: "text-zinc-400" },
                { label: "Worst Case", value: result.worstCase, color: result.worstCase === 0 ? "text-loss" : "text-zinc-500" },
              ].map((s) => (
                <div key={s.label} className="vela-card text-center">
                  <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                  <p className={`text-lg font-display font-bold tabular-nums ${s.color}`}>
                    {fmt(s.value, true)}
                  </p>
                </div>
              ))}
            </div>
          </RevealOnScroll>

          {/* Insights */}
          <RevealOnScroll delay={0.15}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">What This Means</h2>
              <div className="space-y-2">
                {(() => {
                  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];

                  if (phase === "withdrawal") {
                    if (result.successRate >= 95) {
                      insights.push({ type: "success", text: `Your plan has a ${result.successRate.toFixed(0)}% success rate — very strong. You could potentially increase withdrawals or retire earlier.` });
                    } else if (result.successRate >= 80) {
                      insights.push({ type: "info", text: `${result.successRate.toFixed(0)}% success rate is generally considered acceptable, but consider having a fallback plan for the ${(100 - result.successRate).toFixed(0)}% where funds run out.` });
                    } else {
                      insights.push({ type: "warning", text: `Only ${result.successRate.toFixed(0)}% of simulations succeeded. Consider reducing withdrawals, delaying retirement, or increasing savings.` });
                    }
                  }

                  if (result.medianFinal > (nwSummary?.net_worth ?? 0) * 3) {
                    insights.push({ type: "success", text: `The median outcome grows your wealth to ${fmt(result.medianFinal, true)} — more than 3x your current net worth.` });
                  }

                  const spread = result.p90Final - result.p10Final;
                  if (spread > result.medianFinal * 2) {
                    insights.push({ type: "info", text: `Wide range of outcomes — the spread between optimistic and pessimistic is ${fmt(spread, true)}. Higher volatility means more uncertainty.` });
                  }

                  if (volatility > 20) {
                    insights.push({ type: "warning", text: "Volatility above 20% significantly increases the range of outcomes. Consider diversifying to reduce portfolio volatility." });
                  }

                  if (phase === "accumulation" && cfSummary && cfSummary.total_income > cfSummary.total_expenses) {
                    const savingsRate = ((cfSummary.total_income - cfSummary.total_expenses) / cfSummary.total_income) * 100;
                    insights.push({ type: "info", text: `Your ${savingsRate.toFixed(0)}% savings rate compounds powerfully over ${years} years of growth.` });
                  }

                  return insights.map((ins, i) => {
                    const Icon = ins.type === "success" ? CheckCircle2 : ins.type === "warning" ? AlertTriangle : Info;
                    const colors = ins.type === "success" ? "text-gain border-gain/20 bg-gain/5" : ins.type === "warning" ? "text-amber-400 border-amber-400/20 bg-amber-400/5" : "text-teal-400 border-teal-400/20 bg-teal-400/5";
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg border ${colors}`}>
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-zinc-300">{ins.text}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </RevealOnScroll>

          {/* Related pages */}
          <RevealOnScroll delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { href: "/fi", label: "FI Tracker", desc: "Financial independence progress", icon: TrendingUp },
                { href: "/retirement", label: "Retirement", desc: "Detailed retirement planning", icon: Shield },
                { href: "/risk", label: "Risk Dashboard", desc: "Portfolio risk metrics", icon: Shield },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="vela-card group hover:border-zinc-600 transition-colors flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-purple-500/10 transition-colors">
                    <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{link.label}</p>
                    <p className="text-xs text-zinc-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </Link>
              ))}
            </div>
          </RevealOnScroll>
        </>
      ) : null}
    </PageTransition>
  );
}
