"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, Percent, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

/* ── custom tooltip ────────────────────────────────────────── */

function MonthlyReturnTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#71717a", marginBottom: 2 }}>{label}</p>
      <p style={{ color: val >= 0 ? "#34d399" : "#fb7185" }}>Return: {val.toFixed(2)}%</p>
    </div>
  );
}

/* ── types ─────────────────────────────────────────────────── */

interface PerfPoint { date: string; value: number; cost_basis: number }
interface PerfResponse { period: string; data: PerfPoint[] }

type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
const PERIODS: { value: Period; label: string }[] = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
  { value: "5y", label: "5Y" },
];

/* ── helpers ────────────────────────────────────────────────── */

function computeReturn(cost: number, value: number) {
  if (cost <= 0) return 0;
  return ((value - cost) / cost) * 100;
}

function annualizeReturn(hpr: number, days: number) {
  if (days <= 0) return hpr;
  const factor = 1 + hpr / 100;
  if (factor <= 0) return -100;
  return (Math.pow(factor, 365 / days) - 1) * 100;
}

function daysSince(dateStr: string | undefined) {
  if (!dateStr) return 365;
  const d = new Date(dateStr);
  return Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function shortDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Compute real monthly returns from daily performance data */
function computeMonthlyReturns(data: PerfPoint[]) {
  if (data.length < 2) return [];

  const byMonth: Record<string, { first: number; last: number }> = {};
  for (const pt of data) {
    const key = pt.date.slice(0, 7); // "2025-03"
    if (!byMonth[key]) byMonth[key] = { first: pt.value, last: pt.value };
    byMonth[key].last = pt.value;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // last 12 months
    .map(([key, { first, last }]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        month: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" }),
        return_pct: first > 0 ? parseFloat(((last / first - 1) * 100).toFixed(2)) : 0,
      };
    });
}

/* ── component ──────────────────────────────────────────────── */

export default function ReturnsPage() {
  const { summary, portfolio, hasHoldings, loading } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);
  const [period, setPeriod] = useState<Period>("1y");

  // Real performance data from backend
  const { data: perfData, isLoading: perfLoading } = useSWR<PerfResponse>(
    portfolio?.id ? `/portfolios/${portfolio.id}/performance?period=${period}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const holdings = summary?.holdings ?? [];
  const series = perfData?.data ?? [];

  const analysis = useMemo(() => {
    if (!holdings.length) return null;

    const totalCost = holdings.reduce((s, h) => s + h.total_cost, 0);
    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    const totalPnl = totalValue - totalCost;
    const hpr = computeReturn(totalCost, totalValue);

    // Avg holding period (weighted by cost basis)
    const avgDays = holdings.reduce(
      (s, h) => s + daysSince((h as { first_bought?: string }).first_bought) * (h.total_cost / totalCost), 0,
    );
    const annReturn = annualizeReturn(hpr, avgDays);

    // Per-holding returns sorted by contribution
    const holdingReturns = holdings
      .map((h) => {
        const mv = h.market_value ?? 0;
        const pnl = h.unrealized_pnl ?? 0;
        const holdHpr = computeReturn(h.total_cost, mv);
        return {
          ticker: h.ticker,
          hpr: holdHpr,
          annualized: annualizeReturn(holdHpr, daysSince((h as { first_bought?: string }).first_bought)),
          pnl,
          value: mv,
          cost: h.total_cost,
          days: daysSince((h as { first_bought?: string }).first_bought),
          weight: totalValue > 0 ? (mv / totalValue) * 100 : 0,
          contribution: totalCost > 0 ? (pnl / totalCost) * 100 : 0,
        };
      })
      .sort((a, b) => b.contribution - a.contribution);

    // Real monthly returns from performance data
    const monthlyData = computeMonthlyReturns(series);

    const winners = holdingReturns.filter((h) => h.pnl > 0).length;

    return {
      totalCost, totalValue, totalPnl, hpr, annReturn,
      avgDays: Math.round(avgDays),
      holdingReturns,
      monthlyData,
      winRate: holdings.length > 0 ? (winners / holdings.length) * 100 : 0,
      winners,
      losers: holdings.length - winners,
      best: holdingReturns[0],
      worst: holdingReturns[holdingReturns.length - 1],
    };
  }, [holdings, series]);

  // Period return from chart data
  const periodReturn = useMemo(() => {
    if (series.length < 2) return { amt: 0, pct: 0 };
    const first = series[0].value;
    const last = series[series.length - 1].value;
    return {
      amt: last - first,
      pct: first > 0 ? ((last / first) - 1) * 100 : 0,
    };
  }, [series]);

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!hasHoldings || !analysis) {
    return (
      <PageTransition>
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold text-zinc-100">Returns</h1>
            <p className="text-zinc-400 text-sm mt-1">Track your investment performance</p>
          </div>
          <FloatingCard delay={0}>
            <div className="text-center py-16 text-zinc-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium text-zinc-300 mb-1">No holdings yet</p>
              <p>Add positions in your portfolio to see returns analysis.</p>
            </div>
          </FloatingCard>
        </div>
      </PageTransition>
    );
  }

  const { totalCost, totalValue, totalPnl, hpr, annReturn, avgDays, holdingReturns, monthlyData, winRate, winners, losers, best, worst } = analysis;
  const isPositive = periodReturn.pct >= 0;

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Returns</h1>
          <p className="text-zinc-400 text-sm mt-1">Portfolio performance analytics</p>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Percent className="w-3.5 h-3.5" />
                TOTAL RETURN
              </div>
              <p className={`text-2xl font-bold font-display tabular-nums ${hpr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPercent(hpr)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(totalPnl)} P&L</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5" />
                ANNUALIZED
              </div>
              <p className={`text-2xl font-bold font-display tabular-nums ${annReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPercent(annReturn)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {risk?.annualized_return != null ? `Risk-adj: ${formatPercent(risk.annualized_return)}` : `${avgDays}d avg hold`}
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Calendar className="w-3.5 h-3.5" />
                WIN RATE
              </div>
              <p className="text-2xl font-bold font-display tabular-nums text-zinc-100">
                {winRate.toFixed(0)}%
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                <span className="text-emerald-400">{winners}W</span>
                {" / "}
                <span className="text-rose-400">{losers}L</span>
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.3}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Clock className="w-3.5 h-3.5" />
                AVG HOLD
              </div>
              <p className="text-2xl font-bold font-display tabular-nums text-zinc-100">
                {avgDays}
                <span className="text-base font-normal text-zinc-500 ml-1">days</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">{holdings.length} positions</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Real Equity Curve ─────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.4}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display font-semibold text-zinc-100">Portfolio Value</h2>
                <div className="flex gap-0.5 sm:gap-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        period === p.value
                          ? "bg-vela-teal/20 text-vela-teal font-medium"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {series.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-bold tabular-nums text-zinc-100">{formatCurrency(series[series.length - 1].value)}</span>
                  <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {formatPercent(periodReturn.pct)}
                    <span className="text-zinc-500 ml-1">({isPositive ? "+" : ""}{formatCurrency(periodReturn.amt)})</span>
                  </span>
                </div>
              )}
              <div className="h-64">
                {perfLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-vela-teal/30 border-t-vela-teal rounded-full animate-spin" />
                  </div>
                ) : series.length < 2 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-500">
                    No performance data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isPositive ? "#34d399" : "#f43f5e"} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={isPositive ? "#34d399" : "#f43f5e"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12, color: "#e4e4e7" }}
                        labelStyle={{ color: "#71717a" }}
                        labelFormatter={shortDate}
                        formatter={(v: number) => [formatCurrency(v), "Value"]}
                      />
                      <ReferenceLine y={totalCost} stroke="#3f3f46" strokeDasharray="4 4" label={{ value: "Cost basis", position: "right", fill: "#52525b", fontSize: 10 }} />
                      <Area type="monotone" dataKey="value" stroke={isPositive ? "#34d399" : "#f43f5e"} strokeWidth={2} fill="url(#retGrad)" dot={false} animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Real Monthly Returns ──────────────────────────────────── */}
        {monthlyData.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.5}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Monthly Returns</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip cursor={false} content={<MonthlyReturnTooltip />} />
                      <ReferenceLine y={0} stroke="#3f3f46" />
                      <Bar dataKey="return_pct" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((d, i) => (
                          <Cell key={i} fill={d.return_pct >= 0 ? "#34d399" : "#fb7185"} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {/* ── Best / Worst ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RevealOnScroll>
            <FloatingCard delay={0.6}>
              <div className="p-5">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-3">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  BEST PERFORMER
                </div>
                {best && (
                  <>
                    <p className="text-lg font-bold text-zinc-100">{best.ticker}</p>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className={`text-2xl font-display font-bold tabular-nums ${best.hpr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatPercent(best.hpr)}</span>
                      <span className="text-sm text-zinc-500">{formatCurrency(best.pnl)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatPercent(best.contribution)} portfolio contribution · {best.days}d held
                    </p>
                  </>
                )}
              </div>
            </FloatingCard>
          </RevealOnScroll>

          <RevealOnScroll>
            <FloatingCard delay={0.7}>
              <div className="p-5">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-medium mb-3">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  WORST PERFORMER
                </div>
                {worst && (
                  <>
                    <p className="text-lg font-bold text-zinc-100">{worst.ticker}</p>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className={`text-2xl font-display font-bold tabular-nums ${worst.hpr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatPercent(worst.hpr)}
                      </span>
                      <span className="text-sm text-zinc-500">{formatCurrency(worst.pnl)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatPercent(worst.contribution)} portfolio contribution · {worst.days}d held
                    </p>
                  </>
                )}
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── Holdings Return Table ───────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.8}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Holdings Performance</h2>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="text-left py-2 pr-4">Ticker</th>
                      <th className="text-right py-2 px-3">Weight</th>
                      <th className="text-right py-2 px-3">Cost</th>
                      <th className="text-right py-2 px-3">Value</th>
                      <th className="text-right py-2 px-3">Return</th>
                      <th className="text-right py-2 px-3">Ann. Return</th>
                      <th className="text-right py-2 px-3">P&L</th>
                      <th className="text-right py-2 pl-3">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {holdingReturns.map((h) => (
                      <tr key={h.ticker} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="font-medium text-zinc-100">{h.ticker}</span>
                        </td>
                        <td className="text-right py-2.5 px-3 text-zinc-400 tabular-nums">{h.weight.toFixed(1)}%</td>
                        <td className="text-right py-2.5 px-3 text-zinc-400 tabular-nums">{formatCurrency(h.cost)}</td>
                        <td className="text-right py-2.5 px-3 text-zinc-100 tabular-nums">{formatCurrency(h.value)}</td>
                        <td className={`text-right py-2.5 px-3 tabular-nums font-medium ${h.hpr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(h.hpr)}
                        </td>
                        <td className={`text-right py-2.5 px-3 tabular-nums ${h.annualized >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(h.annualized)}
                        </td>
                        <td className={`text-right py-2.5 px-3 tabular-nums ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatCurrency(h.pnl)}
                        </td>
                        <td className="text-right py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${h.contribution >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                                style={{ width: `${Math.min(100, Math.abs(h.contribution) * 10)}%` }}
                              />
                            </div>
                            <span className={`text-xs tabular-nums ${h.contribution >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {formatPercent(h.contribution)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {holdingReturns.map((h) => (
                  <div key={h.ticker} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-zinc-100">{h.ticker}</span>
                      <span className={`text-sm font-bold tabular-nums ${h.hpr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatPercent(h.hpr)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500">P&L</span>
                        <p className={`tabular-nums ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(h.pnl)}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Ann.</span>
                        <p className={`tabular-nums ${h.annualized >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatPercent(h.annualized)}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Weight</span>
                        <p className="text-zinc-300 tabular-nums">{h.weight.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
