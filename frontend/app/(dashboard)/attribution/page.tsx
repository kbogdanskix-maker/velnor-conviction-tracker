"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import type { Holding } from "@/hooks/usePortfolio";
import { exportCSV } from "@/lib/export";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Legend,
  Eyebrow,
  Prose,
} from "@/components/instrument";
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
    <div className="rounded border border-vela-border bg-vela-card px-3 py-2 space-y-1">
      <p className="font-mono text-[11px] font-semibold tracking-[0.02em] text-zinc-100">{d.ticker}</p>
      <p className="font-mono text-[11px] tabular-nums text-vela-body">
        Weight {d.weight.toFixed(1)}%
      </p>
      <p
        className={`font-mono text-[11px] tabular-nums ${
          d.holdingReturn >= 0 ? "text-gain" : "text-loss"
        }`}
      >
        Return {formatPercent(d.holdingReturn)}
      </p>
      <p
        className={`font-mono text-[11px] tabular-nums ${
          d.contributionAbs >= 0 ? "text-gain" : "text-loss"
        }`}
      >
        Contribution {formatCurrency(d.contributionAbs)}
      </p>
    </div>
  );
}

// ── Attribution row ──────────────────────────────────────────────────

function AttributionRow({ a, rank }: { a: Attribution; rank: number }) {
  const isPositive = a.contributionAbs >= 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-vela-border last:border-0">
      <span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-vela-muted">
        {rank}
      </span>
      <span className="w-14 shrink-0 font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
        {a.ticker}
      </span>
      <div className="flex-1 min-w-[40px]">
        <div className="h-1.5 overflow-hidden rounded-sm border border-vela-border bg-vela-card">
          <div
            className={`h-full ${isPositive ? "bg-gain/70" : "bg-loss/70"}`}
            style={{ width: `${Math.min(Math.abs(a.contributionPct) * 5, 100)}%` }}
          />
        </div>
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-vela-muted">
        {a.weight.toFixed(1)}%
      </span>
      <span
        className={`w-16 shrink-0 text-right font-mono text-[11px] tabular-nums ${
          isPositive ? "text-gain" : "text-loss"
        }`}
      >
        {formatPercent(a.holdingReturn)}
      </span>
      <span
        className={`w-20 shrink-0 text-right font-mono text-[12px] font-medium tabular-nums ${
          isPositive ? "text-gain" : "text-loss"
        }`}
      >
        {formatCurrency(a.contributionAbs)}
      </span>
    </div>
  );
}

const COLHEAD = "font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted";

function RowHeader() {
  return (
    <div className={`hidden sm:flex items-center gap-3 pb-2 border-b border-vela-border ${COLHEAD}`}>
      <span className="w-5 shrink-0 text-right">#</span>
      <span className="w-14 shrink-0">Ticker</span>
      <span className="flex-1 min-w-[40px]">Impact</span>
      <span className="w-12 shrink-0 text-right">Weight</span>
      <span className="w-16 shrink-0 text-right">Return</span>
      <span className="w-20 shrink-0 text-right">P&amp;L</span>
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

  if (!hasHoldings || !attr) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Attribution" }]} note="no positions yet" />
        <PageHero title="Attribution" meta="Where the portfolio return came from" />
        <div className="mt-8">
          <Panel className="px-6 py-14 text-center">
            <Eyebrow>Nothing to attribute</Eyebrow>
            <Prose className="mx-auto mt-3 max-w-[380px]">
              There are no holdings on the book yet. Once positions are recorded, each one&apos;s
              share of the total return lands here.
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

  const pnlPositive = attr.totalReturn >= 0;
  const dayPositive = attr.dayChange >= 0;
  const positionCount = attr.all.length;

  const exportButton = (
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-vela-border
        font-mono text-[10px] uppercase tracking-wider text-vela-muted
        hover:text-zinc-100 hover:border-vela-teal/40 transition-colors"
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      Export
    </button>
  );

  const topMovers = [...attr.all]
    .sort((a, b) => Math.abs(b.dayContribution) - Math.abs(a.dayContribution))
    .slice(0, 6);

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Attribution" }]}
        note={`${positionCount} ${positionCount === 1 ? "position" : "positions"} · marked at last close`}
      />

      <PageHero
        title="Attribution"
        meta="Where the portfolio return came from"
        figure={formatCurrency(attr.totalReturn)}
        figureSub={`${formatPercent(attr.totalReturnPct)} on cost`}
        figureSubClass={pnlPositive ? "text-gain" : "text-loss"}
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Total P&L"
          value={formatCurrency(attr.totalReturn)}
          valueClass={pnlPositive ? "text-gain" : "text-loss"}
          sub={formatPercent(attr.totalReturnPct)}
          subClass={pnlPositive ? "text-gain" : "text-loss"}
        />
        <StatCell
          label="Day change"
          value={formatCurrency(attr.dayChange)}
          valueClass={dayPositive ? "text-gain" : "text-loss"}
          sub={formatPercent(attr.dayChangePct)}
          subClass={dayPositive ? "text-gain" : "text-loss"}
        />
        <StatCell
          label="Win rate"
          value={`${attr.winRate.toFixed(0)}%`}
          sub={`${attr.winners.length}W / ${attr.losers.length}L`}
        />
        <StatCell
          label="Avg win / avg loss"
          value={
            <>
              <span className="text-gain">{formatPercent(attr.avgWinnerReturn)}</span>
              <span className="text-vela-muted"> / </span>
              <span className="text-loss">{formatPercent(attr.avgLoserReturn)}</span>
            </>
          }
          sub="mean return per side"
        />
      </StatStrip>

      {/* ── Contribution by holding ───────────────────────────────────────── */}

      <Section
        label="Contribution"
        prose="Each holding's unrealized profit and loss in dollars, sorted from the largest positive contribution to the largest negative one."
        controls={exportButton}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[560px] h-[300px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attr.all} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2638" vertical={false} />
                <XAxis
                  dataKey="ticker"
                  tick={{ fill: "#8A97AC", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={attr.all.length > 8 ? -45 : 0}
                  textAnchor={attr.all.length > 8 ? "end" : "middle"}
                  height={attr.all.length > 8 ? 60 : 30}
                />
                <YAxis
                  tick={{ fill: "#8A97AC", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  width={55}
                />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="#1B2638" />
                <Bar dataKey="contributionAbs" animationDuration={800}>
                  {attr.all.map((entry) => (
                    <Cell
                      key={entry.ticker}
                      fill={entry.contributionAbs >= 0 ? "#34d399" : "#f43f5e"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Legend
          items={[
            { glyph: <span aria-hidden="true" className="w-2 h-2 bg-gain inline-block" />, label: "Positive contribution" },
            { glyph: <span aria-hidden="true" className="w-2 h-2 bg-loss inline-block" />, label: "Negative contribution" },
          ]}
          hint="unrealized, at last close"
        />
      </Section>

      {/* ── Contributors and detractors ───────────────────────────────────── */}

      <Section
        label="By holding"
        prose="The ten largest contributors and the ten largest detractors, measured in dollars against cost basis."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gain">
                Contributors
              </p>
              <span className="font-mono text-[10px] tabular-nums text-vela-muted">
                {attr.winners.length} {attr.winners.length === 1 ? "position" : "positions"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                {attr.winners.length === 0 ? (
                  <p className="py-4 font-mono text-[11px] text-vela-muted">No positions above cost.</p>
                ) : (
                  <>
                    <RowHeader />
                    {attr.winners.slice(0, 10).map((a, i) => (
                      <AttributionRow key={a.ticker} a={a} rank={i + 1} />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-loss">
                Detractors
              </p>
              <span className="font-mono text-[10px] tabular-nums text-vela-muted">
                {attr.losers.length} {attr.losers.length === 1 ? "position" : "positions"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                {attr.losers.length === 0 ? (
                  <p className="py-4 font-mono text-[11px] text-vela-muted">No positions below cost.</p>
                ) : (
                  <>
                    <RowHeader />
                    {attr.losers.slice(0, 10).map((a, i) => (
                      <AttributionRow key={a.ticker} a={a} rank={i + 1} />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Today's movers ────────────────────────────────────────────────── */}

      <Section
        label="Today"
        prose="The six holdings that moved the portfolio most in today's session, by dollar impact."
      >
        <div className="border-y border-vela-border divide-y divide-vela-border">
          {topMovers.map((a) => {
            const positive = a.dayContribution >= 0;
            return (
              <div key={a.ticker} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
                  {a.ticker}
                </span>
                <div className="flex items-baseline gap-4 shrink-0">
                  <span
                    className={`font-mono text-[13px] font-medium tabular-nums ${
                      positive ? "text-gain" : "text-loss"
                    }`}
                  >
                    {positive ? "+" : "−"}${Math.abs(a.dayContribution).toFixed(0)}
                  </span>
                  <span className="w-16 text-right font-mono text-[11px] tabular-nums text-vela-muted">
                    {formatPercent(a.dayContributionPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
          Contribution is unrealized profit and loss measured against cost basis, so it reflects
          position size as well as price move. Descriptive only, not investment advice.
        </p>
      </Section>
    </PageTransition>
  );
}
