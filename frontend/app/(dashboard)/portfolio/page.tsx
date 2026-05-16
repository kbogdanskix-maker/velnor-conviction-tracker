"use client";

import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { exportCSV } from "@/lib/export";
import { useDefaultPortfolio, ensurePortfolio } from "@/hooks/usePortfolio";
import type { Portfolio } from "@/hooks/usePortfolio";
import PnLSummary from "@/components/portfolio/PnLSummary";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import AllocationPie from "@/components/charts/AllocationPie";
import TransactionsTable from "@/components/portfolio/TransactionsTable";
import AddTransactionModal from "@/components/portfolio/AddTransactionModal";
import EmptyPortfolio from "@/components/portfolio/EmptyPortfolio";
import PortfolioPerformance from "@/components/portfolio/PortfolioPerformance";
import PerformanceChart from "@/components/portfolio/PerformanceChart";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import { mutate } from "swr";
import PageTransition, { MotionSection } from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";

export default function PortfolioPage() {
  const { portfolio, summary, loading, hasHoldings, mutateSummary } = useDefaultPortfolio();
  const [modalOpen, setModalOpen] = useState(false);
  const [createdPortfolio, setCreatedPortfolio] = useState<Portfolio | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const currentPortfolio = portfolio ?? createdPortfolio;

  async function handleAddTrade() {
    if (!currentPortfolio) {
      const p = await ensurePortfolio();
      setCreatedPortfolio(p);
    }
    setModalOpen(true);
  }

  function handleMutate() {
    mutate("/portfolios");
    mutateSummary();
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Portfolio</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {currentPortfolio?.name ?? "My Portfolio"}
          </p>
        </div>
        {hasHoldings && (
          <div className="flex items-center gap-2">
            {summary && (
              <button
                onClick={() =>
                  exportCSV(
                    summary.holdings.map((h) => ({
                      Ticker: h.ticker,
                      Quantity: h.quantity,
                      "Avg Cost": h.avg_cost_basis,
                      "Total Cost": h.total_cost,
                      "Current Price": h.current_price ?? "",
                      "Market Value": h.market_value ?? "",
                      "P&L": h.unrealized_pnl ?? "",
                      "P&L %": h.unrealized_pnl_pct ?? "",
                      "Day Change %": h.day_change_pct ?? "",
                    })),
                    `vela-portfolio-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <button onClick={handleAddTrade} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add trade</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {!hasHoldings ? (
        <EmptyPortfolio onAddTrade={handleAddTrade} />
      ) : summary ? (
        <>
          <FloatingCard glowColor="rgba(20, 184, 166, 0.15)" tilt={false}>
            <PnLSummary summary={summary} />
          </FloatingCard>

          {currentPortfolio && (
            <RevealOnScroll>
              <PerformanceChart portfolioId={currentPortfolio.id} />
            </RevealOnScroll>
          )}

          <RevealOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                <h2 className="section-heading">Holdings</h2>
                <HoldingsTable
                  holdings={summary.holdings}
                  onTickerClick={(ticker) => setSelectedTicker(ticker)}
                />
              </div>
              <div className="space-y-4">
                <AllocationPie holdings={summary.holdings} />
                <PortfolioPerformance />
              </div>
            </div>
          </RevealOnScroll>

          {/* Activity timeline */}
          {currentPortfolio && (
            <RevealOnScroll delay={0.1}>
              <div>
                <h2 className="section-heading mb-3">Activity</h2>
                <TransactionsTable
                  portfolioId={currentPortfolio.id}
                  onMutate={handleMutate}
                />
              </div>
            </RevealOnScroll>
          )}
        </>
      ) : null}

      {/* Add transaction modal */}
      {currentPortfolio && (
        <AddTransactionModal
          portfolioId={currentPortfolio.id}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSuccess={handleMutate}
        />
      )}

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
