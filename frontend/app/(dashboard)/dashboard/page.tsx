"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Plus, Compass } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useMarketOverview } from "@/hooks/useMarkets";
import type { MarketIndex } from "@/hooks/useMarkets";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useNewsFeed } from "@/hooks/useNews";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useDividendSummary } from "@/hooks/useDividends";
import { useLearningCards } from "@/hooks/useLearningCards";
import { useUser } from "@/hooks/useUser";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import AllocationPie from "@/components/charts/AllocationPie";
import NewsCard from "@/components/news/NewsCard";
import { LearningCardRow } from "@/components/shared/LearningCard";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import PageTransition from "@/components/celestial/PageTransition";
import Typewriter from "@/components/celestial/Typewriter";
import DailyDebrief from "@/components/dashboard/DailyDebrief";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Eyebrow,
  Prose,
} from "@/components/instrument";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { getAdvisorRecommendations } from "@/lib/advisor-recommendations";

/** Compact currency for tight spaces */
function shortCurrency(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

/** Mono "view more" link, the editorial replacement for the old card CTAs. */
function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[10px] uppercase tracking-wider text-vela-muted
        hover:text-vela-teal transition-colors shrink-0"
    >
      {children} →
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const { portfolio, summary, loading, hasHoldings } = useDefaultPortfolio();
  const { usIndices, isLoading: marketsLoading } = useMarketOverview();
  const { items: watchlistItems, isLoading: watchlistLoading } = useWatchlist();
  const { articles: newsArticles, isLoading: newsLoading } = useNewsFeed();
  const { summary: nwSummary } = useNetWorthSummary();
  const { summary: cfSummary } = useCashFlowSummary();
  const { goals } = useGoals();
  const { dividends } = useDividendSummary(summary?.holdings ? (portfolio?.id ?? null) : null);
  const { cards: learningCards, dismiss: dismissCard } = useLearningCards();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const name =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Investor";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const subtitle = getPersonalizedSubtitle(hour, hasHoldings, summary, nwSummary, goals);

  const advisorRecs = useMemo(() => getAdvisorRecommendations({
    goalIcons: goals.map((g) => g.icon),
    netWorth: nwSummary?.net_worth ?? 0,
    hasPortfolio: hasHoldings,
    totalLiabilities: nwSummary?.total_liabilities ?? 0,
    savingsRate: cfSummary?.savings_rate ?? null,
    annualDividendIncome: dividends?.total_annual_income ?? 0,
  }), [goals, nwSummary, hasHoldings, cfSummary, dividends]);

  if (loading) {
    return <DashboardLoadingSkeleton />;
  }

  const pulseIndices = usIndices.filter((idx) =>
    ["^GSPC", "^IXIC", "^DJI", "^VIX"].includes(idx.ticker),
  );
  const watchlistPreview = watchlistItems.slice(0, 5);
  const dayPositive = (summary?.day_change ?? 0) >= 0;
  const pnlPositive = (summary?.unrealized_pnl ?? 0) >= 0;
  const filteredCards = learningCards.filter((c) => c.link !== "/dividends");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <PageTransition>
      <TopBar trail={[{ label: "Velnor" }, { label: "Today" }]} note={today} />

      <PageHero
        title={
          <>
            <Typewriter text={`${greeting}, `} speed={40} />
            <span className="text-vela-teal">
              <Typewriter text={name} delay={greeting.length * 40 + 100} speed={50} />
            </span>
          </>
        }
        figure={summary ? formatCurrency(summary.total_value) : undefined}
        figureSub={
          summary ? (
            <>
              {dayPositive ? "▲" : "▼"} {formatPercent(Math.abs(summary.day_change_pct), false)} today
            </>
          ) : undefined
        }
        figureSubClass={dayPositive ? "text-gain" : "text-loss"}
      />
      <motion.p
        className="mt-3 text-[13.5px] text-vela-body"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5 }}
      >
        {subtitle}
      </motion.p>

      {!hasHoldings || !summary ? (
        <div className="mt-8">
          <EmptyPortfolio />
        </div>
      ) : (
        <>
          <StatStrip className="mt-6">
            <StatCell
              label="Unrealized P&L"
              value={`${pnlPositive ? "+" : "−"}${formatCurrency(Math.abs(summary.unrealized_pnl))}`}
              valueClass={pnlPositive ? "text-gain" : "text-loss"}
              sub={formatPercent(summary.unrealized_pnl_pct)}
              subClass={pnlPositive ? "text-gain" : "text-loss"}
            />
            <StatCell
              label="Today"
              value={`${dayPositive ? "+" : "−"}${formatCurrency(Math.abs(summary.day_change))}`}
              valueClass={dayPositive ? "text-gain" : "text-loss"}
              sub={formatPercent(summary.day_change_pct)}
              subClass={dayPositive ? "text-gain" : "text-loss"}
            />
            {nwSummary ? (
              <StatCell
                label="Net worth"
                value={shortCurrency(nwSummary.net_worth)}
                valueClass="text-vela-teal"
                sub={`${shortCurrency(nwSummary.total_assets)} assets`}
              />
            ) : (
              <StatCell
                label="Cost basis"
                value={formatCurrency(summary.total_cost)}
                sub={`${summary.holdings.length} positions`}
              />
            )}
            {dividends && dividends.total_annual_income > 0 ? (
              <StatCell
                label="Dividend income"
                value={formatCurrency(dividends.total_annual_income)}
                valueClass="text-gain"
                sub={
                  dividends.next_ex_dates.length > 0
                    ? `next ${dividends.next_ex_dates[0].ticker} · ${formatDate(dividends.next_ex_dates[0].date)}`
                    : `${formatPercent((dividends.portfolio_yield ?? 0) * 100, false)} yield`
                }
              />
            ) : (
              <StatCell
                label="Positions"
                value={String(summary.holdings.length)}
                sub={formatCurrency(summary.total_cost) + " cost"}
              />
            )}
          </StatStrip>

          <Section label="Holdings" controls={<MoreLink href="/portfolio">All positions</MoreLink>}>
            <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-x-10 gap-y-8">
              <div className="min-w-0">
                <HoldingsTable
                  holdings={summary.holdings.slice(0, 5)}
                  onTickerClick={(ticker) => setSelectedTicker(ticker)}
                />
              </div>
              <div className="min-w-0 lg:border-l lg:border-vela-border lg:pl-10">
                <AllocationPie holdings={summary.holdings} />
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Market pulse + watchlist */}
      <Section label="Market pulse" controls={<MoreLink href="/markets">Markets</MoreLink>}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-x-10 gap-y-8">
          <div className="min-w-0">
            {marketsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-vela-border">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-vela-bg p-3">
                    <div className="skeleton h-3 w-16 mb-2" />
                    <div className="skeleton h-5 w-14" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-vela-border border border-vela-border">
                {pulseIndices.map((idx) => (
                  <PulseCard
                    key={idx.ticker}
                    index={idx}
                    onClick={() => setSelectedTicker(idx.ticker)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 lg:border-l lg:border-vela-border lg:pl-10">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Watchlist</Eyebrow>
              <MoreLink href="/watchlist">
                {watchlistItems.length > 5 ? "All" : "Manage"}
              </MoreLink>
            </div>
            {watchlistLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="skeleton h-4 w-14" />
                    <div className="skeleton h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : watchlistPreview.length === 0 ? (
              <div className="flex flex-col items-start gap-3 py-4">
                <Eye className="w-5 h-5 text-vela-muted" />
                <p className="text-[13px] text-vela-body">No tickers yet.</p>
                <Link
                  href="/watchlist"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded
                    bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
                    font-mono text-[10px] uppercase tracking-wider
                    hover:bg-vela-teal/15 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add tickers
                </Link>
              </div>
            ) : (
              <div className="border-t border-vela-border">
                {watchlistPreview.map((item) => {
                  const changePct = Number(item.day_change_pct);
                  const up = changePct >= 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTicker(item.ticker)}
                      className="w-full flex items-center justify-between py-2.5
                        border-b border-vela-border hover:bg-white/[0.025] transition-colors text-left"
                    >
                      <span className="text-[13px] font-medium text-zinc-100">{item.ticker}</span>
                      <span
                        className={`font-mono text-[12px] tabular-nums ${
                          item.day_change_pct == null
                            ? "text-vela-muted"
                            : up
                              ? "text-gain"
                              : "text-loss"
                        }`}
                      >
                        {item.day_change_pct != null ? formatPercent(changePct) : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Cash flow + goals */}
      {((cfSummary && cfSummary.total_income > 0) || goals.length > 0) && (
        <Section label="Money in motion">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            {cfSummary && cfSummary.total_income > 0 && (
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow>Cash flow</Eyebrow>
                  <MoreLink href="/cash-flow">Details</MoreLink>
                </div>
                <div className="flex items-end justify-between gap-4 mb-3">
                  <div>
                    <p
                      className={`font-mono text-[22px] font-semibold tabular-nums leading-none ${
                        (cfSummary.savings ?? 0) >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatCurrency(cfSummary.savings)}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-vela-body">monthly savings</p>
                  </div>
                  <p className="font-mono text-[13px] tabular-nums text-vela-body">
                    {formatPercent(cfSummary.savings_rate, false)} rate
                  </p>
                </div>
                <div className="h-1.5 bg-vela-border overflow-hidden flex">
                  {cfSummary.total_fixed > 0 && (
                    <div
                      className="bg-loss h-full"
                      style={{ width: `${(cfSummary.total_fixed / cfSummary.total_income) * 100}%` }}
                    />
                  )}
                  {cfSummary.total_variable > 0 && (
                    <div
                      className="bg-vela-teal h-full"
                      style={{ width: `${(cfSummary.total_variable / cfSummary.total_income) * 100}%` }}
                    />
                  )}
                  {(cfSummary.savings ?? 0) > 0 && (
                    <div
                      className="bg-gain h-full"
                      style={{ width: `${((cfSummary.savings ?? 0) / cfSummary.total_income) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}

            {goals.length > 0 && (
              <div className="min-w-0 lg:border-l lg:border-vela-border lg:pl-10">
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow>Goals</Eyebrow>
                  <MoreLink href="/goals">All</MoreLink>
                </div>
                <div className="space-y-3">
                  {goals.slice(0, 3).map((g) => {
                    const pct =
                      g.target_amount > 0
                        ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                        : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[13px] text-zinc-100 truncate">{g.name}</span>
                          <span className="font-mono text-[12px] tabular-nums text-vela-body shrink-0">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-vela-border overflow-hidden">
                          <div className="h-full bg-vela-teal" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {filteredCards.length > 0 && (
        <Section label="Worth knowing">
          <LearningCardRow cards={filteredCards.slice(0, 5)} onDismiss={dismissCard} />
        </Section>
      )}

      <Section label="Daily debrief">
        <DailyDebrief />
      </Section>

      {!newsLoading && newsArticles.length > 0 && (
        <Section label="News" controls={<MoreLink href="/news">All news</MoreLink>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-vela-border border border-vela-border">
            {newsArticles.slice(0, 3).map((a) => (
              <div key={a.url} className="bg-vela-bg p-4">
                <NewsCard article={a} compact />
              </div>
            ))}
          </div>
        </Section>
      )}

      {advisorRecs.length > 0 && (
        <Section
          label="Who can help"
          prose="Based on your goals and financial profile. These are pointers to licensed professionals, not advice."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-vela-border border border-vela-border">
            {advisorRecs.map((rec) => (
              <div key={rec.credential} className="bg-vela-bg p-4 space-y-2">
                <span className="inline-block font-mono text-[10px] uppercase tracking-wider
                  bg-vela-teal/10 text-vela-teal border border-vela-teal/20 px-2 py-0.5 rounded">
                  {rec.credential}
                </span>
                <p className="text-[13px] font-medium text-zinc-100">{rec.title}</p>
                <Prose className="text-[12.5px]">{rec.reason}</Prose>
                <p className="font-mono text-[11px] text-vela-muted">{rec.when}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <TickerDetailModal
        ticker={selectedTicker}
        open={!!selectedTicker}
        onOpenChange={(open) => {
          if (!open) setSelectedTicker(null);
        }}
      />
    </PageTransition>
  );
}

function PulseCard({ index, onClick }: { index: MarketIndex; onClick: () => void }) {
  const changePct = Number(index.change_pct ?? 0);
  const up = changePct >= 0;
  return (
    <button
      onClick={onClick}
      className="bg-vela-bg p-3 text-left hover:bg-white/[0.025] transition-colors min-w-0"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted truncate">
        {index.name}
      </p>
      <p
        className={`mt-1.5 font-mono text-[15px] font-semibold tabular-nums ${
          up ? "text-gain" : "text-loss"
        }`}
      >
        {formatPercent(changePct)}
      </p>
    </button>
  );
}

function EmptyPortfolio() {
  return (
    <div className="border-y border-vela-border py-16 flex flex-col items-center text-center gap-5">
      <div className="w-14 h-14 rounded-full bg-vela-teal/10 border border-vela-teal/20 flex items-center justify-center">
        <Compass className="w-6 h-6 text-vela-teal" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-zinc-100">Set sail</h2>
        <Prose className="mt-2 max-w-sm">
          Add your first trade manually, or import your transaction history from any broker.
        </Prose>
      </div>
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded
          bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
          font-mono text-[10px] uppercase tracking-wider
          hover:bg-vela-teal/15 transition-colors"
      >
        Add a trade
      </Link>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPersonalizedSubtitle(
  hour: number,
  hasHoldings: boolean,
  summary: any,
  nwSummary: any,
  goals: any[],
): string {
  // No portfolio yet
  if (!hasHoldings || !summary) {
    if (hour < 12) return "A fresh start. Let's chart your course.";
    if (hour < 18) return "Ready to set sail? Your portfolio awaits.";
    return "The stars are out. Great time to plan your next move.";
  }

  const dayPnl = summary.total_day_change ?? 0;
  const goalCount = goals.length;
  const netWorth = nwSummary?.net_worth ?? 0;

  // Portfolio is up today
  if (dayPnl > 0) {
    const pct = summary.total_day_change_pct ?? 0;
    if (pct > 2) return "Markets are flying today. Your portfolio is catching the wind.";
    return "Your portfolio is trending up. Steady as she goes.";
  }

  // Portfolio is down
  if (dayPnl < 0) {
    return "Markets are choppy today, but the course is set.";
  }

  // Flat / no change
  if (goalCount > 0) return `Tracking ${goalCount} goal${goalCount > 1 ? "s" : ""}. You're building momentum.`;
  if (netWorth > 0) return "Your wealth is in motion. Here's the view from above.";
  return "Here's your portfolio at a glance.";
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-40" />
      <div>
        <div className="skeleton h-11 w-72 mb-3" />
        <div className="skeleton h-4 w-56" />
      </div>
      <div className="skeleton h-20 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </div>
  );
}
