"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  Shield,
  Wallet,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import type { Holding } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Asset type classification ────────────────────────────────────────

type TaxEfficiency = "tax-inefficient" | "tax-efficient" | "tax-neutral";
type RecommendedAccount = "tax-advantaged" | "taxable" | "either";

interface AssetClassification {
  ticker: string;
  taxEfficiency: TaxEfficiency;
  recommendedAccount: RecommendedAccount;
  reason: string;
  currentAccount: string; // placeholder — user's portfolio has account_type
  marketValue: number;
  dividendYield: number | null;
}

// ── Heuristic classification ─────────────────────────────────────────
// In a real app, this would use actual asset metadata (fund type, turnover, etc.)
// Here we use ticker patterns and dividend yield as heuristics

function classifyHolding(h: Holding): AssetClassification {
  const ticker = h.ticker.toUpperCase();
  const mv = Number(h.market_value) || 0;
  const dy = h.unrealized_pnl_pct; // using as proxy; real app would have div yield

  // Bond ETFs/funds
  if (["AGG", "BND", "TLT", "IEF", "SHY", "VCIT", "LQD", "HYG", "TIP", "TIPS"].some((t) => ticker.includes(t))) {
    return {
      ticker, taxEfficiency: "tax-inefficient", recommendedAccount: "tax-advantaged",
      reason: "Bond interest is taxed as ordinary income. Placing in a tax-advantaged account avoids this.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // REITs
  if (["VNQ", "SCHH", "IYR", "XLRE", "RWR", "REIT"].some((t) => ticker.includes(t))) {
    return {
      ticker, taxEfficiency: "tax-inefficient", recommendedAccount: "tax-advantaged",
      reason: "REIT dividends are taxed as ordinary income (no qualified dividend treatment).",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // High-dividend stocks/ETFs
  if (["SCHD", "VYM", "DVY", "HDV", "SPYD", "SPHD"].some((t) => ticker.includes(t))) {
    return {
      ticker, taxEfficiency: "tax-neutral", recommendedAccount: "either",
      reason: "Qualified dividends get preferential tax rates, but high-yield positions may benefit from tax-advantaged accounts.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // International stocks/ETFs (foreign tax credit consideration)
  if (["VXUS", "VEA", "VWO", "IEFA", "EEM", "IXUS", "EFA"].some((t) => ticker.includes(t))) {
    return {
      ticker, taxEfficiency: "tax-efficient", recommendedAccount: "taxable",
      reason: "International stocks in taxable accounts let you claim the foreign tax credit, which is lost in tax-advantaged accounts.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // Growth / low-dividend ETFs
  if (["VOO", "VTI", "SPY", "QQQ", "IVV", "VUG", "SCHG", "VGT", "IWF"].some((t) => ticker.includes(t))) {
    return {
      ticker, taxEfficiency: "tax-efficient", recommendedAccount: "taxable",
      reason: "Index funds with low turnover and qualified dividends are tax-efficient in taxable accounts.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // Individual stocks — generally tax-efficient in taxable
  return {
    ticker, taxEfficiency: "tax-efficient", recommendedAccount: "taxable",
    reason: "Individual stocks can benefit from tax-loss harvesting and long-term capital gains rates in taxable accounts.",
    currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
  };
}

// ── Colors ───────────────────────────────────────────────────────────

const EFFICIENCY_COLORS: Record<TaxEfficiency, { text: string; bg: string; border: string }> = {
  "tax-inefficient": { text: "text-loss", bg: "bg-loss/10", border: "border-loss/20" },
  "tax-efficient": { text: "text-gain", bg: "bg-gain/10", border: "border-gain/20" },
  "tax-neutral": { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
};

const ACCOUNT_ICONS: Record<RecommendedAccount, typeof Building2> = {
  "tax-advantaged": Shield,
  "taxable": Wallet,
  "either": MapPin,
};

// ── Main page ────────────────────────────────────────────────────────

export default function AssetLocationPage() {
  const { summary, loading, hasHoldings } = useDefaultPortfolio();

  const classifications = useMemo(() => {
    if (!summary) return [];
    return summary.holdings.map(classifyHolding).sort((a, b) => {
      const order: Record<RecommendedAccount, number> = { "tax-advantaged": 0, either: 1, taxable: 2 };
      return order[a.recommendedAccount] - order[b.recommendedAccount];
    });
  }, [summary]);

  const groups = useMemo(() => {
    const taxAdv = classifications.filter((c) => c.recommendedAccount === "tax-advantaged");
    const taxable = classifications.filter((c) => c.recommendedAccount === "taxable");
    const either = classifications.filter((c) => c.recommendedAccount === "either");
    return { taxAdv, taxable, either };
  }, [classifications]);

  const totalValue = classifications.reduce((s, c) => s + c.marketValue, 0);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-blue-400" />
          Asset Location
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Optimize which holdings go in tax-advantaged vs taxable accounts
        </p>
      </div>

      {!hasHoldings ? (
        <div className="vela-card text-center py-16 space-y-4">
          <MapPin className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No holdings to analyze</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Add trades to your portfolio to get asset location recommendations.
            </p>
          </div>
          <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
            Go to Portfolio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <FloatingCard glowColor="rgba(59, 130, 246, 0.10)" tilt={false}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: "Tax-Advantaged", desc: "401(k), IRA, HSA", items: groups.taxAdv, icon: Shield, color: "text-blue-400" },
                { label: "Taxable", desc: "Brokerage accounts", items: groups.taxable, icon: Wallet, color: "text-gain" },
                { label: "Either", desc: "Flexible placement", items: groups.either, icon: MapPin, color: "text-amber-400" },
              ].map((g) => {
                const value = g.items.reduce((s, c) => s + c.marketValue, 0);
                const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
                return (
                  <div key={g.label} className="text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                      <g.icon className={`w-4 h-4 ${g.color}`} />
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">{g.label}</p>
                    </div>
                    <p className={`text-xl font-display font-bold tabular-nums ${g.color}`}>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)}
                    </p>
                    <p className="text-xs text-zinc-600">{g.items.length} holdings · {pct.toFixed(0)}%</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{g.desc}</p>
                  </div>
                );
              })}
            </div>
          </FloatingCard>

          {/* Allocation bar */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Recommended Split</h2>
              <div className="flex h-4 rounded-full overflow-hidden">
                {groups.taxAdv.length > 0 && (
                  <div
                    className="bg-blue-500 transition-all duration-700"
                    style={{ width: `${(groups.taxAdv.reduce((s, c) => s + c.marketValue, 0) / totalValue) * 100}%` }}
                  />
                )}
                {groups.either.length > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-700"
                    style={{ width: `${(groups.either.reduce((s, c) => s + c.marketValue, 0) / totalValue) * 100}%` }}
                  />
                )}
                {groups.taxable.length > 0 && (
                  <div
                    className="bg-gain transition-all duration-700"
                    style={{ width: `${(groups.taxable.reduce((s, c) => s + c.marketValue, 0) / totalValue) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-6 mt-2 text-xs text-zinc-500 justify-center">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-blue-500 rounded" /> Tax-Advantaged</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-amber-500 rounded" /> Either</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-gain rounded" /> Taxable</span>
              </div>
            </div>
          </RevealOnScroll>

          {/* Detailed recommendations */}
          <RevealOnScroll delay={0.05}>
            <div className="space-y-6">
              {([
                { label: "Place in Tax-Advantaged Accounts", items: groups.taxAdv, color: "border-blue-500/20", icon: Shield, iconColor: "text-blue-400" },
                { label: "Place in Taxable Accounts", items: groups.taxable, color: "border-gain/20", icon: Wallet, iconColor: "text-gain" },
                { label: "Flexible Placement", items: groups.either, color: "border-amber-400/20", icon: MapPin, iconColor: "text-amber-400" },
              ] as const).map((section) => section.items.length > 0 && (
                <div key={section.label} className={`vela-card border-l-2 ${section.color}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <section.icon className={`w-4 h-4 ${section.iconColor}`} />
                    <h2 className="text-sm font-medium text-zinc-200">{section.label}</h2>
                    <span className="text-xs text-zinc-600 ml-auto">{section.items.length} holdings</span>
                  </div>
                  <div className="space-y-3">
                    {section.items.map((c) => {
                      const eff = EFFICIENCY_COLORS[c.taxEfficiency];
                      return (
                        <div key={c.ticker} className="flex items-start gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                          <span className="w-14 text-sm font-mono font-medium text-zinc-200 mt-0.5">{c.ticker}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${eff.bg} ${eff.text} ${eff.border}`}>
                                {c.taxEfficiency.replace("-", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed">{c.reason}</p>
                          </div>
                          <span className="text-sm font-medium text-zinc-300 tabular-nums shrink-0">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c.marketValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </RevealOnScroll>

          {/* Educational notes */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card space-y-2">
              <h2 className="section-heading mb-3">Key Principles</h2>
              {[
                { icon: Shield, color: "text-blue-400 border-blue-400/20 bg-blue-400/5", text: "Tax-advantaged accounts (401k, IRA, HSA) shelter income from immediate taxation. Put your least tax-efficient holdings here." },
                { icon: Wallet, color: "text-gain border-gain/20 bg-gain/5", text: "Taxable accounts allow tax-loss harvesting and qualify for long-term capital gains rates. Keep tax-efficient holdings here." },
                { icon: Info, color: "text-teal-400 border-teal-400/20 bg-teal-400/5", text: "International stocks in taxable accounts let you claim the foreign tax credit on dividends. This benefit is lost in tax-advantaged accounts." },
                { icon: AlertTriangle, color: "text-amber-400 border-amber-400/20 bg-amber-400/5", text: "These are general guidelines. Your specific tax situation, contribution limits, and investment goals should inform final placement." },
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
