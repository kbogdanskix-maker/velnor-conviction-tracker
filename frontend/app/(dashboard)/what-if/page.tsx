"use client";

import { useState, useMemo } from "react";
import {
  Sparkles, Car, Home, GraduationCap, Briefcase, PiggyBank,
  TrendingUp, ArrowRight, AlertTriangle, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals, computeProjection, monthsUntil, type Goal } from "@/hooks/useGoals";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Scenario presets ────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  fields: ScenarioField[];
}

interface ScenarioField {
  key: string;
  label: string;
  type: "currency" | "percent" | "months" | "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: "big_purchase",
    label: "Big Purchase",
    icon: <Car className="w-4 h-4" />,
    description: "Buy a car, furniture, or any large item with a loan",
    fields: [
      { key: "price", label: "Purchase price", type: "currency", defaultValue: 35000 },
      { key: "down_pct", label: "Down payment %", type: "percent", defaultValue: 10, min: 0, max: 100 },
      { key: "apr", label: "Loan APR %", type: "percent", defaultValue: 6.5, min: 0, max: 30, step: 0.1 },
      { key: "term", label: "Loan term (months)", type: "months", defaultValue: 60, min: 6, max: 360 },
    ],
  },
  {
    id: "rent_change",
    label: "Move / Rent Change",
    icon: <Home className="w-4 h-4" />,
    description: "See how a rent increase or decrease affects your savings",
    fields: [
      { key: "current_rent", label: "Current rent", type: "currency", defaultValue: 1500 },
      { key: "new_rent", label: "New rent", type: "currency", defaultValue: 2000 },
    ],
  },
  {
    id: "salary_change",
    label: "Salary Change",
    icon: <Briefcase className="w-4 h-4" />,
    description: "Raise, new job, or income drop  - see the ripple effect",
    fields: [
      { key: "current_salary", label: "Current monthly income", type: "currency", defaultValue: 5000 },
      { key: "new_salary", label: "New monthly income", type: "currency", defaultValue: 6000 },
    ],
  },
  {
    id: "extra_investing",
    label: "Invest More",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "What if you put an extra amount into investments each month?",
    fields: [
      { key: "extra_monthly", label: "Extra monthly investment", type: "currency", defaultValue: 300 },
      { key: "expected_return", label: "Expected annual return %", type: "percent", defaultValue: 8, min: 0, max: 30, step: 0.5 },
      { key: "years", label: "Time horizon (years)", type: "number", defaultValue: 10, min: 1, max: 40 },
    ],
  },
  {
    id: "emergency_fund",
    label: "Build Emergency Fund",
    icon: <PiggyBank className="w-4 h-4" />,
    description: "Set aside money for 3-6 months of expenses",
    fields: [
      { key: "target_months", label: "Months of expenses to cover", type: "number", defaultValue: 6, min: 1, max: 12 },
      { key: "monthly_save", label: "Monthly savings toward fund", type: "currency", defaultValue: 500 },
    ],
  },
];

// ── Loan math ───────────────────────────────────────────────────────────────

function calcMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (apr === 0 || termMonths === 0) return principal / Math.max(termMonths, 1);
  const r = apr / 100 / 12;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function WhatIfPage() {
  const { summary: nwSummary } = useNetWorthSummary();
  const { summary: cfSummary } = useCashFlowSummary();
  const { goals } = useGoals();

  const [selectedScenario, setSelectedScenario] = useState<string>("big_purchase");
  const [values, setValues] = useState<Record<string, number>>({});

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario)!;

  // Get value with fallback to default
  function val(key: string): number {
    if (values[key] !== undefined) return values[key];
    const field = scenario.fields.find((f) => f.key === key);
    return field?.defaultValue ?? 0;
  }

  function setVal(key: string, v: number) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function selectScenario(id: string) {
    setSelectedScenario(id);
    setValues({});
  }

  // Current financial snapshot
  const monthlyIncome = cfSummary?.total_income ?? 0;
  const monthlyExpenses = cfSummary?.total_expenses ?? 0;
  const monthlySavings = cfSummary?.savings ?? 0;
  const currentNetWorth = nwSummary?.net_worth ?? 0;

  // ── Compute scenario impact ─────────────────────────────────────────────
  const impact = useMemo(() => {
    switch (selectedScenario) {
      case "big_purchase": {
        const price = val("price");
        const downPct = val("down_pct");
        const apr = val("apr");
        const term = val("term");
        const downPayment = price * (downPct / 100);
        const loanAmount = price - downPayment;
        const monthly = apr > 0 ? calcMonthlyPayment(loanAmount, apr, term) : loanAmount / term;
        const totalCost = downPayment + monthly * term;
        const totalInterest = totalCost - price;
        const newSavings = monthlySavings - monthly;
        const newSavingsRate = monthlyIncome > 0 ? (newSavings / monthlyIncome) * 100 : 0;
        const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

        return {
          title: `Buying something for ${formatCurrency(price)}`,
          metrics: [
            { label: "Monthly payment", before: formatCurrency(0), after: formatCurrency(monthly), negative: true },
            { label: "Total interest paid", before: " -", after: formatCurrency(totalInterest), negative: totalInterest > 0 },
            { label: "Monthly savings", before: formatCurrency(monthlySavings), after: formatCurrency(newSavings), negative: newSavings < monthlySavings },
            { label: "Savings rate", before: formatPercent(currentSavingsRate, false), after: formatPercent(newSavingsRate, false), negative: newSavingsRate < currentSavingsRate },
            { label: "Net worth over loan term", before: formatCurrency(currentNetWorth), after: formatCurrency(currentNetWorth - totalInterest), negative: totalInterest > 0 },
          ],
          goalDelays: computeGoalDelays(goals, monthlySavings, newSavings),
          warning: newSavings < 0 ? "This purchase would put you in negative monthly cash flow" : null,
        };
      }

      case "rent_change": {
        const currentRent = val("current_rent");
        const newRent = val("new_rent");
        const diff = newRent - currentRent;
        const newSavings = monthlySavings - diff;
        const newSavingsRate = monthlyIncome > 0 ? (newSavings / monthlyIncome) * 100 : 0;
        const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
        const yearlyImpact = diff * 12;

        return {
          title: diff > 0 ? `Rent going up by ${formatCurrency(diff)}/mo` : `Rent going down by ${formatCurrency(Math.abs(diff))}/mo`,
          metrics: [
            { label: "Monthly rent", before: formatCurrency(currentRent), after: formatCurrency(newRent), negative: diff > 0 },
            { label: "Yearly difference", before: " -", after: `${diff > 0 ? "+" : ""}${formatCurrency(yearlyImpact)}`, negative: diff > 0 },
            { label: "Monthly savings", before: formatCurrency(monthlySavings), after: formatCurrency(newSavings), negative: newSavings < monthlySavings },
            { label: "Savings rate", before: formatPercent(currentSavingsRate, false), after: formatPercent(newSavingsRate, false), negative: newSavingsRate < currentSavingsRate },
          ],
          goalDelays: computeGoalDelays(goals, monthlySavings, newSavings),
          warning: newSavings < 0 ? "This rent would put you in negative monthly cash flow" : null,
        };
      }

      case "salary_change": {
        const currentSalary = val("current_salary");
        const newSalary = val("new_salary");
        const diff = newSalary - currentSalary;
        const newSavings = monthlySavings + diff;
        const newIncome = monthlyIncome + diff;
        const newSavingsRate = newIncome > 0 ? (newSavings / newIncome) * 100 : 0;
        const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

        return {
          title: diff > 0 ? `Getting a ${formatCurrency(diff)}/mo raise` : `Income dropping by ${formatCurrency(Math.abs(diff))}/mo`,
          metrics: [
            { label: "Monthly income", before: formatCurrency(currentSalary), after: formatCurrency(newSalary), negative: diff < 0 },
            { label: "Yearly difference", before: " -", after: `${diff > 0 ? "+" : ""}${formatCurrency(diff * 12)}/yr`, negative: diff < 0 },
            { label: "Monthly savings", before: formatCurrency(monthlySavings), after: formatCurrency(newSavings), negative: newSavings < monthlySavings },
            { label: "Savings rate", before: formatPercent(currentSavingsRate, false), after: formatPercent(newSavingsRate, false), negative: newSavingsRate < currentSavingsRate },
          ],
          goalDelays: computeGoalDelays(goals, monthlySavings, newSavings),
          warning: newSavings < 0 ? "This income level wouldn't cover your current expenses" : null,
        };
      }

      case "extra_investing": {
        const extra = val("extra_monthly");
        const returnRate = val("expected_return");
        const years = val("years");
        const months = years * 12;
        const newSavings = monthlySavings - extra;
        const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
        const newSavingsRate = monthlyIncome > 0 ? (newSavings / monthlyIncome) * 100 : 0;

        // Compound growth projection
        const projection = computeProjection(0, extra, returnRate, months);
        const futureValue = projection[projection.length - 1]?.value ?? 0;
        const totalContributed = extra * months;
        const growthEarned = futureValue - totalContributed;

        return {
          title: `Investing an extra ${formatCurrency(extra)}/mo for ${years} years`,
          metrics: [
            { label: "Total contributed", before: " -", after: formatCurrency(totalContributed), negative: false },
            { label: "Growth earned", before: " -", after: formatCurrency(growthEarned), negative: false },
            { label: "Future value", before: " -", after: formatCurrency(futureValue), negative: false },
            { label: "Monthly savings after", before: formatCurrency(monthlySavings), after: formatCurrency(newSavings), negative: newSavings < monthlySavings },
            { label: "Savings rate", before: formatPercent(currentSavingsRate, false), after: formatPercent(newSavingsRate, false), negative: newSavingsRate < currentSavingsRate },
          ],
          goalDelays: computeGoalDelays(goals, monthlySavings, newSavings),
          chartData: projection.filter((_, i) => i % 3 === 0 || i === months).map((p) => ({
            date: p.date,
            value: p.value,
            contributed: p.contributed,
          })),
          warning: newSavings < 0 ? "This would exceed your current monthly savings" : null,
        };
      }

      case "emergency_fund": {
        const targetMonths = val("target_months");
        const monthlySave = val("monthly_save");
        const targetAmount = monthlyExpenses * targetMonths;
        const monthsToGoal = monthlySave > 0 ? Math.ceil(targetAmount / monthlySave) : 0;
        const newSavings = monthlySavings - monthlySave;
        const currentSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
        const newSavingsRate = monthlyIncome > 0 ? (newSavings / monthlyIncome) * 100 : 0;

        // Goals whose names suggest emergency fund get the monthly_save added
        // directly to their contribution — not penalised by the savings reduction
        const efOverrides: Record<string, number> = {};
        goals.forEach((g) => {
          if (/emergency/i.test(g.name)) {
            const baseContrib = g.monthly_contribution ?? 0;
            efOverrides[g.name] = baseContrib + monthlySave;
          }
        });

        return {
          title: `Building a ${targetMonths}-month emergency fund`,
          metrics: [
            { label: "Target amount", before: " -", after: formatCurrency(targetAmount), negative: false },
            { label: "Monthly set aside", before: " -", after: formatCurrency(monthlySave), negative: false },
            { label: "Months to reach goal", before: " -", after: `${monthsToGoal} months`, negative: false },
            { label: "Remaining savings", before: formatCurrency(monthlySavings), after: formatCurrency(newSavings), negative: newSavings < monthlySavings },
            { label: "Savings rate", before: formatPercent(currentSavingsRate, false), after: formatPercent(newSavingsRate, false), negative: newSavingsRate < currentSavingsRate },
          ],
          goalDelays: computeGoalDelays(goals, monthlySavings, newSavings, efOverrides),
          warning: newSavings < 0 ? "This savings rate would exceed your available surplus" : null,
        };
      }

      default:
        return { title: "", metrics: [], goalDelays: [], warning: null };
    }
  }, [selectedScenario, values, monthlySavings, monthlyIncome, monthlyExpenses, currentNetWorth, goals]);

  return (
    <TierGate requiredTier="navigator">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-vela-teal" />
          What If
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          See how financial decisions ripple across your goals and savings
        </p>
      </div>

      {/* Scenario selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => selectScenario(s.id)}
            className={`vela-card text-left transition-all ${
              selectedScenario === s.id
                ? "border-vela-teal ring-1 ring-vela-teal/30"
                : "hover:border-zinc-600"
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
              selectedScenario === s.id ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-400"
            }`}>
              {s.icon}
            </div>
            <p className="text-sm font-medium text-zinc-200">{s.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{s.description}</p>
          </button>
        ))}
      </div>

      {/* Inputs + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="vela-card">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Scenario Inputs</h2>
          <div className="space-y-4">
            {scenario.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-zinc-500 mb-1 block">{f.label}</label>
                <input
                  type="number"
                  value={val(f.key)}
                  onChange={(e) => setVal(f.key, Number(e.target.value))}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? (f.type === "currency" ? 100 : 1)}
                  className="input-field w-full tabular"
                />
              </div>
            ))}
          </div>

          {/* Current snapshot */}
          <div className="mt-4 pt-4 border-t border-vela-border">
            <p className="text-xs text-zinc-500 mb-2">Your current snapshot</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Monthly income</span>
                <span className="tabular text-zinc-200">{formatCurrency(monthlyIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Monthly expenses</span>
                <span className="tabular text-zinc-200">{formatCurrency(monthlyExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Monthly savings</span>
                <span className="tabular text-gain">{formatCurrency(monthlySavings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Net worth</span>
                <span className="tabular text-zinc-200">{formatCurrency(currentNetWorth)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Impact title */}
          <div className="vela-card">
            <h2 className="text-sm font-medium text-vela-teal mb-1">{impact.title}</h2>
            {impact.warning && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg mb-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {impact.warning}
              </div>
            )}

            {/* Before → After metrics */}
            <div className="space-y-2">
              {impact.metrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-vela-border last:border-0">
                  <span className="text-sm text-zinc-400">{m.label}</span>
                  <div className="flex items-center gap-2 text-sm tabular">
                    {m.before !== " -" && (
                      <>
                        <span className="text-zinc-500">{m.before}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                      </>
                    )}
                    <span className={m.negative ? "text-loss font-medium" : "text-gain font-medium"}>
                      {m.after}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal impact */}
          {impact.goalDelays.length > 0 && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Impact on Your Goals</h2>
              <div className="divide-y divide-vela-border">
                {impact.goalDelays.map((g, i) => {
                  const cantReach = g.delayMonths === Infinity;
                  const isDelayed = !cantReach && g.delayMonths > 0;
                  const isSooner = g.delayMonths < 0;
                  const noImpact = g.delayMonths === 0;
                  const absMonths = Math.abs(g.delayMonths);

                  return (
                    <div key={i} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-zinc-200 leading-snug">{g.name}</p>
                        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          cantReach
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                            : isDelayed
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                            : isSooner
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                            : "bg-zinc-800 text-zinc-500 border-zinc-700"
                        }`}>
                          {cantReach ? "Unreachable"
                            : isDelayed ? `+${absMonths}mo`
                            : isSooner ? `-${absMonths}mo`
                            : "No impact"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{formatCurrency(g.target)} target</p>
                      {!noImpact && (
                        <p className="text-xs mt-1 text-zinc-500">
                          {cantReach
                            ? "Savings would no longer cover this goal"
                            : isDelayed
                            ? `Delayed by ${absMonths} month${absMonths !== 1 ? "s" : ""}`
                            : `Reached ${absMonths} month${absMonths !== 1 ? "s" : ""} sooner`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investment growth chart (only for extra_investing scenario) */}
          {(impact as any).chartData && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Projected Growth</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(impact as any).chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1AA8BB" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#1AA8BB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradContrib" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#71717a" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#71717a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem", fontSize: "0.75rem" }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "value" ? "Total Value" : "Contributed"]}
                      labelStyle={{ color: "#a1a1aa" }}
                    />
                    <Area type="monotone" dataKey="contributed" stroke="#71717a" fill="url(#gradContrib)" strokeWidth={1.5} strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="value" stroke="#1AA8BB" fill="url(#gradValue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-vela-teal" /> Total value</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Amount contributed</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-600 text-center">
        Estimates are projections, not guarantees. Not financial advice.
      </p>
    </PageTransition>
    </TierGate>
  );
}


// ── Goal delay computation ──────────────────────────────────────────────────

interface GoalDelay {
  name: string;
  target: number;
  delayMonths: number; // positive = delayed, negative = sooner, 0 = no change
}

function computeGoalDelays(
  goals: Goal[],
  currentSavings: number,
  newSavings: number,
  // Optional: explicit "after" contribution for named goals that should not
  // be scaled proportionally (e.g. the emergency fund goal in the emergency
  // fund scenario — it gets MORE, not less)
  afterContribOverrides: Record<string, number> = {},
): GoalDelay[] {
  if (goals.length === 0) return [];

  // For goals without explicit contributions, split savings evenly among them
  const goalsWithoutContrib = goals.filter((g) => !g.monthly_contribution).length;

  return goals.map((g) => {
    const remaining = g.target_amount - g.current_amount;
    if (remaining <= 0) return { name: g.name, target: g.target_amount, delayMonths: 0 };

    // Use explicit contribution, or split savings evenly among goals that lack one
    const contrib = g.monthly_contribution || (goalsWithoutContrib > 0 ? Math.max(0, currentSavings) / goalsWithoutContrib : 0);
    const monthlyRate = Math.pow(1 + (g.cagr || 7) / 100, 1 / 12) - 1;

    function monthsToReach(monthlyContrib: number): number {
      if (monthlyContrib <= 0) return Infinity;
      let balance = g.current_amount;
      for (let m = 1; m <= 600; m++) {
        balance = balance * (1 + monthlyRate) + monthlyContrib;
        if (balance >= g.target_amount) return m;
      }
      return Infinity;
    }

    // If this goal has an explicit override for the "after" scenario, use it
    // directly rather than proportional scaling
    let adjustedContrib: number;
    if (afterContribOverrides[g.name] !== undefined) {
      adjustedContrib = Math.max(0, afterContribOverrides[g.name]);
    } else if (currentSavings > 0) {
      adjustedContrib = Math.max(0, contrib * (newSavings / currentSavings));
    } else {
      adjustedContrib = Math.max(0, contrib + (newSavings - currentSavings));
    }

    const monthsBefore = monthsToReach(contrib);
    const monthsAfter = monthsToReach(adjustedContrib);

    let delay: number;
    if (monthsBefore === Infinity && monthsAfter === Infinity) {
      delay = 0;
    } else if (monthsAfter === Infinity) {
      delay = Infinity;
    } else if (monthsBefore === Infinity) {
      delay = -monthsAfter;
    } else {
      delay = monthsAfter - monthsBefore;
    }

    return { name: g.name, target: g.target_amount, delayMonths: delay };
  });
}
