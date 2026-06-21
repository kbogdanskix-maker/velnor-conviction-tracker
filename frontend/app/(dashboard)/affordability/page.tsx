"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calculator, Car, Home, Plane, GraduationCap, Package,
  TrendingDown, AlertTriangle, CheckCircle2, Plus, Loader2, Check,
} from "lucide-react";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useNetWorthAssets } from "@/hooks/useNetWorth";
import { useGoals, computeProjection, monthsUntil, type Goal } from "@/hooks/useGoals";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import PageTransition from "@/components/celestial/PageTransition";

// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { key: "car", label: "Car", icon: Car, price: 35000, down: 10, apr: 6.5, months: 60 },
  { key: "home", label: "Home", icon: Home, price: 350000, down: 20, apr: 6.8, months: 360 },
  { key: "vacation", label: "Vacation", icon: Plane, price: 5000, down: 100, apr: 0, months: 1 },
  { key: "education", label: "Education", icon: GraduationCap, price: 40000, down: 0, apr: 5.5, months: 120 },
  { key: "custom", label: "Custom", icon: Package, price: 0, down: 0, apr: 0, months: 12 },
] as const;

// ── Loan math ───────────────────────────────────────────────────────────────

function calcLoan(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return { monthly: 0, totalInterest: 0, totalCost: 0 };
  if (annualRate === 0) return { monthly: principal / months, totalInterest: 0, totalCost: principal };
  const r = annualRate / 100 / 12;
  const monthly = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const totalCost = monthly * months;
  return { monthly, totalInterest: totalCost - principal, totalCost };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AffordabilityPage() {
  const { summary: nw, mutate: mutateNW } = useNetWorthSummary();
  const { mutate: mutateAssets } = useNetWorthAssets();
  const { goals } = useGoals();

  const [addingLiability, setAddingLiability] = useState(false);
  const [addedLiability, setAddedLiability] = useState(false);

  // Form state
  const [itemName, setItemName] = useState("New Car");
  const [price, setPrice] = useState("35000");
  const [downPct, setDownPct] = useState("10");
  const [apr, setApr] = useState("6.5");
  const [termMonths, setTermMonths] = useState("60");

  const priceNum = Number(price) || 0;
  const downPctNum = Math.min(100, Math.max(0, Number(downPct) || 0));
  const downAmount = priceNum * (downPctNum / 100);
  const loanAmount = priceNum - downAmount;
  const aprNum = Number(apr) || 0;
  const termNum = Number(termMonths) || 1;

  const loan = useMemo(
    () => calcLoan(loanAmount, aprNum, termNum),
    [loanAmount, aprNum, termNum],
  );

  // Goal impact: how much does this monthly payment delay each goal?
  // Distribute the loan payment proportionally across goals based on each goal's share of total contributions
  const goalImpacts = useMemo(() => {
    if (!goals.length || loan.monthly <= 0) return [];

    const totalContribs = goals.reduce((s, g) => s + Number(g.monthly_contribution || 0), 0);

    return goals.map((g) => {
      const months = monthsUntil(g.target_date);
      if (months <= 0) return null;

      const contrib = Number(g.monthly_contribution);
      // Current projection
      const currentProj = computeProjection(
        Number(g.current_amount), contrib, Number(g.cagr), months,
      );
      const currentFinal = currentProj[currentProj.length - 1]?.value ?? 0;

      // Proportional reduction: this goal absorbs its share of the loan payment
      const share = totalContribs > 0 ? contrib / totalContribs : 1 / goals.length;
      const reduction = loan.monthly * share;
      const reducedContrib = Math.max(0, contrib - reduction);
      const reducedProj = computeProjection(
        Number(g.current_amount), reducedContrib, Number(g.cagr), months,
      );
      const reducedFinal = reducedProj[reducedProj.length - 1]?.value ?? 0;

      const shortfall = Number(g.target_amount) - reducedFinal;
      const wasOnTrack = currentFinal >= Number(g.target_amount);
      const nowOnTrack = reducedFinal >= Number(g.target_amount);

      // Estimate delay: how many extra months to reach target with reduced contribution
      let delayMonths = 0;
      if (wasOnTrack && !nowOnTrack && reducedContrib > 0) {
        // Binary search for months needed
        for (let m = months + 1; m <= months + 240; m++) {
          const p = computeProjection(Number(g.current_amount), reducedContrib, Number(g.cagr), m);
          if ((p[p.length - 1]?.value ?? 0) >= Number(g.target_amount)) {
            delayMonths = m - months;
            break;
          }
        }
        if (delayMonths === 0) delayMonths = -1; // unreachable
      }

      return {
        goal: g,
        currentFinal,
        reducedFinal,
        shortfall: Math.max(0, shortfall),
        wasOnTrack,
        nowOnTrack,
        delayMonths,
        reducedContrib,
      };
    }).filter(Boolean) as GoalImpact[];
  }, [goals, loan.monthly]);

  function applyPreset(preset: typeof PRESETS[number]) {
    setItemName(preset.label);
    setPrice(preset.price.toString());
    setDownPct(preset.down.toString());
    setApr(preset.apr.toString());
    setTermMonths(preset.months.toString());
    setAddedLiability(false);
  }

  async function handleAddToLiabilities() {
    if (loanAmount <= 0) return;
    setAddingLiability(true);
    try {
      // Determine category from preset
      const catMap: Record<string, string> = {
        Car: "auto_loan", Home: "mortgage", Education: "student_loan",
      };
      const category = catMap[itemName] ?? "personal_loan";

      await api.post("/net-worth/assets", {
        name: itemName,
        category,
        value: loanAmount,
        is_liability: true,
        interest_rate: aprNum || null,
        minimum_payment: loan.monthly || null,
        notes: `${formatCurrency(priceNum)} purchase, ${downPctNum}% down, ${termNum}mo term`,
        as_of_date: new Date().toISOString().slice(0, 10),
      });
      mutateNW();
      mutateAssets();
      setAddedLiability(true);
    } finally {
      setAddingLiability(false);
    }
  }

  // Net worth impact  - down payment converts cash → asset equity (net-neutral at purchase),
  // only interest paid over the loan's life is a true net worth reduction
  const nwImpact = nw ? {
    newLiability: loanAmount,
    downPaymentCash: downAmount,
    interestCost: loan.totalInterest,
    change: -loan.totalInterest,
  } : null;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-vela-teal" />
          Affordability Calculator
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          See how a purchase impacts your finances and goals
        </p>
      </div>

      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              itemName === p.label
                ? "bg-vela-teal/15 text-vela-teal"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <p.icon className="w-3.5 h-3.5" />
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="vela-card space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Purchase Details</h2>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">What are you buying?</label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Price</label>
              <input
                type="number"
                min="0"
                step="100"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-field w-full tabular"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Down payment %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={downPct}
                  onChange={(e) => setDownPct(e.target.value)}
                  className="input-field w-full tabular"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Down payment $</label>
                <p className="input-field w-full tabular bg-zinc-800/50 text-zinc-300 flex items-center">
                  {formatCurrency(downAmount)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Loan APR %</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={apr}
                  onChange={(e) => setApr(e.target.value)}
                  className="input-field w-full tabular"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Term (months)</label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  step="1"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="input-field w-full tabular"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* Loan Summary */}
          <div className="vela-card">
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Loan Breakdown</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-zinc-500">Monthly Payment</p>
                <AnimatedNumber value={loan.monthly} format={formatCurrency} duration={800} className="text-xl font-bold tabular text-zinc-100 block" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Interest</p>
                <AnimatedNumber value={loan.totalInterest} format={formatCurrency} duration={800} className="text-xl font-bold tabular text-loss block" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Cost</p>
                <AnimatedNumber value={loan.totalCost + downAmount} format={formatCurrency} duration={800} className="text-xl font-bold tabular text-zinc-100 block" />
              </div>
            </div>
            {loan.totalInterest > 0 && (
              <p className="text-xs text-zinc-500 mt-2">
                You&apos;ll pay {formatCurrency(loan.totalInterest)} in interest over {Math.round(termNum / 12)} years
              </p>
            )}
          </div>

          {/* Net Worth Impact */}
          {nwImpact && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Net Worth Impact</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Current Net Worth</p>
                  <AnimatedNumber value={nw!.net_worth} format={formatCurrency} duration={900} className="text-lg font-bold tabular text-vela-teal block" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Interest Cost (net worth loss)</p>
                  <AnimatedNumber value={nwImpact.change} format={formatCurrency} duration={900} className="text-lg font-bold tabular text-loss block" />
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Down payment ({formatCurrency(downAmount)}) converts cash to equity  - net worth stays the same at purchase.
                Only the {formatCurrency(nwImpact.interestCost)} in interest is a true loss over time.
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <TrendingDown className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-400">
                    {formatCurrency(loanAmount)} loan + {formatCurrency(downAmount)} down
                  </span>
                </div>
                {loanAmount > 0 && (
                  <button
                    onClick={handleAddToLiabilities}
                    disabled={addingLiability || addedLiability}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      addedLiability
                        ? "bg-gain/15 text-gain"
                        : "bg-loss/15 text-loss hover:bg-loss/25"
                    }`}
                  >
                    {addingLiability ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : addedLiability ? (
                      <><Check className="w-3.5 h-3.5" /> Added</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Add to liabilities</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Goal Impact */}
          {goalImpacts.length > 0 && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Goal Impact</h2>
              <p className="text-xs text-zinc-500 mb-3">
                If {formatCurrency(loan.monthly)}/mo comes from your savings budget:
              </p>
              <div className="space-y-3">
                {goalImpacts.map((impact) => (
                  <GoalImpactRow key={impact.goal.id} impact={impact} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state if no goals or net worth */}
          {!nw && goals.length === 0 && (
            <div className="vela-card text-center py-8">
              <p className="text-sm text-zinc-400 mb-2">
                Add accounts and goals to see how this purchase impacts your finances
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/net-worth" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">
                  Add accounts →
                </Link>
                <Link href="/goals" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">
                  Set goals →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-600 text-center">
        This calculator provides estimates for informational purposes only. It is not financial advice.
      </p>
    </PageTransition>
  );
}


// ── Goal Impact Row ─────────────────────────────────────────────────────────

interface GoalImpact {
  goal: Goal;
  currentFinal: number;
  reducedFinal: number;
  shortfall: number;
  wasOnTrack: boolean;
  nowOnTrack: boolean;
  delayMonths: number;
  reducedContrib: number;
}

function GoalImpactRow({ impact }: { impact: GoalImpact }) {
  const { goal, wasOnTrack, nowOnTrack, delayMonths, shortfall, reducedContrib } = impact;

  let statusIcon: React.ReactNode;
  let statusText: string;
  let statusClass: string;

  if (nowOnTrack) {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-gain" />;
    statusText = "Still on track";
    statusClass = "text-gain";
  } else if (delayMonths === -1) {
    statusIcon = <AlertTriangle className="w-4 h-4 text-loss" />;
    statusText = "Goal becomes unreachable";
    statusClass = "text-loss";
  } else if (delayMonths > 0) {
    statusIcon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
    statusText = `Delayed ~${delayMonths} month${delayMonths > 1 ? "s" : ""}`;
    statusClass = "text-amber-400";
  } else {
    statusIcon = <AlertTriangle className="w-4 h-4 text-loss" />;
    statusText = `Shortfall of ${formatCurrency(shortfall)}`;
    statusClass = "text-loss";
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-vela-border last:border-0">
      <div className="flex items-center gap-2">
        {statusIcon}
        <div>
          <p className="text-sm text-zinc-200">{goal.name}</p>
          <p className="text-xs text-zinc-500">
            {formatCurrency(Number(goal.monthly_contribution))}/mo → {formatCurrency(reducedContrib)}/mo
          </p>
        </div>
      </div>
      <span className={`text-xs font-medium ${statusClass}`}>
        {statusText}
      </span>
    </div>
  );
}
