"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Download,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import type { Holding } from "@/hooks/usePortfolio";
import { exportCSV } from "@/lib/export";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// ── Attribution model ────────────────────────────────────────────────

interface Attribution {
  ticker: string;
  weight: number; // % of portfolio
  holdingReturn: number; // unrealized P&L %
  contributionPct: number; // weighted contribution to portfolio return
  contributionAbs: number; // dollar contribution
  dayContribution: number; // today's dollar contribution
  dayContributionPct: number; // today's weighted contribution
}

interface AttributionSummary {
  totalReturn: number;
  totalReturnPct: number;
  dayChange: number;
  dayChangePct: number;
  winners: Attribution[];
  losers: Attribution[];
  topContributor: Attribution | null;
  worstDetractor: Attribution | null;
  winRate: number;
  avgWinnerReturn: number;
  avgLoserReturn: number;
  all: Attribution[];
}

function computeAttribution(holdings: Holding[]): AttributionSummary {
  const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? h.total_cost ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + (h.total_cost ?? 0), 0);
  const totalReturn = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
  const dayChange = holdings.reduce((s, h) => s + ((h.day_change ?? 0) * h.quantity), 0);
  const dayChangePct = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

  const all: Attribution[] = holdings.map((h) => {
    const weight = totalValue > 0 ? ((h.market_value ?? 0) / totalValue) * 100 : 0;
    const holdingReturn = h.unrealized_pnl_pct ?? 0;
    const contributionAbs = h.unrealized_pnl ?? 0;
    const contributionPct = totalCost > 0 ? (contributionAbs / totalCost) * 100 : 0;
    const dayContrib = (h.day_change ?? 0) * h.quantity;
    const dayContribPct = totalValue > 0 ? (dayContrib / totalValue) * 100 : 0;

    return {
      ticker: h.ticker,
      weight,
      holdingReturn,
      contributionPct,
      contributionAbs,
      dayContribution: dayContrib,
      dayContributionPct: dayContribPct,
    };
  });

  const winners = all.filter((a) => a.contributionAbs > 0).sort((a, b) => b.contributionAbs - a.contributionAbs);
  const losers = all.filter((a) => a.contributionAbs < 0).sort((a, b) => a.contributionAbs - b.contributionAbs);
  const sorted = [...all].sort((a, b) => b.contributionAbs - a.contributionAbs);

  const winRate = all.length > 0 ? (winners.length / all.length) * 100 : 0;
  const avgWinnerReturn = winners.length > 0 ? winners.reduce((s, w) => s + w.holdingReturn, 0) / winners.length : 0;
  const avgLoserReturn = losers.length > 0 ? losers.reduce((s, l) => s + l.holdingReturn, 0) / losers.length : 0;

  return {
    totalReturn,
    totalReturnPct,
    dayChange,
    dayChangePct,
    winners,
    losers,
    topContributor: sorted[0] ?? null,
    worstDetractor: sorted[sorted.length - 1] ?? null,
    winRate,
    avgWinnerReturn,
    avgLoserReturn,
    all: sorted,
  };
}

// ── Chart tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Attribution }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="text-zinc-100 font-medium">{d.ticker}</p>
      <p className="text-zinc-400">Weight: {d.weight.toFixed(1)}%</p>
      <p className={d.holdingReturn >= 0 ? "text-gain" : "text-loss"}>Return: {formatPercent(d.holdingReturn)}</p>
      <p className={d.contributionAbs >= 0 ? "text-gain" : "text-loss"}>Contribution: {formatCurrency(d.contributionAbs)}</p>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyAttribution() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <BarChart3 className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">No holdings to analyze</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          Add trades to your portfolio to see which holdings drive your returns.
        </p>
      </div>
      <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
        Go to Portfolio <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ── Attribution row ──────────────────────────────────────────────────

function AttributionRow({ a, rank }: { a: Attribution; rank: number }) {
  const isPositive = a.contributionAbs >= 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <span className="w-5 text-xs text-zinc-600 tabular-nums text-right">{rank}</span>
      <span className="w-14 text-sm font-mono font-medium text-zinc-200">{a.ticker}</span>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isPositive ? "bg-gain" : "bg-loss"}`}
            style={{
              width: `${Math.min(Math.abs(a.contributionPct) * 5, 100)}%`,
              marginLeft: isPositive ? 0 : undefined,
            }}
          />
        </div>
      </div>
      <span className="w-12 text-xs text-zinc-500 tabular-nums text-right">{a.weight.toFixed(1)}%</span>
      <span className={`w-16 text-xs tabular-nums text-right font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
        {formatPercent(a.holdingReturn)}
      </span>
      <span className={`w-20 text-sm tabular-nums text-right font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
        {formatCurrency(a.contributionAbs)}
      </span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function AttributionPage() {
  const { summary, loading, hasHoldings } = useDefaultPortfolio();

  const attr = useMemo(() => {
    if (!summary) return null;
    return computeAttribution(summary.holdings);
  }, [summary]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Performance Attribution</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            See which holdings drive your portfolio returns
          </p>
        </div>
        {attr && attr.all.length > 0 && (
          <button
            onClick={() =>
              exportCSV(
                attr.all.map((a) => ({
                  Ticker: a.ticker,
                  "Weight %": a.weight.toFixed(2),
                  "Return %": a.holdingReturn.toFixed(2),
                  "Contribution $": a.contributionAbs.toFixed(2),
                  "Contribution %": a.contributionPct.toFixed(4),
                })),
                `velnor-attribution-${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {!hasHoldings || !attr ? (
        <EmptyAttribution />
      ) : (
        <>
          {/* Summary cards */}
          <FloatingCard glowColor="rgba(20, 184, 166, 0.12)" tilt={false}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-zinc-500">Total P&L</p>
                <p className={`text-xl font-display font-bold tabular-nums ${attr.totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatCurrency(attr.totalReturn)}
                </p>
                <p className={`text-xs tabular-nums ${attr.totalReturnPct >= 0 ? "text-gain/70" : "text-loss/70"}`}>
                  {formatPercent(attr.totalReturnPct)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Day Change</p>
                <p className={`text-xl font-display font-bold tabular-nums ${attr.dayChange >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatCurrency(attr.dayChange)}
                </p>
                <p className={`text-xs tabular-nums ${attr.dayChangePct >= 0 ? "text-gain/70" : "text-loss/70"}`}>
                  {formatPercent(attr.dayChangePct)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Win Rate</p>
                <p className="text-xl font-display font-bold tabular-nums text-zinc-100">
                  {attr.winRate.toFixed(0)}%
                </p>
                <p className="text-xs text-zinc-600">{attr.winners.length}W / {attr.losers.length}L</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Avg W / Avg L</p>
                <p className="text-sm font-display font-bold tabular-nums text-zinc-100 mt-1">
                  <span className="text-gain">{formatPercent(attr.avgWinnerReturn)}</span>
                  {" / "}
                  <span className="text-loss">{formatPercent(attr.avgLoserReturn)}</span>
                </p>
              </div>
            </div>
          </FloatingCard>

          {/* Contribution waterfall chart */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Return Contribution by Holding</h2>
              <div className="h-[300px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={attr.all}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                    <XAxis
                      dataKey="ticker"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={attr.all.length > 8 ? -45 : 0}
                      textAnchor={attr.all.length > 8 ? "end" : "middle"}
                      height={attr.all.length > 8 ? 60 : 30}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                      width={55}
                    />
                    <Tooltip cursor={false} content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="rgb(63, 63, 70)" />
                    <Bar dataKey="contributionAbs" radius={[4, 4, 0, 0]} animationDuration={800}>
                      {attr.all.map((entry) => (
                        <Cell
                          key={entry.ticker}
                          fill={entry.contributionAbs >= 0 ? "rgb(52, 211, 153)" : "rgb(244, 63, 94)"}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </RevealOnScroll>

          {/* Winners vs Losers */}
          <RevealOnScroll delay={0.05}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top contributors */}
              <div className="vela-card">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-gain" />
                  <h2 className="text-sm font-medium text-zinc-200">Top Contributors</h2>
                  <span className="text-xs text-zinc-600 ml-auto">{attr.winners.length} positions</span>
                </div>
                {attr.winners.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-4">No winning positions</p>
                ) : (
                  <div className="hidden sm:flex items-center gap-3 pb-2 border-b border-zinc-800 mb-1 text-xs text-zinc-600">
                    <span className="w-5">#</span>
                    <span className="w-14">Ticker</span>
                    <span className="flex-1">Impact</span>
                    <span className="w-12 text-right">Weight</span>
                    <span className="w-16 text-right">Return</span>
                    <span className="w-20 text-right">P&L</span>
                  </div>
                )}
                {attr.winners.slice(0, 10).map((a, i) => (
                  <AttributionRow key={a.ticker} a={a} rank={i + 1} />
                ))}
              </div>

              {/* Detractors */}
              <div className="vela-card">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-loss" />
                  <h2 className="text-sm font-medium text-zinc-200">Detractors</h2>
                  <span className="text-xs text-zinc-600 ml-auto">{attr.losers.length} positions</span>
                </div>
                {attr.losers.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-4">No losing positions</p>
                ) : (
                  <div className="hidden sm:flex items-center gap-3 pb-2 border-b border-zinc-800 mb-1 text-xs text-zinc-600">
                    <span className="w-5">#</span>
                    <span className="w-14">Ticker</span>
                    <span className="flex-1">Impact</span>
                    <span className="w-12 text-right">Weight</span>
                    <span className="w-16 text-right">Return</span>
                    <span className="w-20 text-right">P&L</span>
                  </div>
                )}
                {attr.losers.slice(0, 10).map((a, i) => (
                  <AttributionRow key={a.ticker} a={a} rank={i + 1} />
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Today's movers */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Today&apos;s Movers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[...attr.all]
                  .sort((a, b) => Math.abs(b.dayContribution) - Math.abs(a.dayContribution))
                  .slice(0, 6)
                  .map((a) => {
                    const positive = a.dayContribution >= 0;
                    return (
                      <div
                        key={a.ticker}
                        className={`rounded-lg border p-3 text-center ${
                          positive
                            ? "bg-gain/5 border-gain/20"
                            : "bg-loss/5 border-loss/20"
                        }`}
                      >
                        <p className="text-xs font-mono font-medium text-zinc-200">{a.ticker}</p>
                        <p className={`text-sm font-bold tabular-nums mt-0.5 ${positive ? "text-gain" : "text-loss"}`}>
                          {a.dayContribution >= 0 ? "+" : ""}${Math.abs(a.dayContribution).toFixed(0)}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{formatPercent(a.dayContributionPct)}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </RevealOnScroll>
        </>
      )}
    </PageTransition>
  );
}
