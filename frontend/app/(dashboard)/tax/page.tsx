"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Receipt, Clock, AlertTriangle, Scissors, Info, ChevronUp, ChevronDown,
  TrendingUp, TrendingDown, Shield,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useTaxSummary, type TaxHolding, type HarvestingOpportunity } from "@/hooks/useTax";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

type SortKey = "gain" | "days" | "ticker";

export default function TaxPage() {
  const { portfolio, loading: portfolioLoading } = useDefaultPortfolio();
  const { tax, isLoading } = useTaxSummary(portfolio?.id ?? null);
  const [sortBy, setSortBy] = useState<SortKey>("gain");
  const [sortAsc, setSortAsc] = useState(false);

  const loading = portfolioLoading || isLoading;

  const sortedHoldings = useMemo(() => {
    if (!tax?.holdings) return [];
    const list = [...tax.holdings];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "gain") cmp = a.unrealized_gain - b.unrealized_gain;
      else if (sortBy === "days") cmp = (a.days_held ?? 0) - (b.days_held ?? 0);
      else cmp = a.ticker.localeCompare(b.ticker);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [tax, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortBy !== k) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!tax || tax.holdings.length === 0) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <div className="vela-card text-center py-16">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium">No holdings yet</p>
          <p className="text-xs text-zinc-600 mt-1 mb-4">
            Add holdings to see tax impact estimates.
          </p>
          <Link href="/portfolio" className="btn-primary text-sm">
            Go to Portfolio
          </Link>
        </div>
      </PageTransition>
    );
  }

  const longTermCount = tax.holdings.filter((h) => h.is_long_term).length;
  const shortTermCount = tax.holdings.filter((h) => !h.is_long_term).length;
  const hasHarvesting = tax.harvesting_opportunities.length > 0;
  const totalHarvestable = tax.harvesting_opportunities.reduce((s, h) => s + h.potential_offset, 0);

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Unrealized"
          value={formatCurrency(tax.total_unrealized_gain)}
          color={tax.total_unrealized_gain >= 0 ? "text-gain" : "text-loss"}
        />
        <SummaryCard
          label="Long-Term Gains"
          value={formatCurrency(tax.total_long_term)}
          sub={`${longTermCount} position${longTermCount !== 1 ? "s" : ""}`}
          color={tax.total_long_term >= 0 ? "text-gain" : "text-loss"}
        />
        <SummaryCard
          label="Short-Term Gains"
          value={formatCurrency(tax.total_short_term)}
          sub={`${shortTermCount} position${shortTermCount !== 1 ? "s" : ""}`}
          color={tax.total_short_term >= 0 ? "text-gain" : "text-loss"}
        />
        <SummaryCard
          label="Harvestable Losses"
          value={hasHarvesting ? formatCurrency(totalHarvestable) : "None"}
          sub={hasHarvesting ? `${tax.harvesting_opportunities.length} position${tax.harvesting_opportunities.length !== 1 ? "s" : ""}` : "All positions in profit"}
          color={hasHarvesting ? "text-amber-400" : "text-zinc-500"}
        />
      </div>

      {/* Tax-loss harvesting alert */}
      {hasHarvesting && (
        <div className="vela-card border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <Scissors className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-200">Tax-loss harvesting opportunities</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                You have {formatCurrency(totalHarvestable)} in unrealized losses that could offset gains.
                Selling these positions would reduce your taxable gains for this year.
              </p>
              <div className="mt-3 space-y-1.5">
                {tax.harvesting_opportunities.map((opp) => (
                  <div key={opp.ticker} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-200">{opp.ticker}</span>
                      <span className="text-zinc-600">{opp.is_long_term ? "Long-term" : "Short-term"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-loss tabular">{formatPercent(opp.loss_pct)}</span>
                      <span className="text-loss tabular font-medium">{formatCurrency(opp.unrealized_loss)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-zinc-400" />
          Capital Gains by Position
        </h2>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-vela-border">
                <th className="text-left py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("ticker")}>
                  Ticker <SortIcon k="ticker" />
                </th>
                <th className="text-right py-2 font-medium">Cost Basis</th>
                <th className="text-right py-2 font-medium">Market Value</th>
                <th className="text-right py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("gain")}>
                  Gain/Loss <SortIcon k="gain" />
                </th>
                <th className="text-right py-2 font-medium">%</th>
                <th className="text-right py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("days")}>
                  Days Held <SortIcon k="days" />
                </th>
                <th className="text-center py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">LTCG in</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => (
                <TaxRow key={h.ticker} holding={h} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="sm:hidden space-y-2">
          {sortedHoldings.map((h) => (
            <MobileTaxCard key={h.ticker} holding={h} />
          ))}
        </div>
      </div>

      {/* Tax info */}
      <div className="vela-card bg-zinc-900/50 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Shield className="w-4 h-4 text-vela-teal" />
          How this works
        </h3>
        <div className="space-y-2 text-xs text-zinc-500 leading-relaxed">
          <p>
            <span className="text-zinc-300 font-medium">Long-term</span> = held over 1 year. Taxed at 0%, 15%, or 20% depending on income.
            <span className="text-zinc-300 font-medium ml-2">Short-term</span> = held under 1 year. Taxed as ordinary income (up to 37%).
          </p>
          <p>
            <span className="text-zinc-300 font-medium">Tax-loss harvesting</span>: sell losing positions to offset gains.
            Up to $3,000 in net losses can offset ordinary income per year. Watch out for wash sale rules (can&apos;t rebuy within 30 days).
          </p>
        </div>
        <div className="flex items-start gap-2 pt-2 border-t border-vela-border text-[10px] text-zinc-600">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Estimates only  - uses FIFO (first-in, first-out) by earliest buy date. Consult a tax professional for actual tax obligations. Not financial or tax advice.
          </span>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}


function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
        <Receipt className="w-6 h-6 text-vela-teal" />
        Tax Awareness
      </h1>
      <p className="text-zinc-500 text-sm mt-0.5">
        Holding periods, capital gains estimates, and tax-loss harvesting opportunities
      </p>
    </div>
  );
}


function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="vela-card">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-bold tabular ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}


function TaxRow({ holding: h }: { holding: TaxHolding }) {
  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
      <td className="py-2 text-zinc-100 font-medium">{h.ticker}</td>
      <td className="py-2 tabular text-right text-zinc-400">{formatCurrency(h.total_cost)}</td>
      <td className="py-2 tabular text-right text-zinc-300">{formatCurrency(h.market_value)}</td>
      <td className={`py-2 tabular text-right font-medium ${h.unrealized_gain >= 0 ? "text-gain" : "text-loss"}`}>
        {h.unrealized_gain >= 0 ? "+" : ""}{formatCurrency(h.unrealized_gain)}
      </td>
      <td className={`py-2 tabular text-right ${h.unrealized_gain_pct >= 0 ? "text-gain" : "text-loss"}`}>
        {formatPercent(h.unrealized_gain_pct)}
      </td>
      <td className="py-2 tabular text-right text-zinc-400">
        {h.days_held != null ? `${h.days_held}d` : " -"}
      </td>
      <td className="py-2 text-center">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
          h.is_long_term
            ? "bg-gain/15 text-gain"
            : "bg-amber-500/15 text-amber-400"
        }`}>
          {h.is_long_term ? "LTCG" : "STCG"}
        </span>
      </td>
      <td className="py-2 tabular text-right text-zinc-500">
        {h.is_long_term ? " -" : h.days_until_long_term != null ? `${h.days_until_long_term}d` : " -"}
      </td>
    </tr>
  );
}


function MobileTaxCard({ holding: h }: { holding: TaxHolding }) {
  return (
    <div className="bg-zinc-800/30 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{h.ticker}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            h.is_long_term ? "bg-gain/15 text-gain" : "bg-amber-500/15 text-amber-400"
          }`}>
            {h.is_long_term ? "LTCG" : "STCG"}
          </span>
        </div>
        <span className={`text-sm font-bold tabular ${h.unrealized_gain >= 0 ? "text-gain" : "text-loss"}`}>
          {h.unrealized_gain >= 0 ? "+" : ""}{formatCurrency(h.unrealized_gain)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <span>Cost: {formatCurrency(h.total_cost)}</span>
        <span>Now: {formatCurrency(h.market_value)}</span>
        {h.days_held != null && <span>{h.days_held}d held</span>}
        {!h.is_long_term && h.days_until_long_term != null && (
          <span className="text-amber-400">{h.days_until_long_term}d to LTCG</span>
        )}
      </div>
    </div>
  );
}
