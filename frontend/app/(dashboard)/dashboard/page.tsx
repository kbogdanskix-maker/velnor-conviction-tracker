"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Plus, PiggyBank, Target, Coins, Compass, GraduationCap } from "lucide-react";
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
import PnLSummary from "@/components/portfolio/PnLSummary";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import AllocationPie from "@/components/charts/AllocationPie";
import NewsCard from "@/components/news/NewsCard";
import { LearningCardRow } from "@/components/shared/LearningCard";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import PageTransition, { MotionSection } from "@/components/celestial/PageTransition";
import Typewriter from "@/components/celestial/Typewriter";
import FloatingCard from "@/components/celestial/FloatingCard";
import GlowBorder from "@/components/celestial/GlowBorder";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DailyDebrief from "@/components/dashboard/DailyDebrief";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import { formatCurrency, formatPercent, formatDate, changePillClass } from "@/lib/formatters";
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

  // Personalized subtitle based on portfolio state + time
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

  return (
    <PageTransition className="space-y-6">
      {/* Hero greeting */}
      <MotionSection>
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-zinc-100">
          <Typewriter text={`${greeting}, `} speed={40} />
          <span className="text-vela-teal relative inline-block">
            <Typewriter text={name} delay={greeting.length * 40 + 100} speed={50} />
            <motion.span
              className="absolute -bottom-1 left-0 h-[2px] bg-vela-teal/40 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            />
          </span>
        </h1>
        <motion.p
          className="text-slate-500 text-sm mt-2 h-5"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.5 }}
        >
          {subtitle}
        </motion.p>
      </MotionSection>

      {/* Portfolio Section */}
      {!hasHoldings || !summary ? (
        <MotionSection>
          <GlowBorder speed={6}>
            <EmptyPortfolio />
          </GlowBorder>
        </MotionSection>
      ) : (
        <>
          <MotionSection>
            <FloatingCard glowColor="rgba(26, 168, 187, 0.15)" tilt={false}>
              <PnLSummary summary={summary} />
            </FloatingCard>
          </MotionSection>

          {nwSummary && (
            <MotionSection className="grid grid-cols-3 gap-3">
              {[
                { label: "Net Worth", raw: nwSummary.net_worth, color: "text-vela-teal", href: "/net-worth", glow: "rgba(26, 168, 187, 0.12)" },
                { label: "Assets", raw: nwSummary.total_assets, color: "text-zinc-100", href: "/net-worth", glow: "rgba(26, 168, 187, 0.10)" },
                { label: "Liabilities", raw: nwSummary.total_liabilities, color: "text-loss", href: "/net-worth", glow: "rgba(244, 63, 94, 0.10)" },
              ].map((stat, i) => (
                <FloatingCard key={stat.label} delay={0.3 + i * 0.1} glowColor={stat.glow} pressable>
                  <Link href={stat.href} className="block group px-3 sm:px-5 py-4">
                    <p className="text-xs text-zinc-500 mb-0.5">{stat.label}</p>
                    <AnimatedNumber
                      value={stat.raw}
                      format={shortCurrency}
                      duration={1000}
                      className={`text-sm sm:text-lg font-bold tabular ${stat.color} transition-colors duration-300`}
                    />
                  </Link>
                </FloatingCard>
              ))}
            </MotionSection>
          )}

          {dividends && dividends.total_annual_income > 0 && (
            <MotionSection>
              <FloatingCard glowColor="rgba(52, 211, 153, 0.10)" delay={0.2}>
                <Link href="/dividends" className="block group p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-zinc-400 group-hover:text-vela-teal transition-colors" />
                      <h2 className="text-sm font-medium text-zinc-300">Dividends</h2>
                    </div>
                    <span className="text-xs text-vela-teal group-hover:translate-x-1 transition-transform duration-300">Details &rarr;</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-zinc-500">Annual income</p>
                      <AnimatedNumber
                        value={dividends.total_annual_income}
                        format={formatCurrency}
                        duration={900}
                        className="text-lg font-bold tabular text-gain block"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Yield</p>
                      <AnimatedNumber
                        value={(dividends.portfolio_yield ?? 0) * 100}
                        format={(n) => formatPercent(n, false)}
                        duration={900}
                        className="text-lg font-bold tabular text-zinc-100 block"
                      />
                    </div>
                    {dividends.next_ex_dates.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500">Next ex-date</p>
                        <p className="text-sm font-medium tabular text-zinc-300">
                          {dividends.next_ex_dates[0].ticker} &middot; {formatDate(dividends.next_ex_dates[0].date)}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              </FloatingCard>
            </MotionSection>
          )}

          <MotionSection className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FloatingCard className="lg:col-span-2" glowColor="rgba(26, 168, 187, 0.08)" tilt={false}>
              <div className="p-5 space-y-2">
                <h2 className="section-heading">Holdings</h2>
                <HoldingsTable
                  holdings={summary.holdings.slice(0, 5)}
                  onTickerClick={(ticker) => setSelectedTicker(ticker)}
                />
                {summary.holdings.length > 5 && (
                  <Link href="/portfolio" className="text-sm text-vela-teal hover:text-vela-teal-dim transition-colors mt-1 inline-block">
                    View all {summary.holdings.length} holdings &rarr;
                  </Link>
                )}
              </div>
            </FloatingCard>
            <FloatingCard className="lg:col-span-1" glowColor="rgba(26, 168, 187, 0.08)" delay={0.15}>
              <div className="p-5">
                <AllocationPie holdings={summary.holdings} />
              </div>
            </FloatingCard>
          </MotionSection>
        </>
      )}

      {/* Market Pulse + Watchlist */}
      <RevealOnScroll>
        <MotionSection className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-heading">Market Pulse</h2>
              <Link href="/markets" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">View all &rarr;</Link>
            </div>
            {marketsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="vela-card"><div className="skeleton h-3 w-16 mb-2" /><div className="skeleton h-5 w-14" /></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pulseIndices.map((idx, i) => (
                  <PulseCard key={idx.ticker} index={idx} delay={i * 0.06} onClick={() => setSelectedTicker(idx.ticker)} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-heading">Watchlist</h2>
              <Link href="/watchlist" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">
                {watchlistItems.length > 5 ? "View all \u2192" : "Manage \u2192"}
              </Link>
            </div>
            {watchlistLoading ? (
              <div className="vela-card space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between"><div className="skeleton h-4 w-14" /><div className="skeleton h-4 w-12" /></div>
                ))}
              </div>
            ) : watchlistPreview.length === 0 ? (
              <FloatingCard glowColor="rgba(26, 168, 187, 0.08)">
                <div className="flex flex-col items-center py-8 text-center">
                  <Eye className="w-6 h-6 text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-500 mb-3">No tickers yet</p>
                  <Link href="/watchlist" className="btn-primary text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add tickers</Link>
                </div>
              </FloatingCard>
            ) : (
              <FloatingCard glowColor="rgba(26, 168, 187, 0.08)" tilt={false}>
                <div className="p-0 divide-y divide-white/[0.04] overflow-hidden">
                  {watchlistPreview.map((item, i) => {
                    const changePct = Number(item.day_change_pct);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.06, duration: 0.4 }}
                        onClick={() => setSelectedTicker(item.ticker)}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <span className="text-sm font-medium text-zinc-100">{item.ticker}</span>
                        <span className={changePillClass(changePct)}>{item.day_change_pct != null ? formatPercent(changePct) : "\u2014"}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </FloatingCard>
            )}
          </div>
        </MotionSection>
      </RevealOnScroll>

      {/* Cash Flow + Goals */}
      {((cfSummary && cfSummary.total_income > 0) || goals.length > 0) && (
        <RevealOnScroll delay={0.1}>
        <MotionSection className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cfSummary && cfSummary.total_income > 0 && (
            <FloatingCard glowColor="rgba(52, 211, 153, 0.08)" pressable>
            <Link href="/cash-flow" className="block group p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-zinc-400 group-hover:text-vela-teal transition-colors" />
                  <h2 className="text-sm font-medium text-zinc-300">Cash Flow</h2>
                </div>
                <span className="text-xs text-vela-teal group-hover:translate-x-1 transition-transform duration-300">Details &rarr;</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-xs text-zinc-500">Monthly savings</p>
                  <AnimatedNumber
                    value={cfSummary.savings}
                    format={formatCurrency}
                    duration={900}
                    className={`text-lg font-bold tabular ${(cfSummary.savings ?? 0) >= 0 ? "text-gain" : "text-loss"} block`}
                  />
                </div>
                <p className={`text-sm font-medium tabular ${(cfSummary.savings_rate ?? 0) >= 20 ? "text-gain" : (cfSummary.savings_rate ?? 0) >= 0 ? "text-vela-teal" : "text-loss"}`}>
                  {formatPercent(cfSummary.savings_rate, false)} savings rate
                </p>
              </div>
              <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden flex">
                {cfSummary.total_fixed > 0 && <motion.div className="bg-rose-500 h-full" initial={{ width: 0 }} animate={{ width: `${(cfSummary.total_fixed / cfSummary.total_income) * 100}%` }} transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }} />}
                {cfSummary.total_variable > 0 && <motion.div className="bg-amber-500 h-full" initial={{ width: 0 }} animate={{ width: `${(cfSummary.total_variable / cfSummary.total_income) * 100}%` }} transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }} />}
                {(cfSummary.savings ?? 0) > 0 && <motion.div className="bg-emerald-500 h-full" initial={{ width: 0 }} animate={{ width: `${((cfSummary.savings ?? 0) / cfSummary.total_income) * 100}%` }} transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }} />}
              </div>
            </Link>
            </FloatingCard>
          )}
          {goals.length > 0 && (
            <FloatingCard glowColor="rgba(26, 168, 187, 0.08)" pressable>
            <Link href="/goals" className="block group p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-zinc-400 group-hover:text-vela-teal transition-colors" />
                  <h2 className="text-sm font-medium text-zinc-300">Goals</h2>
                </div>
                <span className="text-xs text-vela-teal group-hover:translate-x-1 transition-transform duration-300">View all &rarr;</span>
              </div>
              <div className="space-y-2">
                {goals.slice(0, 3).map((g, i) => {
                  const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-200 font-medium">{g.name}</span>
                        <span className="text-zinc-500 tabular">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-vela-teal rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.6 + i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Link>
            </FloatingCard>
          )}
        </MotionSection>
        </RevealOnScroll>
      )}

      {/* Learning Cards */}
      {(() => {
        const filtered = learningCards.filter((c) => c.link !== "/dividends");
        return filtered.length > 0 ? (
          <MotionSection>
            <LearningCardRow cards={filtered.slice(0, 5)} onDismiss={dismissCard} />
          </MotionSection>
        ) : null;
      })()}

      {/* Daily Debrief */}
      <RevealOnScroll delay={0.1}>
        <MotionSection>
          <DailyDebrief />
        </MotionSection>
      </RevealOnScroll>

      {/* News Preview */}
      {!newsLoading && newsArticles.length > 0 && (
        <RevealOnScroll delay={0.15}>
          <MotionSection className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-heading">News</h2>
              <Link href="/news" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">View all &rarr;</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {newsArticles.slice(0, 3).map((a, i) => (
                <FloatingCard key={a.url} delay={i * 0.08} glowColor="rgba(26, 168, 187, 0.06)" pressable>
                  <div className="p-4">
                    <NewsCard article={a} compact />
                  </div>
                </FloatingCard>
              ))}
            </div>
          </MotionSection>
        </RevealOnScroll>
      )}

      {/* Advisor Recommendations */}
      {advisorRecs.length > 0 && (
        <RevealOnScroll delay={0.2}>
          <MotionSection className="space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-zinc-400" />
              <h2 className="section-heading">Who can help</h2>
            </div>
            <p className="text-xs text-zinc-500 -mt-1">Based on your goals and financial profile</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {advisorRecs.map((rec, i) => (
                <FloatingCard key={rec.credential} delay={i * 0.1} glowColor="rgba(26, 168, 187, 0.06)">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wide bg-vela-teal/10 text-vela-teal border border-vela-teal/20 px-2 py-0.5 rounded">{rec.credential}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-200">{rec.title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{rec.reason}</p>
                    <p className="text-[11px] text-zinc-600 italic">{rec.when}</p>
                  </div>
                </FloatingCard>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">
              Velnor does not provide financial advice. These are educational pointers to help you find the right professional.
            </p>
          </MotionSection>
        </RevealOnScroll>
      )}

      <TickerDetailModal ticker={selectedTicker} open={!!selectedTicker} onOpenChange={(open) => { if (!open) setSelectedTicker(null); }} />
    </PageTransition>
  );
}

function PulseCard({ index, delay, onClick }: { index: MarketIndex; delay: number; onClick: () => void }) {
  const changePct = Number(index.change_pct ?? 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4 + delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
      whileHover={{ scale: 1.03, y: -2 }}
      onClick={onClick}
      className="vela-card flex items-center justify-between cursor-pointer group"
    >
      <span className="text-sm font-medium text-zinc-300 truncate mr-2">{index.name}</span>
      <span className={changePillClass(changePct)}>{formatPercent(changePct)}</span>
    </motion.div>
  );
}

function EmptyPortfolio() {
  return (
    <div className="space-y-4">
      <div className="vela-card text-center space-y-1">
        <p className="text-sm text-zinc-400 font-medium">Portfolio value</p>
        <p className="text-3xl font-display font-bold tabular text-zinc-100">&mdash;</p>
        <p className="text-sm text-zinc-500">Add your first trade to get started</p>
      </div>
      <div className="vela-card flex flex-col items-center justify-center py-20 text-center space-y-6 relative overflow-hidden">
        <div className="relative">
          <motion.div
            className="absolute -inset-8 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(26, 168, 187,0.2) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="relative w-16 h-16 rounded-full bg-vela-teal/10 border border-vela-teal/20 flex items-center justify-center"
            animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Compass className="w-7 h-7 text-vela-teal" />
          </motion.div>
        </div>
        <div>
          <motion.h2 className="text-xl font-display font-bold text-zinc-100" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
            Set sail
          </motion.h2>
          <motion.p className="text-zinc-500 text-sm mt-2 max-w-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}>
            Add your first trade manually or import your transaction history from any broker.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}>
          <Link href="/portfolio" className="btn-primary text-sm inline-flex items-center gap-2">Add a trade</Link>
        </motion.div>
      </div>
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
    if (hour < 12) return "A fresh start  - let's chart your course.";
    if (hour < 18) return "Ready to set sail? Your portfolio awaits.";
    return "The stars are out. Great time to plan your next move.";
  }

  const dayPnl = summary.total_day_change ?? 0;
  const goalCount = goals.length;
  const netWorth = nwSummary?.net_worth ?? 0;

  // Portfolio is up today
  if (dayPnl > 0) {
    const pct = summary.total_day_change_pct ?? 0;
    if (pct > 2) return "Markets are flying today  - your portfolio is catching the wind.";
    return "Your portfolio is trending up. Steady as she goes.";
  }

  // Portfolio is down
  if (dayPnl < 0) {
    return "Markets are choppy today, but the course is set.";
  }

  // Flat / no change
  if (goalCount > 0) return `Tracking ${goalCount} goal${goalCount > 1 ? "s" : ""}  - you're building momentum.`;
  if (netWorth > 0) return "Your wealth is in motion. Here's the view from above.";
  return "Here's your portfolio at a glance.";
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div><div className="skeleton h-9 w-64 mb-2" /><div className="skeleton h-4 w-48" /></div>
      <div className="skeleton h-28 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 skeleton h-48 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    </div>
  );
}
