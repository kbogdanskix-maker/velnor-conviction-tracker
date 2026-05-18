"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Coins,
  ArrowRight,
  TrendingUp,
  Calendar,
  Download,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary } from "@/hooks/useDividends";
import { exportCSV } from "@/lib/export";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";

// ── Forecast engine ──────────────────────────────────────────────────

interface ForecastYear {
  year: number;
  annualIncome: number;
  cumulativeIncome: number;
  portfolioValue: number;
  yield: number;
}

function projectDividends(params: {
  currentIncome: number;
  portfolioValue: number;
  currentYield: number;
  growthRate: number; // dividend growth %
  reinvest: boolean;
  additionalInvestment: number; // monthly
  years: number;
}): ForecastYear[] {
  const { currentIncome, portfolioValue, currentYield, growthRate, reinvest, additionalInvestment, years } = params;
  const result: ForecastYear[] = [];
  let pv = portfolioValue;
  let income = currentIncome;
  let cumulative = 0;

  for (let y = 0; y <= years; y++) {
    const yieldPct = pv > 0 ? (income / pv) * 100 : currentYield;
    cumulative += y === 0 ? 0 : income;

    result.push({
      year: new Date().getFullYear() + y,
      annualIncome: Math.round(income),
      cumulativeIncome: Math.round(cumulative),
      portfolioValue: Math.round(pv),
      yield: yieldPct,
    });

    if (y < years) {
      // Add reinvested dividends and new contributions
      if (reinvest) pv += income;
      pv += additionalInvestment * 12;
      // Grow dividends
      income *= 1 + growthRate / 100;
      // Dividends from new capital
      if (reinvest || additionalInvestment > 0) {
        const growthDenom = 1 + growthRate / 100;
        const newCapital = (reinvest && growthDenom > 0 ? income / growthDenom : 0) + additionalInvestment * 12;
        income += newCapital * (currentYield / 100);
      }
    }
  }

  return result;
}

// ── Monthly breakdown ────────────────────────────────────────────────

interface MonthlyDivData {
  month: string;
  amount: number;
  tickers: string[];
}

function estimateMonthly(holdings: { ticker: string; annual_income: number; ex_dividend_date: string | null }[]): MonthlyDivData[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const data: MonthlyDivData[] = months.map((m) => ({ month: m, amount: 0, tickers: [] }));

  for (const h of holdings) {
    if (h.annual_income <= 0) continue;
    const quarterly = h.annual_income / 4;

    if (h.ex_dividend_date) {
      const exMonth = new Date(h.ex_dividend_date).getMonth();
      // Assume quarterly from ex-date month
      for (let q = 0; q < 4; q++) {
        const m = (exMonth + q * 3) % 12;
        data[m].amount += quarterly;
        data[m].tickers.push(h.ticker);
      }
    } else {
      // Spread evenly
      const monthly = h.annual_income / 12;
      for (let m = 0; m < 12; m++) {
        data[m].amount += monthly;
      }
    }
  }

  return data;
}

// ── Tooltip ──────────────────────────────────────────────────────────

function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className={p.dataKey === "annualIncome" ? "text-amber-400" : "text-teal-400"}>
          {p.dataKey === "annualIncome" ? "Annual Income" : "Cumulative"}: {formatCompact(p.value)}
        </p>
      ))}
    </div>
  );
}

function MonthlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: MonthlyDivData }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="text-amber-400">{formatCurrency(d.amount)}</p>
      {d.tickers.length > 0 && (
        <p className="text-zinc-600 mt-0.5">{d.tickers.join(", ")}</p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function DividendForecastPage() {
  const { portfolio, loading, error: portfolioError } = useDefaultPortfolio();
  const { dividends, isLoading: divLoading, error: divError } = useDividendSummary(portfolio?.id ?? null);

  const [years, setYears] = useState(15);
  const [growthRate, setGrowthRate] = useState(5);
  const [reinvest, setReinvest] = useState(true);
  const [monthlyContrib, setMonthlyContrib] = useState(500);

  const forecast = useMemo(() => {
    if (!dividends) return null;
    return projectDividends({
      currentIncome: dividends.total_annual_income,
      portfolioValue: dividends.total_portfolio_value,
      currentYield: dividends.portfolio_yield,
      growthRate,
      reinvest,
      additionalInvestment: monthlyContrib,
      years,
    });
  }, [dividends, years, growthRate, reinvest, monthlyContrib]);

  const monthlyData = useMemo(() => {
    if (!dividends) return [];
    return estimateMonthly(dividends.holdings);
  }, [dividends]);

  if (loading || divLoading) return <DashboardSkeleton />;

  if (portfolioError || divError) return <ErrorState message="Failed to load dividend forecast data." onRetry={() => window.location.reload()} />;

  const hasDividends = dividends && dividends.total_annual_income > 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-400" />
            Dividend Forecast
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Project your future dividend income growth
          </p>
        </div>
        {forecast && forecast.length > 0 && (
          <button
            onClick={() => exportCSV(forecast.map((f) => ({
              Year: f.year, "Annual Income": f.annualIncome.toFixed(2),
              "Cumulative": f.cumulativeIncome.toFixed(2),
              "Portfolio Value": f.portfolioValue.toFixed(2),
              "Yield %": f.yield.toFixed(2),
            })), `vela-dividend-forecast-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {!hasDividends ? (
        <div className="vela-card text-center py-16 space-y-4">
          <Coins className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No dividend income yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Add dividend-paying stocks to your portfolio to see income projections.
            </p>
          </div>
          <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
            Go to Portfolio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : forecast ? (
        <>
          {/* Summary */}
          <FloatingCard glowColor="rgba(245, 158, 11, 0.10)" tilt={false}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-zinc-500">Current Annual Income</p>
                <p className="text-xl font-display font-bold text-amber-400 tabular-nums">
                  {formatCurrency(dividends!.total_annual_income)}
                </p>
                <p className="text-xs text-zinc-600">{formatCurrency(dividends!.total_annual_income / 12)}/mo</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Projected Year {years}</p>
                <p className="text-xl font-display font-bold text-gain tabular-nums">
                  {formatCurrency(forecast[forecast.length - 1].annualIncome)}
                </p>
                <p className="text-xs text-gain/60">
                  {dividends!.total_annual_income > 0 ? ((forecast[forecast.length - 1].annualIncome / dividends!.total_annual_income - 1) * 100).toFixed(0) : 0}% growth
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Income ({years}yr)</p>
                <p className="text-xl font-display font-bold text-zinc-200 tabular-nums">
                  {formatCompact(forecast[forecast.length - 1].cumulativeIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Portfolio Yield</p>
                <p className="text-xl font-display font-bold text-zinc-200 tabular-nums">
                  {((dividends!.portfolio_yield ?? 0) * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-zinc-600">{dividends!.holdings.filter((h) => h.annual_income > 0).length} payers</p>
              </div>
            </div>
          </FloatingCard>

          {/* Forecast chart */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Income Projection</h2>
              <div className="h-[300px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                    <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} width={55} />
                    <Tooltip cursor={false} content={<ForecastTooltip />} />
                    <Area type="monotone" dataKey="annualIncome" stroke="rgb(245, 158, 11)" strokeWidth={2.5} fill="url(#divGrad)" animationDuration={1200} />
                    <Area type="monotone" dataKey="cumulativeIncome" stroke="rgb(20, 184, 166)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" animationDuration={1200} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 mt-2 text-xs text-zinc-500 justify-center">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 rounded" /> Annual Income</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-teal-500 rounded opacity-60" /> Cumulative</span>
              </div>
            </div>
          </RevealOnScroll>

          {/* Monthly distribution + Parameters */}
          <RevealOnScroll delay={0.05}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly bar chart */}
              <div className="vela-card">
                <h2 className="section-heading mb-4">Monthly Distribution (Est.)</h2>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                      <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} width={40} />
                      <Tooltip cursor={false} content={<MonthlyTooltip />} />
                      <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                        {monthlyData.map((_, i) => (
                          <Cell key={i} fill="rgb(245, 158, 11)" fillOpacity={0.6 + (monthlyData[i].amount / Math.max(...monthlyData.map((d) => d.amount || 1))) * 0.4} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Parameters */}
              <div className="vela-card">
                <h2 className="section-heading mb-4">Assumptions</h2>
                <div className="space-y-4">
                  {[
                    { label: "Forecast Years", value: years, set: setYears, min: 5, max: 30, step: 1, suffix: " yrs" },
                    { label: "Dividend Growth Rate", value: growthRate, set: setGrowthRate, min: 0, max: 15, step: 0.5, suffix: "%" },
                    { label: "Monthly Contribution", value: monthlyContrib, set: setMonthlyContrib, min: 0, max: 5000, step: 100, suffix: "", isMoney: true },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="text-xs text-zinc-400">{s.label}</label>
                        <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">
                          {"isMoney" in s && s.isMoney ? formatCurrency(s.value) : `${s.value}${s.suffix}`}
                        </span>
                      </div>
                      <input
                        type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                        onChange={(e) => s.set(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setReinvest(!reinvest)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${reinvest ? "bg-amber-500" : "bg-zinc-700"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${reinvest ? "left-5.5 translate-x-0" : "left-0.5"}`} style={{ left: reinvest ? "22px" : "2px" }} />
                    </button>
                    <span className="text-xs text-zinc-400">DRIP (reinvest dividends)</span>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>

          {/* Top payers table */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Top Dividend Payers</h2>
              <div className="space-y-2">
                {dividends!.holdings
                  .filter((h) => h.annual_income > 0)
                  .sort((a, b) => b.annual_income - a.annual_income)
                  .slice(0, 10)
                  .map((h) => (
                    <div key={h.ticker} className="flex items-center gap-3">
                      <span className="w-14 text-sm font-mono font-medium text-zinc-200">{h.ticker}</span>
                      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/70 transition-all duration-700"
                          style={{ width: `${(h.annual_income / dividends!.total_annual_income) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-xs text-zinc-400 tabular-nums text-right">
                        {(h.dividend_yield ?? 0).toFixed(1)}%
                      </span>
                      <span className="w-20 text-sm font-medium text-amber-400 tabular-nums text-right">
                        {formatCurrency(h.annual_income)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </RevealOnScroll>
        </>
      ) : null}
    </PageTransition>
  );
}
