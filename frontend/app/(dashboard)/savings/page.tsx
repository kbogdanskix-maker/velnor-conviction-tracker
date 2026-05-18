"use client";

import { useState, useMemo } from "react";
import {
  PiggyBank, ExternalLink, ArrowUpRight, Info, TrendingUp, DollarSign,
  Shield, Clock, Star, Lightbulb, BookOpen, AlertTriangle,
  Smartphone, CreditCard, Globe, Banknote, Filter, X,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";

// ── Rate data — sourced from Bankrate / NerdWallet / Fortune, March 2026 ──

interface SavingsProduct {
  id: string;
  name: string;
  institution: string;
  type: "hysa" | "cd";
  apy: number;
  minDeposit: number;
  term?: number; // months, for CDs
  fdic: boolean;
  notes?: string;
  // Bank details
  monthlyFee: number;
  feeWaiver?: string;
  mobileApp: number | null;    // 1–5 rating, null = unknown
  atmAccess: boolean;
  earlyWithdrawalPenalty?: string; // for CDs
  compounding: string;            // "daily", "monthly"
  maxTransfers?: number;           // monthly transfer limit
  features: string[];              // tags: "no-min", "joint-accounts", "sub-accounts", "round-ups", etc.
  website?: string;
}

const PRODUCTS: SavingsProduct[] = [
  // High-Yield Savings Accounts
  {
    id: "varo", name: "Varo Savings", institution: "Varo Bank", type: "hysa",
    apy: 5.0, minDeposit: 0, fdic: true,
    notes: "5.00% on balances up to $5K with qualifying direct deposit ($1K+/mo). 3.00% otherwise.",
    monthlyFee: 0, mobileApp: 4.6, atmAccess: true, compounding: "daily",
    features: ["no-min", "no-fees", "mobile-first", "round-ups"],
    website: "https://varomoney.com",
  },
  {
    id: "wealthfront", name: "Cash Account", institution: "Wealthfront", type: "hysa",
    apy: 4.20, minDeposit: 0, fdic: true,
    notes: "FDIC insured up to $8M through partner banks. No direct deposit required.",
    monthlyFee: 0, mobileApp: 4.8, atmAccess: false, compounding: "daily",
    features: ["no-min", "no-fees", "high-fdic", "autopilot"],
    website: "https://wealthfront.com",
  },
  {
    id: "axos", name: "ONE Savings", institution: "Axos Bank", type: "hysa",
    apy: 4.21, minDeposit: 0, fdic: true,
    notes: "4.21% on first $500K. Full online bank with checking + savings.",
    monthlyFee: 0, mobileApp: 4.5, atmAccess: true, compounding: "daily",
    features: ["no-min", "no-fees", "checking-combo"],
    website: "https://axosbank.com",
  },
  {
    id: "newtek", name: "Personal High Yield", institution: "Newtek Bank", type: "hysa",
    apy: 4.20, minDeposit: 0, fdic: true,
    notes: "Currently waitlisted for new accounts.",
    monthlyFee: 0, mobileApp: 3.2, atmAccess: false, compounding: "daily",
    features: ["no-min", "no-fees"],
    website: "https://newtekbank.com",
  },
  {
    id: "sofi", name: "Savings", institution: "SoFi", type: "hysa",
    apy: 4.00, minDeposit: 0, fdic: true,
    notes: "4.00% APY with qualifying direct deposit ($500+/mo). 1.20% otherwise.",
    monthlyFee: 0, mobileApp: 4.7, atmAccess: true, compounding: "daily",
    maxTransfers: 6,
    features: ["no-min", "no-fees", "checking-combo", "round-ups", "cashback"],
    website: "https://sofi.com",
  },
  {
    id: "valley", name: "High Yield Savings", institution: "Valley Direct", type: "hysa",
    apy: 4.00, minDeposit: 0, fdic: true,
    monthlyFee: 0, mobileApp: 3.8, atmAccess: false, compounding: "daily",
    features: ["no-min", "no-fees"],
    website: "https://valleydirect.com",
  },
  {
    id: "openbank", name: "High Yield Savings", institution: "Openbank", type: "hysa",
    apy: 4.10, minDeposit: 500, fdic: true,
    notes: "Santander digital subsidiary. $500 minimum to open.",
    monthlyFee: 0, mobileApp: 4.3, atmAccess: false, compounding: "daily",
    features: ["no-fees", "sub-accounts"],
    website: "https://openbank.com",
  },
  {
    id: "barclays", name: "Online Savings", institution: "Barclays", type: "hysa",
    apy: 3.70, minDeposit: 0, fdic: true,
    notes: "Tiered: 3.85% on balances ≥$250K, 3.70% below.",
    monthlyFee: 0, mobileApp: 4.4, atmAccess: false, compounding: "daily",
    features: ["no-min", "no-fees", "tiered-rates"],
    website: "https://banking.barclaysus.com",
  },
  // CDs
  {
    id: "cd_marcus_3", name: "3-Month CD", institution: "Marcus (Goldman Sachs)", type: "cd",
    apy: 4.30, minDeposit: 500, fdic: true, term: 3,
    earlyWithdrawalPenalty: "90 days of interest",
    monthlyFee: 0, mobileApp: 4.6, atmAccess: false, compounding: "daily",
    features: ["no-fees"],
    website: "https://marcus.com",
  },
  {
    id: "cd_ally_6", name: "6-Month High Yield CD", institution: "Ally Bank", type: "cd",
    apy: 4.25, minDeposit: 0, fdic: true, term: 6,
    earlyWithdrawalPenalty: "60 days of interest",
    monthlyFee: 0, mobileApp: 4.7, atmAccess: true, compounding: "daily",
    features: ["no-min", "no-fees", "checking-combo"],
    website: "https://ally.com",
  },
  {
    id: "cd_discover_12", name: "12-Month CD", institution: "Discover Bank", type: "cd",
    apy: 4.15, minDeposit: 2500, fdic: true, term: 12,
    earlyWithdrawalPenalty: "6 months of interest",
    monthlyFee: 0, mobileApp: 4.5, atmAccess: true, compounding: "daily",
    features: ["no-fees", "cashback"],
    website: "https://discover.com",
  },
  {
    id: "cd_capital_18", name: "18-Month CD", institution: "Capital One", type: "cd",
    apy: 4.00, minDeposit: 0, fdic: true, term: 18,
    earlyWithdrawalPenalty: "6 months of interest",
    monthlyFee: 0, mobileApp: 4.6, atmAccess: true, compounding: "monthly",
    features: ["no-min", "no-fees", "checking-combo"],
    website: "https://capitalone.com",
  },
  {
    id: "cd_synchrony_24", name: "24-Month CD", institution: "Synchrony Bank", type: "cd",
    apy: 3.85, minDeposit: 0, fdic: true, term: 24,
    earlyWithdrawalPenalty: "180 days of interest",
    monthlyFee: 0, mobileApp: 4.3, atmAccess: true, compounding: "daily",
    features: ["no-min", "no-fees"],
    website: "https://synchronybank.com",
  },
];

const NATIONAL_AVG_SAVINGS = 0.39; // FDIC national average

// ── Filter types ─────────────────────────────────────────────────────────

type AccountFilter = "all" | "hysa" | "cd";
type FeatureFilter = "no-min" | "atm" | "mobile-4.5+" | "checking-combo" | "round-ups";

const FEATURE_FILTERS: { value: FeatureFilter; label: string; icon: React.ReactNode }[] = [
  { value: "no-min", label: "No minimum", icon: <DollarSign className="w-3 h-3" /> },
  { value: "atm", label: "ATM access", icon: <CreditCard className="w-3 h-3" /> },
  { value: "mobile-4.5+", label: "Top app (4.5+)", icon: <Smartphone className="w-3 h-3" /> },
  { value: "checking-combo", label: "Has checking", icon: <Banknote className="w-3 h-3" /> },
  { value: "round-ups", label: "Round-ups", icon: <ArrowUpRight className="w-3 h-3" /> },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function SavingsFinderPage() {
  const { summary: cfSummary, error: cfError } = useCashFlowSummary();
  const { summary: nwSummary, error: nwError } = useNetWorthSummary();

  const [filter, setFilter] = useState<AccountFilter>("all");
  const [activeFeatures, setActiveFeatures] = useState<Set<FeatureFilter>>(new Set());
  const [depositAmount, setDepositAmount] = useState(10000);
  const [timeHorizon, setTimeHorizon] = useState(12);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const monthlySavings = cfSummary?.savings ?? 0;

  const toggleFeature = (f: FeatureFilter) => {
    setActiveFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...PRODUCTS];
    if (filter === "hysa") list = list.filter((p) => p.type === "hysa");
    if (filter === "cd") list = list.filter((p) => p.type === "cd");

    // Apply feature filters
    if (activeFeatures.has("no-min")) list = list.filter((p) => p.minDeposit === 0);
    if (activeFeatures.has("atm")) list = list.filter((p) => p.atmAccess);
    if (activeFeatures.has("mobile-4.5+")) list = list.filter((p) => p.mobileApp != null && p.mobileApp >= 4.5);
    if (activeFeatures.has("checking-combo")) list = list.filter((p) => p.features.includes("checking-combo"));
    if (activeFeatures.has("round-ups")) list = list.filter((p) => p.features.includes("round-ups"));

    return list.sort((a, b) => b.apy - a.apy);
  }, [filter, activeFeatures]);

  function computeEarnings(apy: number, principal: number, months: number): number {
    const monthlyRate = Math.pow(1 + apy / 100, 1 / 12) - 1;
    return principal * (Math.pow(1 + monthlyRate, months) - 1);
  }

  const bestApy = filtered.length > 0 ? filtered[0].apy : 0;
  const nationalEarnings = computeEarnings(NATIONAL_AVG_SAVINGS, depositAmount, timeHorizon);
  const bestEarnings = computeEarnings(bestApy, depositAmount, timeHorizon);
  const opportunityCost = bestEarnings - nationalEarnings;

  if (cfError || nwError) return <ErrorState message="Failed to load savings data." onRetry={() => window.location.reload()} />;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <PiggyBank className="w-6 h-6 text-vela-teal" />
          Savings Finder
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Compare high-yield savings accounts &amp; CDs — stop losing money to low rates
        </p>
      </div>

      {/* Opportunity cost banner */}
      <div className="vela-card border-vela-teal/30 bg-gradient-to-r from-vela-teal/5 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              You could be earning
            </p>
            <p className="text-2xl font-bold text-gain tabular">
              {formatCurrency(opportunityCost)}
              <span className="text-sm font-normal text-zinc-400"> more </span>
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              over {timeHorizon} months on {formatCurrency(depositAmount)} vs. the national average ({NATIONAL_AVG_SAVINGS}% APY)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-zinc-800 px-3 py-2 rounded-lg">
              <span className="text-zinc-400">Best rate:</span>
              <span className="text-gain font-bold tabular">{bestApy.toFixed(2)}% APY</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 px-3 py-2 rounded-lg">
              <span className="text-zinc-400">Nat. avg:</span>
              <span className="text-zinc-300 tabular">{NATIONAL_AVG_SAVINGS}% APY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          {/* Type filter */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Account type</p>
            <div className="flex gap-1">
              {(["all", "hysa", "cd"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === t
                      ? "bg-vela-teal/15 text-vela-teal"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t === "all" ? "All" : t === "hysa" ? "Savings" : "CDs"}
                </button>
              ))}
            </div>
          </div>

          {/* Deposit amount */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Deposit amount</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
              step={1000}
              min={0}
              className="input-field w-40 tabular"
            />
          </div>

          {/* Time horizon */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Time horizon (months)</label>
            <input
              type="number"
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(Math.max(1, Math.min(60, Number(e.target.value))))}
              min={1}
              max={60}
              className="input-field w-28 tabular"
            />
          </div>

          {/* Auto-fill */}
          {monthlySavings > 0 && (
            <button
              onClick={() => setDepositAmount(Math.round(monthlySavings * 6))}
              className="text-xs text-vela-teal hover:text-vela-teal/80 transition-colors whitespace-nowrap pb-2"
            >
              Use 6 months savings ({formatCurrency(monthlySavings * 6)})
            </button>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors pb-2 sm:pb-[7px] ${
              activeFeatures.size > 0
                ? "bg-vela-teal/15 text-vela-teal"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters{activeFeatures.size > 0 ? ` (${activeFeatures.size})` : ""}
          </button>
        </div>

        {/* Feature filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {FEATURE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => toggleFeature(f.value)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeFeatures.has(f.value)
                    ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-transparent"
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            {activeFeatures.size > 0 && (
              <button
                onClick={() => setActiveFeatures(new Set())}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 px-2 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      {(activeFeatures.size > 0 || filter !== "all") && (
        <p className="text-xs text-zinc-500">
          {filtered.length} {filtered.length === 1 ? "account" : "accounts"} match your filters
        </p>
      )}

      {/* Product cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="vela-card text-center py-8">
            <p className="text-sm text-zinc-400">No accounts match your filters.</p>
            <p className="text-xs text-zinc-600 mt-1">Try relaxing some filters to see more options.</p>
          </div>
        ) : (
          filtered.map((product, i) => {
            const earnings = computeEarnings(product.apy, depositAmount, product.term ?? timeHorizon);
            const effectiveMonths = product.term ?? timeHorizon;
            const isBest = i === 0;
            const isExpanded = expandedId === product.id;

            return (
              <div
                key={product.id}
                className={`vela-card transition-colors ${isBest ? "border-vela-teal/30" : ""}`}
              >
                {/* Main row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : product.id)}
                >
                  {/* Left: institution + product info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isBest ? "bg-vela-teal/15" : "bg-zinc-800"
                    }`}>
                      {product.type === "hysa" ? (
                        <PiggyBank className={`w-5 h-5 ${isBest ? "text-vela-teal" : "text-zinc-500"}`} />
                      ) : (
                        <Clock className={`w-5 h-5 ${isBest ? "text-vela-teal" : "text-zinc-500"}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {product.institution}
                        </p>
                        {isBest && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-vela-teal bg-vela-teal/10 px-1.5 py-0.5 rounded shrink-0">
                            <Star className="w-2.5 h-2.5" /> Best rate
                          </span>
                        )}
                        {product.fdic && (
                          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
                            <Shield className="w-2.5 h-2.5" /> FDIC
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {product.name}
                        {product.term ? ` · ${product.term}mo term` : ""}
                        {product.minDeposit > 0 ? ` · ${formatCurrency(product.minDeposit)} min` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Right: APY + projected earnings */}
                  <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                    <div className="text-right">
                      <p className={`text-lg font-bold tabular ${isBest ? "text-gain" : "text-zinc-200"}`}>
                        {product.apy.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">APY</p>
                    </div>
                    <div className="text-right min-w-[90px]">
                      <p className="text-sm font-semibold text-gain tabular">
                        +{formatCurrency(earnings)}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        earned in {effectiveMonths}mo
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-vela-border space-y-3">
                    {/* Notes */}
                    {product.notes && (
                      <p className="text-xs text-zinc-400 leading-relaxed">{product.notes}</p>
                    )}

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <DetailItem label="Monthly fee" value={product.monthlyFee === 0 ? "None" : `$${product.monthlyFee}`} good={product.monthlyFee === 0} />
                      <DetailItem label="Min deposit" value={product.minDeposit === 0 ? "None" : formatCurrency(product.minDeposit)} good={product.minDeposit === 0} />
                      <DetailItem label="Compounding" value={product.compounding === "daily" ? "Daily" : "Monthly"} good={product.compounding === "daily"} />
                      <DetailItem label="ATM access" value={product.atmAccess ? "Yes" : "No"} good={product.atmAccess} />
                      {product.mobileApp != null && (
                        <DetailItem
                          label="Mobile app"
                          value={`${product.mobileApp.toFixed(1)} / 5.0`}
                          good={product.mobileApp >= 4.5}
                        />
                      )}
                      {product.maxTransfers != null && (
                        <DetailItem label="Monthly transfers" value={`${product.maxTransfers}/mo`} />
                      )}
                      {product.earlyWithdrawalPenalty && (
                        <DetailItem label="Early withdrawal" value={product.earlyWithdrawalPenalty} />
                      )}
                    </div>

                    {/* Feature tags */}
                    {product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {product.features.map((f) => (
                          <span
                            key={f}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400"
                          >
                            {featureLabel(f)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Website link */}
                    {product.website && (
                      <a
                        href={product.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-vela-teal hover:text-vela-teal/80 transition-colors"
                      >
                        <Globe className="w-3 h-3" />
                        Visit {product.institution}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Insights */}
      <SavingsInsights
        depositAmount={depositAmount}
        timeHorizon={timeHorizon}
        bestApy={bestApy}
        opportunityCost={opportunityCost}
        monthlySavings={monthlySavings}
        monthlyExpenses={cfSummary?.total_expenses ?? 0}
      />
    </PageTransition>
    </TierGate>
  );
}


// ── Detail Item ──────────────────────────────────────────────────────────

function DetailItem({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-medium mt-0.5 ${good === true ? "text-gain" : good === false ? "text-zinc-400" : "text-zinc-300"}`}>
        {value}
      </p>
    </div>
  );
}

// ── Feature label mapping ───────────────────────────────────────────────

function featureLabel(f: string): string {
  const map: Record<string, string> = {
    "no-min": "No minimum",
    "no-fees": "No fees",
    "mobile-first": "Mobile-first",
    "round-ups": "Round-ups",
    "checking-combo": "Checking + Savings",
    "sub-accounts": "Sub-accounts",
    "autopilot": "Auto-invest",
    "high-fdic": "FDIC up to $8M",
    "tiered-rates": "Tiered rates",
    "cashback": "Cashback debit",
    "joint-accounts": "Joint accounts",
  };
  return map[f] ?? f;
}


// ── Dynamic insight panel ───────────────────────────────────────────────────

function SavingsInsights({
  depositAmount, timeHorizon, bestApy, opportunityCost, monthlySavings, monthlyExpenses,
}: {
  depositAmount: number;
  timeHorizon: number;
  bestApy: number;
  opportunityCost: number;
  monthlySavings: number;
  monthlyExpenses: number;
}) {
  const emergencyMonths = monthlyExpenses > 0 ? depositAmount / monthlyExpenses : 0;
  const insights: { icon: React.ReactNode; title: string; body: string; color: string }[] = [];

  if (monthlyExpenses > 0) {
    if (emergencyMonths < 3) {
      insights.push({
        icon: <AlertTriangle className="w-4 h-4" />,
        title: `${emergencyMonths.toFixed(1)} months of expenses covered — target is 3-6`,
        body: `At ${formatCurrency(monthlyExpenses)}/mo, you'd need ${formatCurrency(monthlyExpenses * 3)}-${formatCurrency(monthlyExpenses * 6)} `
          + `for a proper emergency fund. A HYSA keeps it liquid and earning ~4%+ instead of 0.39%.`,
        color: "text-amber-400",
      });
    } else if (emergencyMonths >= 3 && emergencyMonths <= 6) {
      insights.push({
        icon: <Lightbulb className="w-4 h-4" />,
        title: `${emergencyMonths.toFixed(1)} months covered — solid range`,
        body: `Within the 3-6 month target. Keep this in a HYSA — liquid, FDIC-insured, earning real yield. `
          + `Excess beyond 6 months could go into index funds for better long-term returns.`,
        color: "text-zinc-400",
      });
    } else {
      insights.push({
        icon: <BookOpen className="w-4 h-4" />,
        title: `${emergencyMonths.toFixed(1)} months — more than you need here`,
        body: `6 months (${formatCurrency(monthlyExpenses * 6)}) in a HYSA is plenty for emergencies. `
          + `The rest earns ~4% here vs ~8% in index funds — that gap compounds fast over a decade.`,
        color: "text-zinc-400",
      });
    }
  }

  insights.push({
    icon: <Lightbulb className="w-4 h-4" />,
    title: "HYSA vs. CD",
    body: `HYSA: fully liquid, no penalties — use for emergency fund. `
      + `CD: locks in today's rate for a fixed term. Worth it if you expect rates to drop further. `
      + `Both offer similar APYs right now.`,
    color: "text-zinc-400",
  });

  insights.push({
    icon: <BookOpen className="w-4 h-4" />,
    title: "Rate direction",
    body: `Fed funds at 3.50-3.75% after three 2025 cuts. More cuts likely mean savings rates keep falling. `
      + `HYSA rates peaked at ~5.5% in late 2023. Locking in now beats waiting.`,
    color: "text-zinc-400",
  });

  if (opportunityCost > 50) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      title: `${formatCurrency(opportunityCost)} left on the table`,
      body: `That's the difference between your current rate and the best available. `
        + `Opening a HYSA takes 10 minutes — no fees, no minimums, FDIC-insured to $250K. `
        + `Transfers take 1-2 business days.`,
      color: "text-zinc-400",
    });
  }

  return (
    <div className="vela-card bg-zinc-900/50 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-vela-teal" />
        What this means for you
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 ${insight.color}`}>{insight.icon}</div>
            <div>
              <p className="text-xs font-medium text-zinc-300">{insight.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 pt-2 border-t border-vela-border text-[10px] text-zinc-600">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Rates as of March 2026. All accounts FDIC-insured up to $250,000 unless noted. Earnings are projections — actual returns may vary. Not financial advice.
        </span>
      </div>
    </div>
  );
}
