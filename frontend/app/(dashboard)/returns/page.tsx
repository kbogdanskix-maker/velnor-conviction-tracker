"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  PillGroup,
  Legend,
  Eyebrow,
  Prose,
} from "@/components/instrument";

/* ── custom tooltip ────────────────────────────────────────── */

function MonthlyReturnTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="rounded border border-vela-border bg-vela-card px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">{label}</p>
      <p
        className={`mt-1 font-mono text-[12px] tabular-nums ${val >= 0 ? "text-gain" : "text-loss"}`}
      >
        Return {val.toFixed(2)}%
      </p>
    </div>
  );
}

/* ── types ─────────────────────────────────────────────────── */

interface PerfPoint { date: string; value: number; cost_basis: number }
interface PerfResponse { period: string; data: PerfPoint[] }

type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
const PERIODS: { key: Period; label: string }[] = [
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "5y", label: "5Y" },
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

const TH =
  "py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-vela-muted whitespace-nowrap";

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

  if (loading) return <DashboardSkeleton />;

  if (!hasHoldings || !analysis) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Returns" }]} note="no positions yet" />
        <PageHero title="Returns" meta="Performance of the book over time" />
        <div className="mt-8">
          <Panel className="px-6 py-14 text-center">
            <Eyebrow>Nothing to measure</Eyebrow>
            <Prose className="mx-auto mt-3 max-w-[380px]">
              There are no holdings on the book yet. Once positions are recorded, holding-period and
              annualized returns land here.
            </Prose>
            <Link
              href="/portfolio"
              className="mt-5 inline-flex items-center rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5
                font-mono text-[10px] uppercase tracking-wider text-vela-teal
                hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
            >
              Go to positions
            </Link>
          </Panel>
        </div>
      </PageTransition>
    );
  }

  const { totalCost, totalPnl, hpr, annReturn, avgDays, holdingReturns, monthlyData, winRate, winners, losers, best, worst } = analysis;
  const isPositive = periodReturn.pct >= 0;
  const hprPositive = hpr >= 0;
  const annPositive = annReturn >= 0;

  const periodPills = (
    <PillGroup
      options={PERIODS}
      value={period}
      onChange={setPeriod}
      ariaLabel="Chart period"
    />
  );

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Returns" }]}
        note={`${holdings.length} ${holdings.length === 1 ? "position" : "positions"} · ${avgDays}d average hold`}
      />

      <PageHero
        title="Returns"
        meta="Holding-period performance of the book"
        figure={formatPercent(hpr)}
        figureSub={`${formatCurrency(totalPnl)} unrealized`}
        figureSubClass={hprPositive ? "text-gain" : "text-loss"}
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Total return"
          value={formatPercent(hpr)}
          valueClass={hprPositive ? "text-gain" : "text-loss"}
          sub={`${formatCurrency(totalPnl)} P&L`}
          subClass={hprPositive ? "text-gain" : "text-loss"}
        />
        <StatCell
          label="Annualized"
          value={formatPercent(annReturn)}
          valueClass={annPositive ? "text-gain" : "text-loss"}
          sub={
            risk?.annualized_return != null
              ? `risk-adj ${formatPercent(risk.annualized_return)}`
              : `${avgDays}d avg hold`
          }
          subClass="text-vela-muted"
        />
        <StatCell
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          sub={`${winners}W / ${losers}L`}
        />
        <StatCell
          label="Average hold"
          value={`${avgDays}d`}
          sub={`${holdings.length} ${holdings.length === 1 ? "position" : "positions"}`}
        />
      </StatStrip>

      {/* ── Equity curve ──────────────────────────────────────────────────── */}

      <Section
        label="Portfolio value"
        prose="Market value of the book over the selected window, with cost basis marked as a reference line."
        controls={
          <>
            {periodPills}
            {series.length > 1 && (
              <p className="font-mono text-[12px] tabular-nums text-vela-muted">
                <span className="text-zinc-100">
                  {formatCurrency(series[series.length - 1].value)}
                </span>{" "}
                <span className={isPositive ? "text-gain" : "text-loss"}>
                  {formatPercent(periodReturn.pct)} ({isPositive ? "+" : ""}
                  {formatCurrency(periodReturn.amt)})
                </span>
              </p>
            )}
          </>
        }
      >
        <div className="h-64">
          {perfLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-vela-teal/30 border-t-vela-teal rounded-full animate-spin" />
            </div>
          ) : series.length < 2 ? (
            <div className="h-full flex items-center justify-center font-mono text-[11px] text-vela-muted">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2638" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#8A97AC", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fill: "#8A97AC", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip
                  contentStyle={{ background: "#0B1322", border: "1px solid #1B2638", borderRadius: 4, fontSize: 12, color: "#AEB9CC" }}
                  labelStyle={{ color: "#8A97AC" }}
                  labelFormatter={shortDate}
                  formatter={(v: number) => [formatCurrency(v), "Value"]}
                />
                <ReferenceLine y={totalCost} stroke="#5A6678" strokeDasharray="4 4" label={{ value: "Cost basis", position: "right", fill: "#8A97AC", fontSize: 10 }} />
                <Area type="monotone" dataKey="value" stroke={isPositive ? "#34d399" : "#f43f5e"} strokeWidth={2} fill="url(#retGrad)" dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* ── Monthly returns ───────────────────────────────────────────────── */}

      {monthlyData.length > 0 && (
        <Section
          label="Monthly returns"
          prose="Month-on-month change in portfolio value across the last twelve months on record."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[420px] h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2638" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#8A97AC", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8A97AC", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={false} content={<MonthlyReturnTooltip />} />
                  <ReferenceLine y={0} stroke="#1B2638" />
                  <Bar dataKey="return_pct">
                    {monthlyData.map((d, i) => (
                      <Cell key={i} fill={d.return_pct >= 0 ? "#34d399" : "#f43f5e"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Legend
            items={[
              { glyph: <span aria-hidden="true" className="w-2 h-2 bg-gain inline-block" />, label: "Up month" },
              { glyph: <span aria-hidden="true" className="w-2 h-2 bg-loss inline-block" />, label: "Down month" },
            ]}
            hint="value change, not contributions"
          />
        </Section>
      )}

      {/* ── Range ─────────────────────────────────────────────────────────── */}

      <Section
        label="Range"
        prose="The widest holding-period returns on the book, at either end of the distribution."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
          {best && (
            <div className="min-w-0 border-t border-vela-border pt-4">
              <Eyebrow>Highest return</Eyebrow>
              <p className="mt-2 font-mono text-[15px] font-semibold tracking-[0.02em] text-zinc-100">
                {best.ticker}
              </p>
              <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
                <span
                  className={`font-mono text-[24px] font-medium tabular-nums leading-none ${
                    best.hpr >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatPercent(best.hpr)}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-vela-body">
                  {formatCurrency(best.pnl)}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] tabular-nums text-vela-muted">
                {formatPercent(best.contribution)} of portfolio return · {best.days}d held
              </p>
            </div>
          )}

          {worst && (
            <div className="min-w-0 border-t border-vela-border pt-4">
              <Eyebrow>Lowest return</Eyebrow>
              <p className="mt-2 font-mono text-[15px] font-semibold tracking-[0.02em] text-zinc-100">
                {worst.ticker}
              </p>
              <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
                <span
                  className={`font-mono text-[24px] font-medium tabular-nums leading-none ${
                    worst.hpr >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatPercent(worst.hpr)}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-vela-body">
                  {formatCurrency(worst.pnl)}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] tabular-nums text-vela-muted">
                {formatPercent(worst.contribution)} of portfolio return · {worst.days}d held
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Holdings performance ──────────────────────────────────────────── */}

      <Section
        label="By holding"
        prose="Every position with its holding-period return, the annualized equivalent, and its share of the total portfolio return."
      >
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-vela-border">
                <th className={`${TH} text-left`}>Ticker</th>
                <th className={`${TH} text-right`}>Weight</th>
                <th className={`${TH} text-right`}>Cost</th>
                <th className={`${TH} text-right`}>Value</th>
                <th className={`${TH} text-right`}>Return</th>
                <th className={`${TH} text-right`}>Ann. return</th>
                <th className={`${TH} text-right`}>P&amp;L</th>
                <th className={`${TH} text-right`}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {holdingReturns.map((h) => (
                <tr key={h.ticker} className="border-b border-vela-border last:border-0">
                  <td className="py-2.5">
                    <span className="font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
                      {h.ticker}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
                    {h.weight.toFixed(1)}%
                  </td>
                  <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
                    {formatCurrency(h.cost)}
                  </td>
                  <td className="py-2.5 font-mono tabular-nums text-right text-zinc-100">
                    {formatCurrency(h.value)}
                  </td>
                  <td className={`py-2.5 font-mono tabular-nums font-medium text-right ${h.hpr >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatPercent(h.hpr)}
                  </td>
                  <td className={`py-2.5 font-mono tabular-nums text-right ${h.annualized >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatPercent(h.annualized)}
                  </td>
                  <td className={`py-2.5 font-mono tabular-nums text-right ${h.pnl >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCurrency(h.pnl)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 overflow-hidden rounded-sm border border-vela-border bg-vela-card">
                        <div
                          className={`h-full ${h.contribution >= 0 ? "bg-gain/70" : "bg-loss/70"}`}
                          style={{ width: `${Math.min(100, Math.abs(h.contribution) * 10)}%` }}
                        />
                      </div>
                      <span className={`w-14 text-right font-mono text-[11px] tabular-nums ${h.contribution >= 0 ? "text-gain" : "text-loss"}`}>
                        {formatPercent(h.contribution)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile rows */}
        <div className="md:hidden border-y border-vela-border divide-y divide-vela-border">
          {holdingReturns.map((h) => (
            <div key={h.ticker} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
                  {h.ticker}
                </span>
                <span
                  className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${
                    h.hpr >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatPercent(h.hpr)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-vela-muted">
                <span className={h.pnl >= 0 ? "text-gain" : "text-loss"}>
                  {formatCurrency(h.pnl)}
                </span>
                <span className={h.annualized >= 0 ? "text-gain" : "text-loss"}>
                  {formatPercent(h.annualized)} ann.
                </span>
                <span>{h.weight.toFixed(1)}% weight</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
          Returns are unrealized and measured against cost basis. Annualized figures extrapolate the
          holding-period return over a full year and become unstable on short holds. Descriptive
          only, not investment advice.
        </p>
      </Section>
    </PageTransition>
  );
}
