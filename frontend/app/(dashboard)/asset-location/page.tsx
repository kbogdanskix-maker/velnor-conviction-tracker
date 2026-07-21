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
import { useProfile } from "@/hooks/useProfile";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Asset type classification ────────────────────────────────────────

type TaxEfficiency = "tax-inefficient" | "tax-efficient" | "tax-neutral";
type ShelterSensitivity = "income-heavy" | "growth-heavy" | "either";

interface AssetClassification {
  ticker: string;
  taxEfficiency: TaxEfficiency;
  shelterSensitivity: ShelterSensitivity;
  reason: string;
  category: string;
  description: string; // plain-English one-liner for beginners
  estimatedYield: number | null; // for tax drag calc
  currentAccount: string;
  marketValue: number;
  dividendYield: number | null;
}

// Annual tax drag if a tax-inefficient asset sits in a taxable account.
// Uses the user's marginal tax rate as the differential (ordinary income vs 0% in IRA).
function taxDragEstimate(mv: number, yield_: number, marginalRate: number): number {
  return mv * yield_ * marginalRate;
}

// ── Heuristic classification ─────────────────────────────────────────
// In a real app, this would use actual asset metadata (fund type, turnover, etc.)
// Here we use ticker patterns and dividend yield as heuristics

function classifyHolding(h: Holding): AssetClassification {
  const ticker = h.ticker.toUpperCase();
  const mv = Number(h.market_value) || 0;
  const assetType = (h.asset_type || "stock").toLowerCase();

  // ── Use asset_type set at trade entry as primary signal ──────────────
  if (assetType === "bond_etf") {
    return {
      ticker, taxEfficiency: "tax-inefficient", shelterSensitivity: "income-heavy",
      category: "Bond ETF", estimatedYield: 0.035,
      description: "A fund holding bonds that pay regular interest income.",
      reason: "Bond interest is taxed as ordinary income. Placing in a tax-advantaged account avoids this.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (assetType === "reit") {
    return {
      ticker, taxEfficiency: "tax-inefficient", shelterSensitivity: "income-heavy",
      category: "REIT", estimatedYield: 0.035,
      description: "Owns real estate and must pay out 90%+ of income as dividends.",
      reason: "REIT dividends are taxed as ordinary income (no qualified dividend treatment).",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (assetType === "etf") {
    return {
      ticker, taxEfficiency: "tax-efficient", shelterSensitivity: "growth-heavy",
      category: "ETF", estimatedYield: null,
      description: "A basket of stocks or assets that trades like a single share.",
      reason: "Index/growth ETFs with low turnover are tax-efficient in taxable accounts.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (assetType === "crypto") {
    return {
      ticker, taxEfficiency: "tax-inefficient", shelterSensitivity: "income-heavy",
      category: "Crypto", estimatedYield: null,
      description: "Digital asset taxed as property. Every trade is a taxable event.",
      reason: "Crypto gains are taxed as property. Tax-advantaged accounts shelter frequent rebalancing.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  // ── Fallback for legacy "stock" entries: exact-ticker match against known
  // ETF lists. (Exact, not substring — substring false-matched real stocks,
  // e.g. SHYF→SHY, SPYG→SPY, QQQM→QQQ.) ─────────────────────────────────────
  if (["AGG", "BND", "TLT", "IEF", "SHY", "VCIT", "LQD", "HYG", "TIP", "TIPS"].includes(ticker)) {
    return {
      ticker, taxEfficiency: "tax-inefficient", shelterSensitivity: "income-heavy",
      category: "Bond ETF", estimatedYield: 0.035,
      description: "A fund holding bonds that pay regular interest income.",
      reason: "Bond interest is taxed as ordinary income. Placing in a tax-advantaged account avoids this.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (["VNQ", "SCHH", "IYR", "XLRE", "RWR"].includes(ticker)) {
    return {
      ticker, taxEfficiency: "tax-inefficient", shelterSensitivity: "income-heavy",
      category: "REIT ETF", estimatedYield: 0.035,
      description: "Owns real estate and must pay out 90%+ of income as dividends.",
      reason: "REIT dividends are taxed as ordinary income (no qualified dividend treatment).",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (["SCHD", "VYM", "DVY", "HDV", "SPYD", "SPHD"].includes(ticker)) {
    return {
      ticker, taxEfficiency: "tax-neutral", shelterSensitivity: "either",
      category: "Dividend ETF", estimatedYield: 0.03,
      description: "ETF focused on stocks that pay above-average dividends.",
      reason: "Qualified dividends get preferential tax rates, but high-yield positions may benefit from shelter.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (["VXUS", "VEA", "VWO", "IEFA", "EEM", "IXUS", "EFA"].includes(ticker)) {
    return {
      ticker, taxEfficiency: "tax-efficient", shelterSensitivity: "growth-heavy",
      category: "International ETF", estimatedYield: null,
      description: "Holds stocks from non-US markets. Earns a foreign tax credit in taxable accounts.",
      reason: "International stocks in taxable accounts let you claim the foreign tax credit.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  if (["VOO", "VTI", "SPY", "QQQ", "IVV", "VUG", "SCHG", "VGT", "IWF"].includes(ticker)) {
    return {
      ticker, taxEfficiency: "tax-efficient", shelterSensitivity: "growth-heavy",
      category: "Index / Growth ETF", estimatedYield: null,
      description: "Low-cost fund tracking a broad market index with minimal tax events.",
      reason: "Low turnover, qualified dividends. Tax-efficient in taxable accounts.",
      currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
    };
  }

  return {
    ticker, taxEfficiency: "tax-efficient", shelterSensitivity: "growth-heavy",
    category: "Individual Stock", estimatedYield: null,
    description: "Shares in a single company, eligible for tax-loss harvesting and long-term rates.",
    reason: "Individual stocks can benefit from tax-loss harvesting and long-term capital gains rates.",
    currentAccount: h.asset_type, marketValue: mv, dividendYield: null,
  };
}

// ── Colors ───────────────────────────────────────────────────────────

const EFFICIENCY_COLORS: Record<TaxEfficiency, { text: string; bg: string; border: string }> = {
  "tax-inefficient": { text: "text-loss", bg: "bg-loss/10", border: "border-loss/20" },
  "tax-efficient": { text: "text-gain", bg: "bg-gain/10", border: "border-gain/20" },
  "tax-neutral": { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
};

const ACCOUNT_ICONS: Record<ShelterSensitivity, typeof Building2> = {
  "income-heavy": Shield,
  "growth-heavy": Wallet,
  "either": MapPin,
};

// ── Main page ────────────────────────────────────────────────────────

export default function AssetLocationPage() {
  const { summary, loading, hasHoldings } = useDefaultPortfolio();
  const { profile } = useProfile();

  const classifications = useMemo(() => {
    if (!summary) return [];
    return summary.holdings.map(classifyHolding).sort((a, b) => {
      const order: Record<ShelterSensitivity, number> = { "income-heavy": 0, either: 1, "growth-heavy": 2 };
      return order[a.shelterSensitivity] - order[b.shelterSensitivity];
    });
  }, [summary]);

  const groups = useMemo(() => {
    const taxAdv = classifications.filter((c) => c.shelterSensitivity === "income-heavy");
    const taxable = classifications.filter((c) => c.shelterSensitivity === "growth-heavy");
    const either = classifications.filter((c) => c.shelterSensitivity === "either");
    return { taxAdv, taxable, either };
  }, [classifications]);

  const totalValue = classifications.reduce((s, c) => s + c.marketValue, 0);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-vela-teal" />
          Asset Location
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          How different asset types are commonly located across tax-advantaged and taxable accounts
        </p>
      </div>

      {!hasHoldings ? (
        <div className="vela-card text-center py-16 space-y-4">
          <MapPin className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No holdings to analyze</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Add trades to your portfolio to see how each asset type is commonly located across account types.
            </p>
          </div>
          <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
            Go to Portfolio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <FloatingCard glowColor="rgba(26, 168, 187, 0.10)" tilt={false}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: "Income-heavy", desc: "return arrives mostly as taxable income", items: groups.taxAdv, icon: Shield, color: "text-vela-teal" },
                { label: "Growth-heavy", desc: "return arrives mostly as deferred gains", items: groups.taxable, icon: Wallet, color: "text-vela-body" },
                { label: "Mixed", desc: "little difference either way", items: groups.either, icon: MapPin, color: "text-vela-muted" },
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
              <h2 className="section-heading mb-3">Split by Tax Treatment</h2>
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
                { label: "Often Held in Tax-Advantaged Accounts", items: groups.taxAdv, color: "border-blue-500/20", icon: Shield, iconColor: "text-vela-teal" },
                { label: "Often Held in Taxable Accounts", items: groups.taxable, color: "border-gain/20", icon: Wallet, iconColor: "text-gain" },
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${eff.bg} ${eff.text} ${eff.border}`}>
                                {c.taxEfficiency.replace(/-/g, " ")}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                {c.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">{c.description}</p>
                            {c.taxEfficiency === "tax-inefficient" && c.estimatedYield && (
                              <p className="text-[10px] text-amber-500/80 mt-1">
                                est. ~${Math.round(taxDragEstimate(c.marketValue, c.estimatedYield, profile.marginalTaxRate / 100)).toLocaleString()}/yr tax drag if held in taxable
                              </p>
                            )}
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
              <h2 className="section-heading mb-3">How account types are taxed</h2>
              {[
                { icon: Shield, color: "text-vela-teal border-vela-teal/20 bg-vela-teal/5", text: "Tax-advantaged accounts (401k, IRA, HSA) shelter income from immediate taxation, so the shelter is worth more the more of a return that arrives as taxable income." },
                { icon: Wallet, color: "text-gain border-gain/20 bg-gain/5", text: "Taxable accounts allow tax-loss harvesting and qualify for long-term capital gains rates, which matters more for returns that arrive as deferred gains than as income." },
                { icon: Info, color: "text-vela-teal border-vela-teal/20 bg-vela-teal/5", text: "International stocks in taxable accounts let you claim the foreign tax credit on dividends. This benefit is lost in tax-advantaged accounts." },
                { icon: AlertTriangle, color: "text-amber-400 border-amber-400/20 bg-amber-400/5", text: "These are general mechanics of how account types are taxed, not a plan for your holdings. Contribution limits, your own tax position and your goals all bear on placement, and a tax adviser is the person to weigh them." },
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
