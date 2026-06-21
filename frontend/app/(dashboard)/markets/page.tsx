"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMarketOverview, useTopMovers } from "@/hooks/useMarkets";
import type { MarketIndex, Mover } from "@/hooks/useMarkets";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import { formatCurrency, formatPercent, changePillClass } from "@/lib/formatters";
import PageTransition, { MotionSection } from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import FloatingCard from "@/components/celestial/FloatingCard";

export default function MarketsPage() {
  const { usIndices, intlIndices, isLoading: overviewLoading } = useMarketOverview();
  const { gainers, losers, isLoading: moversLoading } = useTopMovers();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  return (
    <PageTransition className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Markets</h1>
        <p className="text-zinc-500 text-sm mt-0.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live indices and top movers
        </p>
      </div>

      {/* US Indices */}
      <section>
        <h2 className="section-heading mb-3">US Indices</h2>
        {overviewLoading ? (
          <IndexCardsSkeleton count={5} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {usIndices.map((idx, i) => (
              <FloatingCard key={idx.ticker} delay={i * 0.07} tilt={true} pressable onClick={() => setSelectedTicker(idx.ticker)}>
                <IndexCardInner index={idx} />
              </FloatingCard>
            ))}
          </div>
        )}
      </section>

      {/* International Indices */}
      <RevealOnScroll>
      <section>
        <h2 className="section-heading mb-3">International</h2>
        {overviewLoading ? (
          <IndexCardsSkeleton count={7} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {intlIndices.map((idx, i) => (
              <FloatingCard key={idx.ticker} delay={i * 0.06} tilt={true} pressable onClick={() => setSelectedTicker(idx.ticker)}>
                <IndexCardInner index={idx} />
              </FloatingCard>
            ))}
          </div>
        )}
      </section>
      </RevealOnScroll>

      {/* Top Movers */}
      <RevealOnScroll delay={0.1}>
      <section className="space-y-4">
        <h2 className="section-heading">Top Movers</h2>

        {moversLoading ? (
          <MoversSkeleton />
        ) : (
          <>
            {/* Gainers  - horizontal scroll */}
            {gainers.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-gain" />
                  <span className="text-sm font-medium text-gain">Gainers</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {gainers.map((m) => (
                    <MoverCard
                      key={m.ticker}
                      mover={m}
                      onClick={() => setSelectedTicker(m.ticker)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Losers  - horizontal scroll */}
            {losers.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-loss" />
                  <span className="text-sm font-medium text-loss">Losers</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {losers.map((m) => (
                    <MoverCard
                      key={m.ticker}
                      mover={m}
                      onClick={() => setSelectedTicker(m.ticker)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
      </RevealOnScroll>

      {/* Ticker detail modal */}
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

// ── Index Card Inner  - content only (FloatingCard provides the vela-card wrapper)

function IndexCardInner({ index }: { index: MarketIndex }) {
  const changePct = Number(index.change_pct ?? 0);
  const isUp = changePct >= 0;
  const glowColor = isUp ? "rgba(52, 211, 153, 0.15)" : "rgba(244, 63, 94, 0.15)";

  return (
    <div className="p-4 cursor-pointer relative overflow-hidden">
      {/* Pulsing glow for live data feel */}
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowColor}, transparent 70%)` }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="text-sm font-medium text-zinc-300 truncate mb-1 relative">
        {index.name}
      </p>
      <p className={`text-xl font-bold tabular relative ${isUp ? "text-gain" : "text-loss"}`}>
        {formatPercent(changePct)}
      </p>
      <p className="text-xs text-zinc-500 tabular mt-0.5 relative">
        {index.price != null ? formatCurrency(index.price, "USD", true) : "---"}
      </p>
    </div>
  );
}

// ── Mover Card (horizontal scroll) ─────────────────────────────────────────

function MoverCard({ mover, onClick }: { mover: Mover; onClick: () => void }) {
  const changePct = Number(mover.change_pct ?? 0);
  const isUp = changePct >= 0;

  return (
    <motion.div
      onClick={onClick}
      className="vela-card shrink-0 w-36 cursor-pointer hover:border-zinc-600 transition-colors relative overflow-hidden"
      whileHover={{ scale: 1.04, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {/* Subtle side accent bar */}
      <motion.div
        className={`absolute left-0 top-0 w-[2px] h-full ${isUp ? "bg-gain" : "bg-loss"}`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ transformOrigin: "top" }}
      />
      <p className="text-sm font-semibold text-zinc-100 mb-1">{mover.ticker}</p>
      <span className={changePillClass(changePct)}>
        {formatPercent(changePct)}
      </span>
      <p className="text-xs text-zinc-500 tabular mt-1">
        {mover.price != null ? formatCurrency(mover.price) : " -"}
      </p>
    </motion.div>
  );
}

// ── Skeletons ───────────────────────────────────────────────────────────────

function IndexCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="vela-card">
          <div className="skeleton h-3.5 w-20 mb-2" />
          <div className="skeleton h-6 w-16 mb-1" />
          <div className="skeleton h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

function MoversSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="skeleton h-4 w-16 mb-2" />
          <div className="flex gap-3 overflow-hidden">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="vela-card shrink-0 w-36">
                <div className="skeleton h-4 w-12 mb-2" />
                <div className="skeleton h-5 w-16 mb-1" />
                <div className="skeleton h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
