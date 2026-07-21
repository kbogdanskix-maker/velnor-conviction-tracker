"use client";

import { useMemo } from "react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useDividendSummary } from "@/hooks/useDividends";
import { useGoals } from "@/hooks/useGoals";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  Trophy, TrendingUp, TrendingDown, DollarSign, Target, Star,
  ArrowUpRight, ArrowDownRight, Award, Zap, Calendar, PieChart,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";

/* ── helpers ────────────────────────────────────────────────── */

interface Holding {
  ticker: string;
  asset_type: string;
  quantity: number;
  avg_cost_basis: number;
  total_cost: number;
  currency: string;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  day_change: number | null;
  day_change_pct: number | null;
  name?: string;
  sector?: string;
}

const YEAR = new Date().getFullYear();

/* ── component ──────────────────────────────────────────────── */

export default function AnnualReviewPage() {
  const { summary, portfolio, hasHoldings, loading: pLoading } = useDefaultPortfolio();
  const { summary: nw } = useNetWorthSummary();
  const { summary: cf } = useCashFlowSummary();
  const { dividends: divs } = useDividendSummary(portfolio?.id ?? null);
  const { goals } = useGoals();

  const holdings = (summary?.holdings ?? []) as Holding[];

  const review = useMemo(() => {
    if (!holdings.length) return null;

    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    const totalCost = holdings.reduce((s, h) => s + h.total_cost, 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // Top winners & losers (by absolute P&L)
    const sorted = [...holdings].sort((a, b) => (b.unrealized_pnl ?? 0) - (a.unrealized_pnl ?? 0));
    const winners = sorted.filter((h) => (h.unrealized_pnl ?? 0) > 0).slice(0, 5);
    const losers = sorted.filter((h) => (h.unrealized_pnl ?? 0) < 0).reverse().slice(0, 5);

    // Sector breakdown
    const sectorMap: Record<string, number> = {};
    holdings.forEach((h) => {
      const sec = h.sector || "Other";
      sectorMap[sec] = (sectorMap[sec] || 0) + (h.market_value ?? 0);
    });
    const sectors = Object.entries(sectorMap)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    // Performance distribution
    const distBuckets = [
      { label: ">50%", min: 50, max: Infinity },
      { label: "20-50%", min: 20, max: 50 },
      { label: "10-20%", min: 10, max: 20 },
      { label: "0-10%", min: 0, max: 10 },
      { label: "-10-0%", min: -10, max: 0 },
      { label: "-20--10%", min: -20, max: -10 },
      { label: "<-20%", min: -Infinity, max: -20 },
    ];
    const distribution = distBuckets.map((b) => ({
      label: b.label,
      count: holdings.filter((h) => (h.unrealized_pnl_pct ?? 0) >= b.min && (h.unrealized_pnl_pct ?? 0) < b.max).length,
      positive: b.min >= 0,
    }));

    // Milestones
    const milestones: { icon: typeof Trophy; label: string; detail: string }[] = [];
    if (totalValue >= 100000) milestones.push({ icon: Trophy, label: "Six Figures", detail: `Portfolio reached ${formatCurrency(totalValue)}` });
    if (totalValue >= 50000 && totalValue < 100000) milestones.push({ icon: Star, label: "$50K Milestone", detail: `Portfolio at ${formatCurrency(totalValue)}` });
    if (winners.length >= 3) milestones.push({ icon: Zap, label: "Multi-Winner", detail: `${winners.length} positions in profit` });
    if (totalReturn > 20) milestones.push({ icon: Award, label: "20%+ Returns", detail: `Total return of ${formatPercent(totalReturn)}` });
    if (holdings.length >= 10) milestones.push({ icon: PieChart, label: "Diversified", detail: `${holdings.length} positions held` });
    const goalsComplete = goals?.filter((g) => g.current_amount >= g.target_amount).length ?? 0;
    if (goalsComplete > 0) milestones.push({ icon: Target, label: "Goals Achieved", detail: `${goalsComplete} goal${goalsComplete !== 1 ? "s" : ""} completed` });

    return {
      totalValue, totalCost, totalPnl, totalReturn,
      winners, losers, sectors, distribution, milestones,
      positionCount: holdings.length,
      winRate: holdings.length > 0 ? (winners.length / holdings.length) * 100 : 0,
    };
  }, [holdings, goals]);

  // Net worth & cash flow stats
  const netWorth = nw?.net_worth ?? 0;
  const totalIncome = cf?.total_income ?? 0;
  const totalExpenses = cf?.total_expenses ?? 0;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const divIncome = divs?.total_annual_income ?? 0;

  if (pLoading) {
    return (
      <PageTransition>
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6"><h1 className="text-2xl font-display font-bold text-zinc-100">{YEAR} Annual Review</h1><p className="text-zinc-400 text-sm mt-1">Your financial year at a glance</p></div>

        {/* ── Hero Stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5 text-center">
              <Calendar className="w-5 h-5 mx-auto text-zinc-500 mb-2" />
              <p className="text-xs text-zinc-400 font-medium mb-1">NET WORTH</p>
              <p className="text-xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(netWorth)}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.1}>
            <div className="p-5 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-emerald-400 mb-2" />
              <p className="text-xs text-zinc-400 font-medium mb-1">PORTFOLIO RETURN</p>
              <p className={`text-xl font-display font-bold tabular-nums ${(review?.totalReturn ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPercent(review?.totalReturn ?? 0)}
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-amber-400 mb-2" />
              <p className="text-xs text-zinc-400 font-medium mb-1">DIV INCOME</p>
              <p className="text-xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(divIncome)}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.3}>
            <div className="p-5 text-center">
              <PieChart className="w-5 h-5 mx-auto text-vela-teal mb-2" />
              <p className="text-xs text-zinc-400 font-medium mb-1">SAVINGS RATE</p>
              <p className="text-xl font-display font-bold text-vela-teal tabular-nums">{savingsRate.toFixed(0)}%</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Milestones ──────────────────────────────────────── */}
        {review && review.milestones.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.4}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" /> Milestones Unlocked
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {review.milestones.map((m, i) => {
                    const Icon = m.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{m.label}</p>
                          <p className="text-xs text-zinc-400">{m.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {review && (
          <>
            {/* ── Performance Distribution ────────────────────── */}
            <RevealOnScroll>
              <FloatingCard delay={0.5}>
                <div className="p-5">
                  <h2 className="font-display font-semibold text-zinc-100 mb-1">Return Distribution</h2>
                  <p className="text-xs text-zinc-500 mb-4">
                    {review.positionCount} positions · {review.winRate.toFixed(0)}% win rate
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={review.distribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                        <Tooltip cursor={false}
                          contentStyle={{ background: "#0B1322", border: "1px solid #1B2638", borderRadius: 8, color: "#EAEEF5" }}
                          labelStyle={{ color: "#8A97AC" }}
                          itemStyle={{ color: "#EAEEF5" }}
                          formatter={(v: number) => [`${v} positions`, ""]}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {review.distribution.map((d, i) => (
                            <Cell key={i} fill={d.positive ? "#34d399" : "#fb7185"} fillOpacity={0.7} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </FloatingCard>
            </RevealOnScroll>

            {/* ── Winners & Losers ────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RevealOnScroll>
                <FloatingCard delay={0.6}>
                  <div className="p-5">
                    <h2 className="font-display font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Top Winners
                    </h2>
                    <div className="space-y-3">
                      {review.winners.map((h, i) => (
                        <div key={h.ticker} className="flex items-center gap-3">
                          <span className="text-xs text-zinc-600 w-5 font-mono">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-100">{h.ticker}</p>
                            <p className="text-xs text-zinc-500 truncate">{h.name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatPercent((h.unrealized_pnl_pct ?? 0))}</p>
                            <p className="text-xs text-zinc-500 tabular-nums">{formatCurrency((h.unrealized_pnl ?? 0))}</p>
                          </div>
                        </div>
                      ))}
                      {review.winners.length === 0 && (
                        <p className="text-sm text-zinc-500 text-center py-4">No winning positions yet</p>
                      )}
                    </div>
                  </div>
                </FloatingCard>
              </RevealOnScroll>

              <RevealOnScroll>
                <FloatingCard delay={0.7}>
                  <div className="p-5">
                    <h2 className="font-display font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-rose-400" /> Biggest Losers
                    </h2>
                    <div className="space-y-3">
                      {review.losers.map((h, i) => (
                        <div key={h.ticker} className="flex items-center gap-3">
                          <span className="text-xs text-zinc-600 w-5 font-mono">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-100">{h.ticker}</p>
                            <p className="text-xs text-zinc-500 truncate">{h.name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-rose-400 tabular-nums">{formatPercent((h.unrealized_pnl_pct ?? 0))}</p>
                            <p className="text-xs text-zinc-500 tabular-nums">{formatCurrency((h.unrealized_pnl ?? 0))}</p>
                          </div>
                        </div>
                      ))}
                      {review.losers.length === 0 && (
                        <p className="text-sm text-zinc-500 text-center py-4">No losing positions  - nice!</p>
                      )}
                    </div>
                  </div>
                </FloatingCard>
              </RevealOnScroll>
            </div>

            {/* ── Sector Breakdown ────────────────────────────── */}
            {review.sectors.length > 0 && (
              <RevealOnScroll>
                <FloatingCard delay={0.8}>
                  <div className="p-5">
                    <h2 className="font-display font-semibold text-zinc-100 mb-4">Sector Allocation</h2>
                    <div className="space-y-2">
                      {review.sectors.slice(0, 8).map((s) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="text-sm text-zinc-300 w-28 truncate">{s.name}</span>
                          <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 tabular-nums w-12 text-right">{s.pct.toFixed(1)}%</span>
                          <span className="text-xs text-zinc-500 tabular-nums w-20 text-right">{formatCurrency(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </FloatingCard>
              </RevealOnScroll>
            )}

            {/* ── Financial Summary ───────────────────────────── */}
            <RevealOnScroll>
              <FloatingCard delay={0.9}>
                <div className="p-5">
                  <h2 className="font-display font-semibold text-zinc-100 mb-4">Financial Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-zinc-800/30">
                      <p className="text-xs text-zinc-500 mb-1">Portfolio Value</p>
                      <p className="text-lg font-bold text-zinc-100 tabular-nums">{formatCurrency(review.totalValue)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-800/30">
                      <p className="text-xs text-zinc-500 mb-1">Total P&L</p>
                      <p className={`text-lg font-bold tabular-nums ${review.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(review.totalPnl)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-800/30">
                      <p className="text-xs text-zinc-500 mb-1">Annual Income</p>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatCurrency(totalIncome)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-800/30">
                      <p className="text-xs text-zinc-500 mb-1">Annual Expenses</p>
                      <p className="text-lg font-bold text-rose-400 tabular-nums">{formatCurrency(totalExpenses)}</p>
                    </div>
                  </div>
                </div>
              </FloatingCard>
            </RevealOnScroll>
          </>
        )}

        {!review && (
          <FloatingCard delay={0.4}>
            <div className="text-center py-16 text-zinc-400">
              <Star className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium text-zinc-300 mb-1">Your review is waiting</p>
              <p>Add portfolio holdings to generate your annual review.</p>
            </div>
          </FloatingCard>
        )}
      </div>
    </PageTransition>
  );
}
