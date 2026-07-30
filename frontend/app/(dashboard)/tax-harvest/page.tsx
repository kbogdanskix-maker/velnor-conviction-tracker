"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Scissors,
  ArrowRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import type { Holding } from "@/hooks/usePortfolio";
import { useProfile } from "@/hooks/useProfile";
import { exportCSV } from "@/lib/export";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

// ── Tax-loss harvesting analysis ─────────────────────────────────────

interface HarvestCandidate {
  ticker: string;
  unrealizedLoss: number;
  lossPct: number;
  totalCost: number;
  marketValue: number;
  quantity: number;
  taxSavingsUser: number; // at user's marginal rate
  taxSavings35: number;   // at 35% as high-bracket reference
  washSaleWarning: boolean;
  priority: "high" | "medium" | "low";
}

interface HarvestSummary {
  candidates: HarvestCandidate[];
  totalHarvestable: number;
  estimatedTaxSavingsUser: number;
  estimatedTaxSavings35: number;
  winners: { ticker: string; gain: number; gainPct: number }[];
  netPnl: number;
  offsetCapacity: number; // losses that can offset gains
  carryforward: number;   // excess after offsetting gains + $3K income
  marginalRate: number;   // rate used (decimal)
}

function analyzeHarvesting(holdings: Holding[], marginalRate: number): HarvestSummary {
  const losers: HarvestCandidate[] = [];
  const winners: { ticker: string; gain: number; gainPct: number }[] = [];
  let totalGains = 0;
  let totalLosses = 0;

  for (const h of holdings) {
    const pnl = h.unrealized_pnl ?? 0;
    const pnlPct = h.unrealized_pnl_pct ?? 0;
    const mv = Number(h.market_value) || 0;

    if (pnl < 0) {
      const loss = Math.abs(pnl);
      totalLosses += loss;

      let priority: "high" | "medium" | "low" = "low";
      if (pnlPct < -15) priority = "high";
      else if (pnlPct < -5) priority = "medium";

      losers.push({
        ticker: h.ticker,
        unrealizedLoss: loss,
        lossPct: pnlPct,
        totalCost: h.total_cost,
        marketValue: mv,
        quantity: h.quantity,
        taxSavingsUser: loss * marginalRate,
        taxSavings35: loss * 0.35,
        washSaleWarning: false, // would need transaction history to determine
        priority,
      });
    } else if (pnl > 0) {
      totalGains += pnl;
      winners.push({ ticker: h.ticker, gain: pnl, gainPct: pnlPct });
    }
  }

  // Sort by loss amount descending
  losers.sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);
  winners.sort((a, b) => b.gain - a.gain);

  // Capital loss can offset capital gains, plus $3K of ordinary income
  const offsetCapacity = Math.min(totalLosses, totalGains);
  const remainingLoss = totalLosses - offsetCapacity;
  const incomeOffset = Math.min(remainingLoss, 3000);
  const carryforward = remainingLoss - incomeOffset;

  return {
    candidates: losers,
    totalHarvestable: totalLosses,
    estimatedTaxSavingsUser: totalLosses * marginalRate,
    estimatedTaxSavings35: totalLosses * 0.35,
    winners,
    netPnl: totalGains - totalLosses,
    offsetCapacity,
    carryforward,
    marginalRate,
  };
}

// ── Priority badge ───────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-loss/15 text-loss border-loss/20",
    medium: "bg-amber-400/15 text-amber-400 border-amber-400/20",
    low: "bg-zinc-700/50 text-zinc-500 border-zinc-700",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyHarvest() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <Scissors className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">No holdings to analyze</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          Add trades to your portfolio to identify tax-loss harvesting opportunities.
        </p>
      </div>
      <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
        Go to Portfolio <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function TaxHarvestPage() {
  const { summary, loading, hasHoldings, error } = useDefaultPortfolio();
  const { profile } = useProfile();

  const marginalRate = profile.marginalTaxRate / 100;
  const rateLabel = `${profile.marginalTaxRate}%`;

  const harvest = useMemo(() => {
    if (!summary) return null;
    return analyzeHarvesting(summary.holdings, marginalRate);
  }, [summary, marginalRate]);

  if (error) return <ErrorState message="Failed to load portfolio data for tax harvesting." onRetry={() => window.location.reload()} />;
  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Scissors className="w-6 h-6 text-emerald-400" />
            Tax-Loss Harvesting
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Positions with unrealized losses, and the tax that harvesting them could offset
          </p>
        </div>
        {harvest && harvest.candidates.length > 0 && (
          <button
            onClick={() =>
              exportCSV(
                harvest.candidates.map((c) => ({
                  Ticker: c.ticker,
                  "Unrealized Loss": c.unrealizedLoss.toFixed(2),
                  "Loss %": c.lossPct.toFixed(2),
                  "Cost Basis": c.totalCost.toFixed(2),
                  "Market Value": c.marketValue.toFixed(2),
                  [`Tax Savings (${rateLabel})`]: c.taxSavingsUser.toFixed(2),
                  "Tax Savings (35%)": c.taxSavings35.toFixed(2),
                  Priority: c.priority,
                })),
                `vela-tax-harvest-${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {!hasHoldings || !harvest ? (
        <EmptyHarvest />
      ) : harvest.candidates.length === 0 ? (
        <div className="vela-card text-center py-12 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-gain mx-auto" />
          <h2 className="text-lg font-medium text-zinc-200">No losses to harvest</h2>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
            All your positions are in the green. Check back when markets pull back.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <FloatingCard glowColor="rgba(52, 211, 153, 0.10)" tilt={false}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-zinc-500">Harvestable Losses</p>
                <p className="text-xl font-display font-bold text-loss tabular-nums">
                  {formatCurrency(harvest.totalHarvestable)}
                </p>
                <p className="text-xs text-zinc-600">{harvest.candidates.length} position{harvest.candidates.length !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Potential Tax Savings</p>
                <p className="text-xl font-display font-bold text-gain tabular-nums">
                  {formatCurrency(harvest.estimatedTaxSavingsUser)}
                </p>
                <p className="text-xs text-zinc-600">at {rateLabel} bracket (your rate)</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Offset Capacity</p>
                <p className="text-xl font-display font-bold text-zinc-200 tabular-nums">
                  {formatCurrency(harvest.offsetCapacity)}
                </p>
                <p className="text-xs text-zinc-600">against realized gains</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Loss Carryforward</p>
                <p className="text-xl font-display font-bold text-zinc-200 tabular-nums">
                  {formatCurrency(harvest.carryforward)}
                </p>
                <p className="text-xs text-zinc-600">to future tax years</p>
              </div>
            </div>
          </FloatingCard>

          {/* Candidates table */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Harvesting Candidates</h2>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                      <th className="text-left py-2 pr-4 font-medium">Ticker</th>
                      <th className="text-right py-2 px-3 font-medium">Loss</th>
                      <th className="text-right py-2 px-3 font-medium">Loss %</th>
                      <th className="text-right py-2 px-3 font-medium">Cost Basis</th>
                      <th className="text-right py-2 px-3 font-medium">Mkt Value</th>
                      <th className="text-right py-2 px-3 font-medium">Tax Saved ({rateLabel})</th>
                      <th className="text-right py-2 px-3 font-medium">Tax Saved (35%)</th>
                      <th className="text-center py-2 pl-3 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {harvest.candidates.map((c) => (
                      <tr key={c.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 pr-4 font-mono font-medium text-zinc-200">{c.ticker}</td>
                        <td className="py-2.5 px-3 text-right text-loss tabular-nums">{formatCurrency(c.unrealizedLoss)}</td>
                        <td className="py-2.5 px-3 text-right text-loss tabular-nums">{formatPercent(c.lossPct)}</td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{formatCurrency(c.totalCost)}</td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{formatCurrency(c.marketValue)}</td>
                        <td className="py-2.5 px-3 text-right text-gain tabular-nums">{formatCurrency(c.taxSavingsUser)}</td>
                        <td className="py-2.5 px-3 text-right text-gain tabular-nums">{formatCurrency(c.taxSavings35)}</td>
                        <td className="py-2.5 pl-3 text-center"><PriorityBadge priority={c.priority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {harvest.candidates.map((c) => (
                  <div key={c.ticker} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-medium text-zinc-200">{c.ticker}</span>
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-zinc-500">Loss:</span> <span className="text-loss tabular-nums">{formatCurrency(c.unrealizedLoss)}</span></div>
                      <div><span className="text-zinc-500">Loss %:</span> <span className="text-loss tabular-nums">{formatPercent(c.lossPct)}</span></div>
                      <div><span className="text-zinc-500">Tax saved:</span> <span className="text-gain tabular-nums">{formatCurrency(c.taxSavingsUser)}</span></div>
                      <div><span className="text-zinc-500">Value:</span> <span className="text-zinc-400 tabular-nums">{formatCurrency(c.marketValue)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Gains to offset */}
          {harvest.winners.length > 0 && (
            <RevealOnScroll delay={0.05}>
              <div className="vela-card">
                <h2 className="section-heading mb-3">Realized Gains to Offset</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {harvest.winners.slice(0, 6).map((w) => (
                    <div key={w.ticker} className="bg-gain/5 rounded-lg border border-gain/15 p-3 text-center">
                      <p className="text-xs font-mono font-medium text-zinc-200">{w.ticker}</p>
                      <p className="text-sm font-bold text-gain tabular-nums mt-0.5">{formatCurrency(w.gain)}</p>
                      <p className="text-[10px] text-gain/60 tabular-nums">{formatPercent(w.gainPct)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          )}

          {/* Educational notes */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card space-y-2">
              <h2 className="section-heading mb-3">Important Notes</h2>
              {[
                { icon: AlertTriangle, color: "text-amber-400 border-amber-400/20 bg-amber-400/5", text: "Wash sale rule: You cannot repurchase the same or substantially identical security within 30 days before or after selling at a loss." },
                { icon: Info, color: "text-teal-400 border-teal-400/20 bg-teal-400/5", text: "Capital losses first offset capital gains. Excess losses can offset up to $3,000 of ordinary income per year, with the rest carried forward." },
                { icon: DollarSign, color: "text-teal-400 border-teal-400/20 bg-teal-400/5", text: "Tax savings are estimated. Your actual savings depend on your tax bracket, filing status, and other factors. Consult a tax professional." },
                { icon: TrendingDown, color: "text-zinc-400 border-zinc-700 bg-zinc-800/50", text: "Harvesting doesn't change your economic position - you're selling low and can reinvest. The benefit is purely from the tax deduction timing." },
              ].map((note, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-lg border ${note.color}`}>
                  <note.icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-zinc-300">{note.text}</p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </>
      )}
    </PageTransition>
  );
}
