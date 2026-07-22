"use client";

import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { exportCSV } from "@/lib/export";
import { useDefaultPortfolio, ensurePortfolio } from "@/hooks/usePortfolio";
import type { Portfolio } from "@/hooks/usePortfolio";
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
import PageTransition from "@/components/celestial/PageTransition";
import { TopBar, PageHero, StatStrip, StatCell, Section } from "@/components/instrument";
import { formatCurrency, formatPercent } from "@/lib/formatters";

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

  const dayPositive = (summary?.day_change ?? 0) >= 0;
  const pnlPositive = (summary?.unrealized_pnl ?? 0) >= 0;
  const holdingCount = summary?.holdings.length ?? 0;

  const actions = hasHoldings ? (
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
              `velnor-positions-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-vela-border
            font-mono text-[10px] uppercase tracking-wider text-vela-muted
            hover:text-zinc-100 hover:border-vela-teal/40 transition-colors"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          Export
        </button>
      )}
      <button
        onClick={handleAddTrade}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded
          bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
          font-mono text-[10px] uppercase tracking-wider
          hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
      >
        <Plus className="w-3.5 h-3.5 shrink-0" />
        Add trade
      </button>
    </div>
  ) : null;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Positions" }]}
        note={
          hasHoldings
            ? `${holdingCount} ${holdingCount === 1 ? "position" : "positions"} · marked at last close`
            : "no positions yet"
        }
      />

      <PageHero
        title="Positions"
        meta={currentPortfolio?.name ?? "My Portfolio"}
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

      {!hasHoldings ? (
        <div className="mt-8">
          <EmptyPortfolio onAddTrade={handleAddTrade} />
        </div>
      ) : summary ? (
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
              label="Cost basis"
              value={formatCurrency(summary.total_cost)}
              sub={`${holdingCount} ${holdingCount === 1 ? "position" : "positions"}`}
            />
            <StatCell
              label="Today"
              value={`${dayPositive ? "+" : "−"}${formatCurrency(Math.abs(summary.day_change))}`}
              valueClass={dayPositive ? "text-gain" : "text-loss"}
              sub={formatPercent(summary.day_change_pct)}
              subClass={dayPositive ? "text-gain" : "text-loss"}
            />
            <StatCell
              label="Realized P&L"
              value={
                summary.realized_pnl !== 0
                  ? `${summary.realized_pnl >= 0 ? "+" : "−"}${formatCurrency(Math.abs(summary.realized_pnl))}`
                  : "—"
              }
              valueClass={
                summary.realized_pnl === 0
                  ? "text-zinc-100"
                  : summary.realized_pnl > 0
                    ? "text-gain"
                    : "text-loss"
              }
              sub="closed trades"
            />
          </StatStrip>

          {currentPortfolio && (
            <Section
              label="Performance"
              prose="Portfolio value over time, measured against what you paid."
            >
              <PerformanceChart portfolioId={currentPortfolio.id} />
            </Section>
          )}

          <Section label="Holdings" controls={actions}>
            <HoldingsTable
              holdings={summary.holdings}
              onTickerClick={(ticker) => setSelectedTicker(ticker)}
            />
          </Section>

          <Section label="Allocation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
              <AllocationPie holdings={summary.holdings} />
              <PortfolioPerformance />
            </div>
          </Section>

          {currentPortfolio && (
            <Section label="Activity" labelAside="append-only">
              <TransactionsTable portfolioId={currentPortfolio.id} onMutate={handleMutate} />
            </Section>
          )}
        </>
      ) : null}

      {currentPortfolio && (
        <AddTransactionModal
          portfolioId={currentPortfolio.id}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSuccess={handleMutate}
        />
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
