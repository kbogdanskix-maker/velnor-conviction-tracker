"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Flame,
  ArrowRight,
  Rocket,
  TrendingUp,
  Calendar,
  PiggyBank,
  DollarSign,
  Info,
  Target,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import { formatCurrency, formatCompact } from "@/lib/formatters";
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

// ── FI calculations ──────────────────────────────────────────────────

interface FiResult {
  fiNumber: number;
  coastFiNumber: number;
  currentProgress: number; // 0-100
  yearsToFi: number | null;
  coastFiAge: number | null;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  annualPassiveIncome: number;
  fiRatio: number; // passive income / expenses (0-1+)
  projectionData: { year: number; netWorth: number; fiTarget: number; coastLine?: number }[];
}

function calculateFi(params: {
  netWorth: number;
  portfolioValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  withdrawalRate: number;
  expectedReturn: number;
  inflationRate: number;
  currentAge: number;
  retirementAge: number;
  annualDividendIncome: number;
}): FiResult {
  const {
    netWorth,
    portfolioValue,
    monthlyIncome,
    monthlyExpenses,
    withdrawalRate,
    expectedReturn,
    inflationRate,
    currentAge,
    retirementAge,
    annualDividendIncome,
  } = params;

  const annualExpenses = monthlyExpenses * 12;
  const annualSavings = (monthlyIncome - monthlyExpenses) * 12;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
  const fiNumber = annualExpenses / (withdrawalRate / 100);
  const realReturn = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;

  // Coast FI: how much you need today so it grows to FI number by retirement age
  const yearsToRetirement = retirementAge - currentAge;
  const coastFiNumber = fiNumber / Math.pow(1 + realReturn, yearsToRetirement);

  // Progress
  const currentProgress = fiNumber > 0 ? Math.min((netWorth / fiNumber) * 100, 100) : 0;

  // FI ratio (passive income vs expenses)
  const fiRatio = annualExpenses > 0 ? annualDividendIncome / annualExpenses : 0;

  // Years to FI (compound growth + annual savings)
  let yearsToFi: number | null = null;
  if (annualSavings > 0 && realReturn > 0) {
    let nw = netWorth;
    for (let y = 1; y <= 100; y++) {
      nw = nw * (1 + realReturn) + annualSavings;
      if (nw >= fiNumber) {
        yearsToFi = y;
        break;
      }
    }
  } else if (netWorth >= fiNumber) {
    yearsToFi = 0;
  }

  // Coast FI age
  let coastFiAge: number | null = null;
  if (netWorth >= coastFiNumber) {
    coastFiAge = currentAge; // already coast FI
  } else if (annualSavings > 0) {
    let nw = netWorth;
    for (let y = 1; y <= 100; y++) {
      nw = nw * (1 + realReturn) + annualSavings;
      const coastNeeded = fiNumber / Math.pow(1 + realReturn, yearsToRetirement - y);
      if (nw >= coastNeeded) {
        coastFiAge = currentAge + y;
        break;
      }
    }
  }

  // Projection data (30 years)
  const projectionYears = Math.max(yearsToFi ?? 30, 30);
  const projectionData: FiResult["projectionData"] = [];
  let nw = netWorth;
  for (let y = 0; y <= projectionYears; y++) {
    const adjustedFi = fiNumber * Math.pow(1 + inflationRate / 100, y);
    projectionData.push({
      year: currentAge + y,
      netWorth: Math.round(nw),
      fiTarget: Math.round(adjustedFi),
    });
    nw = nw * (1 + realReturn) + annualSavings;
  }

  return {
    fiNumber,
    coastFiNumber,
    currentProgress,
    yearsToFi,
    coastFiAge,
    monthlyExpenses,
    monthlySavings: monthlyIncome - monthlyExpenses,
    savingsRate,
    annualPassiveIncome: annualDividendIncome,
    fiRatio,
    projectionData,
  };
}

// ── Progress ring ────────────────────────────────────────────────────

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const radius = 65;
  const stroke = 8;
  const circ = 2 * Math.PI * radius;
  const filled = (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 100 ? "text-gain" : pct >= 50 ? "text-teal-400" : pct >= 25 ? "text-amber-400" : "text-zinc-500";

  return (
    <div className="relative flex flex-col items-center">
      <svg width="160" height="160" className="-rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgb(39,39,42)" strokeWidth={stroke} />
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke="currentColor"
          className={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-display font-bold tabular-nums ${color}`}>
          {pct.toFixed(1)}%
        </span>
        <span className="text-xs text-zinc-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-zinc-200",
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="vela-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className={`text-xl font-display font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">Age {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className={p.dataKey === "netWorth" ? "text-teal-400" : "text-zinc-500"}>
          {p.dataKey === "netWorth" ? "Net Worth" : "FI Target"}: {formatCompact(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyFi() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <Flame className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">Set up your financial data first</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          The FI tracker needs your net worth and cash flow data. Add your income and expenses to get started.
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

export default function FinancialIndependencePage() {
  const { summary: nwSummary, isLoading: nwLoading, error: nwError } = useNetWorthSummary();
  const { summary: cfSummary, isLoading: cfLoading, error: cfError } = useCashFlowSummary();
  const { summary: pSummary, loading: pLoading, error: pError } = useDefaultPortfolio();

  // Assumptions (user-adjustable)
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [inflationRate, setInflationRate] = useState(3);
  const [currentAge, setCurrentAge] = useState(30);
  const [retirementAge, setRetirementAge] = useState(65);

  const loading = nwLoading || cfLoading || pLoading;

  // Estimate annual dividend income from portfolio
  const annualDividendIncome = useMemo(() => {
    if (!pSummary?.holdings) return 0;
    // Rough estimate: ~2% yield on equity portfolio
    const totalValue = pSummary.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    return totalValue * 0.02;
  }, [pSummary]);

  const fi = useMemo(() => {
    if (!nwSummary || !cfSummary) return null;
    return calculateFi({
      netWorth: nwSummary.net_worth,
      portfolioValue: nwSummary.portfolio_value,
      monthlyIncome: cfSummary.total_income,
      monthlyExpenses: cfSummary.total_expenses,
      withdrawalRate,
      expectedReturn,
      inflationRate,
      currentAge,
      retirementAge,
      annualDividendIncome,
    });
  }, [nwSummary, cfSummary, withdrawalRate, expectedReturn, inflationRate, currentAge, retirementAge, annualDividendIncome]);

  if (loading) return <DashboardSkeleton />;
  if (nwError || cfError || pError) return <ErrorState message="Failed to load financial independence data." onRetry={() => window.location.reload()} />;

  const hasData = nwSummary && cfSummary && cfSummary.total_income > 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-400" />
          Financial Independence
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Track your progress toward financial freedom
        </p>
      </div>

      {!hasData ? (
        <EmptyFi />
      ) : fi ? (
        <>
          {/* Hero — Progress ring + key stats */}
          <FloatingCard glowColor="rgba(251, 146, 60, 0.10)" tilt={false}>
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 py-2">
              <ProgressRing pct={fi.currentProgress} label="to FI" />

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                <div className="text-center md:text-left">
                  <p className="text-xs text-zinc-500">FI Number</p>
                  <p className="text-lg font-display font-bold text-zinc-100 tabular-nums">
                    {formatCompact(fi.fiNumber)}
                  </p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs text-zinc-500">Net Worth</p>
                  <p className="text-lg font-display font-bold text-teal-400 tabular-nums">
                    {formatCompact(nwSummary!.net_worth)}
                  </p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs text-zinc-500">Years to FI</p>
                  <p className={`text-lg font-display font-bold tabular-nums ${fi.yearsToFi === 0 ? "text-gain" : fi.yearsToFi && fi.yearsToFi < 15 ? "text-teal-400" : "text-zinc-200"}`}>
                    {fi.yearsToFi != null ? (fi.yearsToFi === 0 ? "🎉 Now!" : `${fi.yearsToFi} yrs`) : "N/A"}
                  </p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs text-zinc-500">FI Age</p>
                  <p className="text-lg font-display font-bold text-zinc-200 tabular-nums">
                    {fi.yearsToFi != null ? currentAge + fi.yearsToFi : "—"}
                  </p>
                </div>
              </div>
            </div>
          </FloatingCard>

          {/* Key metrics grid */}
          <RevealOnScroll>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={PiggyBank}
                label="Monthly Savings"
                value={formatCurrency(fi.monthlySavings)}
                sub={`${fi.savingsRate.toFixed(0)}% savings rate`}
                color={fi.monthlySavings > 0 ? "text-gain" : "text-loss"}
              />
              <StatCard
                icon={DollarSign}
                label="Monthly Expenses"
                value={formatCurrency(fi.monthlyExpenses)}
                sub={`${formatCompact(fi.monthlyExpenses * 12)}/yr`}
              />
              <StatCard
                icon={Rocket}
                label="Coast FI Number"
                value={formatCompact(fi.coastFiNumber)}
                sub={fi.coastFiAge != null && fi.coastFiAge <= currentAge ? "Already Coast FI!" : fi.coastFiAge ? `Coast FI at age ${fi.coastFiAge}` : undefined}
                color={nwSummary!.net_worth >= fi.coastFiNumber ? "text-gain" : "text-zinc-200"}
              />
              <StatCard
                icon={Target}
                label="FI Ratio"
                value={`${(fi.fiRatio * 100).toFixed(1)}%`}
                sub="Passive income ÷ expenses"
                color={fi.fiRatio >= 1 ? "text-gain" : fi.fiRatio >= 0.5 ? "text-teal-400" : "text-zinc-200"}
              />
            </div>
          </RevealOnScroll>

          {/* Projection chart */}
          <RevealOnScroll delay={0.05}>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Wealth Projection</h2>
              <div className="h-[300px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fi.projectionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatCompact(v)}
                      width={60}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="netWorth"
                      stroke="rgb(20, 184, 166)"
                      strokeWidth={2}
                      fill="url(#fiGrad)"
                      animationDuration={1200}
                    />
                    <Area
                      type="monotone"
                      dataKey="fiTarget"
                      stroke="rgb(161, 161, 170)"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      fill="none"
                      animationDuration={1200}
                    />
                    {fi.yearsToFi != null && fi.yearsToFi > 0 && (
                      <ReferenceLine
                        x={currentAge + fi.yearsToFi}
                        stroke="rgb(52, 211, 153)"
                        strokeDasharray="4 4"
                        label={{ value: "FI", position: "top", fill: "rgb(52, 211, 153)", fontSize: 11 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 mt-3 text-xs text-zinc-500 justify-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-teal-500 rounded" /> Net Worth
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-zinc-500 rounded border-dashed" /> FI Target
                </span>
              </div>
            </div>
          </RevealOnScroll>

          {/* Assumptions panel */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-zinc-500" />
                <h2 className="section-heading !mb-0">Assumptions</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Withdrawal Rate", value: withdrawalRate, set: setWithdrawalRate, min: 2, max: 6, step: 0.5, suffix: "%" },
                  { label: "Expected Return", value: expectedReturn, set: setExpectedReturn, min: 3, max: 12, step: 0.5, suffix: "%" },
                  { label: "Inflation", value: inflationRate, set: setInflationRate, min: 1, max: 6, step: 0.5, suffix: "%" },
                  { label: "Current Age", value: currentAge, set: setCurrentAge, min: 18, max: 70, step: 1, suffix: "" },
                  { label: "Target Retirement", value: retirementAge, set: setRetirementAge, min: 40, max: 80, step: 1, suffix: "" },
                ].map((s) => (
                  <div key={s.label}>
                    <label className="text-xs text-zinc-500 block mb-1.5">{s.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={s.value}
                        onChange={(e) => s.set(Number(e.target.value))}
                        className="flex-1 accent-teal-500 h-1.5"
                      />
                      <span className="text-sm font-medium text-zinc-200 tabular-nums w-10 text-right">
                        {s.value}{s.suffix}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* What-if insights */}
          <RevealOnScroll delay={0.15}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">What-If Scenarios</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(() => {
                  const scenarios: { label: string; desc: string; yearsToFi: number | null }[] = [];
                  // Save 500 more/month
                  const extra500 = (() => {
                    let nw = nwSummary!.net_worth;
                    const realRet = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;
                    const annualSav = (cfSummary!.total_income - cfSummary!.total_expenses + 500) * 12;
                    for (let y = 1; y <= 100; y++) {
                      nw = nw * (1 + realRet) + annualSav;
                      if (nw >= fi.fiNumber) return y;
                    }
                    return null;
                  })();
                  scenarios.push({ label: "Save $500 more/mo", desc: extra500 != null ? `FI in ${extra500} years` : "Still very far", yearsToFi: extra500 });

                  // Cut expenses by 20%
                  const cut20 = (() => {
                    const newExp = cfSummary!.total_expenses * 0.8;
                    const newFi = (newExp * 12) / (withdrawalRate / 100);
                    let nw = nwSummary!.net_worth;
                    const realRet = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;
                    const annualSav = (cfSummary!.total_income - newExp) * 12;
                    for (let y = 1; y <= 100; y++) {
                      nw = nw * (1 + realRet) + annualSav;
                      if (nw >= newFi) return y;
                    }
                    return null;
                  })();
                  scenarios.push({ label: "Cut expenses 20%", desc: cut20 != null ? `FI in ${cut20} years` : "Still very far", yearsToFi: cut20 });

                  // Higher return (10%)
                  const highRet = (() => {
                    let nw = nwSummary!.net_worth;
                    const realRet = (1 + 10 / 100) / (1 + inflationRate / 100) - 1;
                    const annualSav = (cfSummary!.total_income - cfSummary!.total_expenses) * 12;
                    for (let y = 1; y <= 100; y++) {
                      nw = nw * (1 + realRet) + annualSav;
                      if (nw >= fi.fiNumber) return y;
                    }
                    return null;
                  })();
                  scenarios.push({ label: "10% annual returns", desc: highRet != null ? `FI in ${highRet} years` : "Still very far", yearsToFi: highRet });

                  return scenarios.map((s) => {
                    const diff = fi.yearsToFi != null && s.yearsToFi != null ? fi.yearsToFi - s.yearsToFi : null;
                    return (
                      <div key={s.label} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                        <p className="text-sm font-medium text-zinc-200">{s.label}</p>
                        <p className="text-lg font-display font-bold text-teal-400 tabular-nums mt-1">{s.desc}</p>
                        {diff != null && diff > 0 && (
                          <p className="text-xs text-gain mt-1">{diff} year{diff !== 1 ? "s" : ""} sooner</p>
                        )}
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
                { href: "/retirement", label: "Retirement Planner", desc: "Detailed retirement projections", icon: Calendar },
                { href: "/goals", label: "Financial Goals", desc: "Track specific savings targets", icon: Target },
                { href: "/what-if", label: "What-If Simulator", desc: "Model life changes", icon: TrendingUp },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="vela-card group hover:border-zinc-600 transition-colors flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-vela-teal/10 transition-colors">
                    <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-vela-teal transition-colors" />
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
