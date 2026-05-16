"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Plus, ArrowRight } from "lucide-react";
import {
  PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import {
  useCashFlowSummary,
  cfCategoryLabel,
  FIXED_EXPENSE_CATEGORIES,
  VARIABLE_EXPENSE_CATEGORIES,
  type CashFlowEntry,
} from "@/hooks/useCashFlow";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  rent: "#ef4444",
  insurance: "#f97316",
  utilities: "#eab308",
  subscriptions: "#a78bfa",
  loan_payment: "#f472b6",
  phone: "#22d3ee",
  other_fixed: "#71717a",
  groceries: "#34d399",
  dining: "#fb923c",
  transport: "#3b82f6",
  entertainment: "#a855f7",
  shopping: "#ec4899",
  health: "#14b8a6",
  travel: "#06b6d4",
  other_variable: "#6b7280",
};

const FALLBACK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#a78bfa", "#f472b6",
  "#22d3ee", "#34d399", "#fb923c", "#3b82f6", "#a855f7",
];

function getCatColor(cat: string, idx: number): string {
  return CATEGORY_COLORS[cat] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { summary, entries, isLoading } = useCashFlowSummary();
  const [view, setView] = useState<"all" | "fixed" | "variable">("all");

  const expenseEntries = useMemo(() => {
    return entries.filter((e) =>
      e.entry_type === "fixed_expense" || e.entry_type === "variable_expense"
    );
  }, [entries]);

  const fixed = useMemo(() => entries.filter((e) => e.entry_type === "fixed_expense"), [entries]);
  const variable = useMemo(() => entries.filter((e) => e.entry_type === "variable_expense"), [entries]);

  const filtered = view === "fixed" ? fixed : view === "variable" ? variable : expenseEntries;

  // Group by category
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; total: number; entries: CashFlowEntry[] }>();
    for (const entry of filtered) {
      const cat = entry.category;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, total: 0, entries: [] });
      }
      const group = map.get(cat)!;
      group.total += Number(entry.amount);
      group.entries.push(entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalExpenses = summary?.total_expenses ?? 0;
  const totalFixed = summary?.total_fixed ?? 0;
  const totalVariable = summary?.total_variable ?? 0;
  const totalIncome = summary?.total_income ?? 0;
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const pieData = categoryBreakdown.map((c, i) => ({
    name: cfCategoryLabel(c.category),
    value: c.total,
    color: getCatColor(c.category, i),
  }));

  const barData = [
    { name: "Fixed", value: totalFixed, color: "#ef4444" },
    { name: "Variable", value: totalVariable, color: "#f59e0b" },
  ];

  // Biggest expense
  const biggestCat = categoryBreakdown[0];
  const biggestPct = filteredTotal > 0 && biggestCat ? (biggestCat.total / filteredTotal) * 100 : 0;

  // Needs-based analysis (50/30/20 rule check)
  const fixedPctOfIncome = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;
  const variablePctOfIncome = totalIncome > 0 ? (totalVariable / totalIncome) * 100 : 0;
  const totalExpensePctOfIncome = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  const isEmpty = !isLoading && expenseEntries.length === 0;

  if (isLoading) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="vela-card animate-pulse h-24" />
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <Header />

      {isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No expenses tracked yet</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add your monthly expenses in Cash Flow to see a detailed breakdown here.
            </p>
          </div>
          <Link href="/cash-flow" className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Expenses
          </Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="vela-card text-center py-4">
              <AnimatedNumber
                value={totalExpenses}
                format={formatCompact}
                className="text-2xl font-bold tabular text-rose-400"
              />
              <p className="text-xs text-zinc-500 mt-1">Total Expenses</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber
                value={totalFixed}
                format={formatCompact}
                className="text-2xl font-bold tabular text-rose-500"
              />
              <p className="text-xs text-zinc-500 mt-1">Fixed</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber
                value={totalVariable}
                format={formatCompact}
                className="text-2xl font-bold tabular text-amber-400"
              />
              <p className="text-xs text-zinc-500 mt-1">Variable</p>
            </div>
            <div className="vela-card text-center py-4">
              {totalIncome > 0 ? (
                <AnimatedNumber
                  value={totalExpensePctOfIncome}
                  format={(n) => `${n.toFixed(0)}%`}
                  className={`text-2xl font-bold tabular ${totalExpensePctOfIncome > 80 ? "text-rose-400" : totalExpensePctOfIncome > 60 ? "text-amber-400" : "text-emerald-400"}`}
                />
              ) : (
                <p className="text-2xl font-bold tabular text-emerald-400">—</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">of Income</p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5">
            {(["all", "fixed", "variable"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  view === v
                    ? "bg-vela-teal/20 text-vela-teal"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                {v === "all" ? "All Expenses" : v === "fixed" ? "Fixed" : "Variable"}
              </button>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie chart */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">
                {view === "all" ? "Expense" : view === "fixed" ? "Fixed Expense" : "Variable Expense"} Breakdown
              </h2>
              <div className="h-56 flex items-center justify-center">
                {pieData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <RPieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(val: number) => [formatCurrency(val), "Monthly"]}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-zinc-400">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed vs Variable bar */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Fixed vs Variable</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                      width={55}
                    />
                    <Tooltip cursor={false}
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(val: number) => [formatCurrency(val), "Monthly"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 50/30/20 Rule comparison */}
              {totalIncome > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">50/30/20 Rule</p>
                  <RuleBar label="Needs (Fixed)" actual={fixedPctOfIncome} target={50} color="bg-rose-500" />
                  <RuleBar label="Wants (Variable)" actual={variablePctOfIncome} target={30} color="bg-amber-500" />
                  <RuleBar
                    label="Savings"
                    actual={summary ? Number(summary.savings_rate) : 0}
                    target={20}
                    color="bg-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Category detail list */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">By Category</h2>
            {categoryBreakdown.map((cat, i) => {
              const color = getCatColor(cat.category, i);
              const pct = filteredTotal > 0 ? (cat.total / filteredTotal) * 100 : 0;
              const incomePct = totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0;
              const isFixed = FIXED_EXPENSE_CATEGORIES.some((fc) => fc.value === cat.category);

              return (
                <div key={cat.category} className="vela-card">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-sm mt-1 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-100">
                            {cfCategoryLabel(cat.category)}
                          </h3>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {isFixed ? "Fixed" : "Variable"} · {cat.entries.length} item{cat.entries.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular text-zinc-100">
                            {formatCurrency(cat.total)}<span className="text-zinc-500 text-xs">/mo</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 tabular">
                            {formatCompact(cat.total * 12)}/yr
                          </p>
                        </div>
                      </div>

                      {/* Weight bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      {/* Sub-items */}
                      {cat.entries.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
                          {cat.entries.map((entry) => (
                            <span key={entry.id} className="text-[10px] text-zinc-500">
                              {entry.name}: <span className="text-zinc-400 tabular">{formatCurrency(entry.amount)}/mo</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {totalIncome > 0 && (
                        <p className="text-[10px] text-zinc-600 mt-1">
                          {incomePct.toFixed(1)}% of monthly income
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          <div className={`vela-card px-4 py-3 ${
            totalExpensePctOfIncome > 80 ? "border-rose-500/20" :
            totalExpensePctOfIncome > 60 ? "border-amber-500/20" :
            "border-emerald-500/20"
          }`}>
            <p className="text-xs text-zinc-400">
              {totalIncome > 0 ? (
                totalExpensePctOfIncome > 80 ? (
                  <>
                    <span className="text-rose-400 font-medium">High expense ratio</span> — you&apos;re spending {totalExpensePctOfIncome.toFixed(0)}% of income.
                    The 50/30/20 rule suggests keeping total expenses under 80% to maintain a healthy savings rate.
                  </>
                ) : totalExpensePctOfIncome > 60 ? (
                  <>
                    <span className="text-amber-400 font-medium">Moderate spending</span> — {totalExpensePctOfIncome.toFixed(0)}% of income goes to expenses.
                    {biggestCat && <> Your biggest category is {cfCategoryLabel(biggestCat.category)} at {biggestPct.toFixed(0)}% of expenses.</>}
                  </>
                ) : (
                  <>
                    <span className="text-emerald-400 font-medium">Well controlled</span> — only {totalExpensePctOfIncome.toFixed(0)}% of income goes to expenses.
                    Your savings rate of {formatPercent(summary?.savings_rate ?? 0, false)} is above the recommended 20%.
                  </>
                )
              ) : (
                <>Add income entries in Cash Flow to see how your expenses compare to your earnings.</>
              )}
            </p>
          </div>

          {/* Link to Cash Flow for editing */}
          <div className="flex justify-center">
            <Link
              href="/cash-flow"
              className="inline-flex items-center gap-1.5 text-sm text-vela-teal hover:text-vela-teal-dim transition-colors"
            >
              Manage entries in Cash Flow <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Based on your monthly Cash Flow entries. Add or update entries to keep this breakdown current.
            </p>
          </div>
        </>
      )}
    </PageTransition>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <Receipt className="w-7 h-7 text-vela-teal" />
        Expense Breakdown
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Visualize where your money goes each month and compare against the 50/30/20 rule.
      </p>
    </div>
  );
}

// ── 50/30/20 Rule Bar ────────────────────────────────────────────────────────

function RuleBar({ label, actual, target, color }: {
  label: string;
  actual: number;
  target: number;
  color: string;
}) {
  const over = actual > target;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-400 w-28">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(actual, 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-zinc-400"
          style={{ left: `${Math.min(target, 100)}%` }}
          title={`Target: ${target}%`}
        />
      </div>
      <span className={`text-[10px] tabular w-12 text-right ${over ? "text-rose-400" : "text-zinc-400"}`}>
        {actual.toFixed(0)}%
      </span>
    </div>
  );
}
