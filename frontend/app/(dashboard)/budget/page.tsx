"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Target, Plus, Pencil, Check, X, ArrowRight, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Legend, ReferenceLine,
} from "recharts";
import {
  useCashFlowSummary,
  cfCategoryLabel,
  FIXED_EXPENSE_CATEGORIES,
  VARIABLE_EXPENSE_CATEGORIES,
} from "@/hooks/useCashFlow";
import { formatCurrency, formatPercent, formatCompact } from "@/lib/formatters";
import { useCloudStore } from "@/hooks/useCloudStore";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import CashFlowTabs from "@/components/cashflow/CashFlowTabs";

// ── Types ────────────────────────────────────────────────────────────────────

interface BudgetTarget {
  category: string;
  limit: number;
}

interface CategoryBudget {
  category: string;
  label: string;
  type: "fixed" | "variable";
  actual: number;
  target: number;
  entries: number;
  status: "under" | "near" | "over" | "no-budget";
  pct: number;
}

// localStorage helpers removed  - now uses useCloudStore

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALL_EXPENSE_CATEGORIES = [
  ...FIXED_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: "fixed" as const })),
  ...VARIABLE_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: "variable" as const })),
];

function statusColor(s: CategoryBudget["status"]): string {
  switch (s) {
    case "under": return "text-emerald-400";
    case "near": return "text-amber-400";
    case "over": return "text-rose-400";
    case "no-budget": return "text-zinc-500";
  }
}

function statusBg(s: CategoryBudget["status"]): string {
  switch (s) {
    case "under": return "bg-emerald-500";
    case "near": return "bg-amber-500";
    case "over": return "bg-rose-500";
    case "no-budget": return "bg-zinc-700";
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { summary, entries, isLoading } = useCashFlowSummary();
  const { data: cloudTargets, save: saveTargets } = useCloudStore<BudgetTarget[]>("budget");
  const [targets, setTargets] = useState<BudgetTarget[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  // Sync from cloud store  - only when cloud data actually has content
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current && Array.isArray(cloudTargets) && cloudTargets.length > 0) {
      synced.current = true;
      setTargets(cloudTargets);
    }
  }, [cloudTargets]);

  const updateTarget = useCallback((category: string, limit: number) => {
    setTargets((prev) => {
      const next = prev.filter((t) => t.category !== category);
      if (limit > 0) next.push({ category, limit });
      saveTargets(next);  // cloud sync
      return next;
    });
  }, [saveTargets]);

  const removeTarget = useCallback((category: string) => {
    setTargets((prev) => {
      const next = prev.filter((t) => t.category !== category);
      saveTargets(next);  // cloud sync
      return next;
    });
  }, [saveTargets]);

  // Compute budget data
  const budgetData = useMemo((): CategoryBudget[] => {
    const expenseEntries = entries.filter(
      (e) => e.entry_type === "fixed_expense" || e.entry_type === "variable_expense"
    );

    // Group actual spending by category
    const actualMap = new Map<string, { total: number; count: number }>();
    for (const entry of expenseEntries) {
      const cat = entry.category;
      const curr = actualMap.get(cat) ?? { total: 0, count: 0 };
      curr.total += Number(entry.amount);
      curr.count += 1;
      actualMap.set(cat, curr);
    }

    // Build combined list  - categories with spending OR budget targets
    const targetMap = new Map(targets.map((t) => [t.category, t.limit]));
    const allCatsList = [...Array.from(actualMap.keys()), ...Array.from(targetMap.keys())];
    const seen = new Set<string>();

    const result: CategoryBudget[] = [];
    for (const cat of allCatsList) {
      if (seen.has(cat)) continue;
      seen.add(cat);
      const meta = ALL_EXPENSE_CATEGORIES.find((c) => c.value === cat);
      const actual = actualMap.get(cat)?.total ?? 0;
      const target = targetMap.get(cat) ?? 0;
      const pct = target > 0 ? (actual / target) * 100 : 0;

      let status: CategoryBudget["status"];
      if (target === 0) {
        status = "no-budget";
      } else if (pct > 100) {
        status = "over";
      } else if (pct > 85) {
        status = "near";
      } else {
        status = "under";
      }

      result.push({
        category: cat,
        label: meta?.label ?? cfCategoryLabel(cat),
        type: meta?.type ?? "variable",
        actual,
        target,
        entries: actualMap.get(cat)?.count ?? 0,
        status,
        pct,
      });
    }

    // Sort: over first, then near, then under, then no-budget
    const order = { over: 0, near: 1, under: 2, "no-budget": 3 };
    result.sort((a, b) => order[a.status] - order[b.status] || b.actual - a.actual);

    return result;
  }, [entries, targets]);

  const totalBudget = budgetData.reduce((s, d) => s + d.target, 0);
  const totalActual = budgetData.reduce((s, d) => s + d.actual, 0);
  const totalPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overBudgetCount = budgetData.filter((d) => d.status === "over").length;
  const nearBudgetCount = budgetData.filter((d) => d.status === "near").length;
  const withTargets = budgetData.filter((d) => d.target > 0);
  const withoutTargets = budgetData.filter((d) => d.target === 0 && d.actual > 0);

  const chartData = withTargets.map((d) => ({
    name: d.label.length > 12 ? d.label.slice(0, 10) + "…" : d.label,
    Actual: d.actual,
    Budget: d.target,
    status: d.status,
  }));

  const totalIncome = summary?.total_income ?? 0;
  const remainingBudget = totalBudget - totalActual;
  const hasAnyExpenses = entries.some(
    (e) => e.entry_type === "fixed_expense" || e.entry_type === "variable_expense"
  );
  const hasBudgets = targets.length > 0;

  function startEdit(cat: string, currentTarget: number) {
    setEditingCat(cat);
    setEditValue(currentTarget > 0 ? String(currentTarget) : "");
  }

  function confirmEdit(cat: string) {
    const val = Number(editValue);
    if (val > 0) {
      updateTarget(cat, val);
    } else {
      removeTarget(cat);
    }
    setEditingCat(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCat(null);
    setEditValue("");
  }

  if (isLoading) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <CashFlowTabs />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="vela-card animate-pulse h-24" />
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />
      <CashFlowTabs />

      {!hasAnyExpenses ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Target className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No expenses to budget</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add expense entries in Cash Flow first, then set monthly targets here.
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
              {hasBudgets ? (
                <AnimatedNumber
                  value={totalPct}
                  format={(n) => `${n.toFixed(0)}%`}
                  className={`text-2xl font-bold tabular ${totalPct > 100 ? "text-rose-400" : totalPct > 85 ? "text-amber-400" : "text-emerald-400"}`}
                />
              ) : (
                <p className="text-2xl font-bold tabular text-zinc-400"> -</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">Budget Used</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber
                value={totalActual}
                format={formatCompact}
                className="text-2xl font-bold tabular text-zinc-100"
              />
              <p className="text-xs text-zinc-500 mt-1">Actual Spending</p>
            </div>
            <div className="vela-card text-center py-4">
              {hasBudgets ? (
                <AnimatedNumber
                  value={totalBudget}
                  format={formatCompact}
                  className="text-2xl font-bold tabular text-vela-teal"
                />
              ) : (
                <p className="text-2xl font-bold tabular text-vela-teal"> -</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">Total Budget</p>
            </div>
            <div className="vela-card text-center py-4">
              {hasBudgets ? (
                <AnimatedNumber
                  value={Math.abs(remainingBudget)}
                  format={formatCompact}
                  className={`text-2xl font-bold tabular ${
                    remainingBudget >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                />
              ) : (
                <p className="text-2xl font-bold tabular text-emerald-400"> -</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                {remainingBudget >= 0 ? "Remaining" : "Over Budget"}
              </p>
            </div>
          </div>

          {/* Alerts */}
          {overBudgetCount > 0 && (
            <div className="vela-card px-4 py-3 border-rose-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-400">
                <span className="text-rose-400 font-medium">
                  {overBudgetCount} categor{overBudgetCount === 1 ? "y" : "ies"} over budget
                </span>
                {nearBudgetCount > 0 && <> and <span className="text-amber-400 font-medium">{nearBudgetCount} near limit</span></>}.
                Review your spending below to stay on track.
              </p>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Actual vs Budget</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={50}
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
                        backgroundColor: "#0B1322",
                        border: "1px solid #1B2638",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#EAEEF5",
                      }}
                      labelStyle={{ color: "#8A97AC" }}
                      itemStyle={{ color: "#EAEEF5" }}
                      formatter={(val: number, name: string) => [formatCurrency(val), name]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                    />
                    <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.status === "over" ? "#ef4444" : d.status === "near" ? "#f59e0b" : "#34d399"}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="Budget" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Setup prompt */}
          {!hasBudgets && (
            <div className="vela-card text-center py-8 space-y-3 border-vela-teal/20">
              <Target className="w-8 h-8 text-vela-teal mx-auto" />
              <div>
                <p className="text-zinc-200 font-medium">Set your first budget targets</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Click the pencil icon next to any category below to set a monthly spending limit.
                </p>
              </div>
            </div>
          )}

          {/* Quick setup  - set all at once */}
          {!hasBudgets && hasAnyExpenses && (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  // Auto-set targets to 110% of current spending (small buffer)
                  const expenseEntries = entries.filter(
                    (e) => e.entry_type === "fixed_expense" || e.entry_type === "variable_expense"
                  );
                  const catTotals = new Map<string, number>();
                  for (const e of expenseEntries) {
                    catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + Number(e.amount));
                  }
                  const newTargets: BudgetTarget[] = [];
                  Array.from(catTotals.entries()).forEach(([cat, total]) => {
                    newTargets.push({ category: cat, limit: Math.round(total * 1.1) });
                  });
                  setTargets(newTargets);
                  saveTargets(newTargets);
                }}
                className="btn-primary text-sm inline-flex items-center gap-1.5"
              >
                <Target className="w-4 h-4" /> Auto-set Budgets (+10% buffer)
              </button>
            </div>
          )}

          {/* Category list  - with targets */}
          {withTargets.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Budgeted Categories</h2>
              {withTargets.map((d) => (
                <CategoryRow
                  key={d.category}
                  data={d}
                  editing={editingCat === d.category}
                  editValue={editValue}
                  onStartEdit={() => startEdit(d.category, d.target)}
                  onSetEditValue={setEditValue}
                  onConfirm={() => confirmEdit(d.category)}
                  onCancel={cancelEdit}
                  onRemove={() => removeTarget(d.category)}
                />
              ))}
            </div>
          )}

          {/* Unbudgeted categories  - expenses without targets */}
          {withoutTargets.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-400">Unbudgeted</h2>
              {withoutTargets.map((d) => (
                <CategoryRow
                  key={d.category}
                  data={d}
                  editing={editingCat === d.category}
                  editValue={editValue}
                  onStartEdit={() => startEdit(d.category, 0)}
                  onSetEditValue={setEditValue}
                  onConfirm={() => confirmEdit(d.category)}
                  onCancel={cancelEdit}
                  onRemove={() => removeTarget(d.category)}
                />
              ))}
            </div>
          )}

          {/* Income context */}
          {totalIncome > 0 && hasBudgets && (
            <div className="vela-card px-4 py-3">
              <p className="text-xs text-zinc-400">
                Your total budget of <span className="text-zinc-200 font-medium">{formatCurrency(totalBudget)}</span> is{" "}
                <span className="text-zinc-200 font-medium">{formatPercent(totalBudget / totalIncome * 100, false)}</span>{" "}
                of your monthly income ({formatCurrency(totalIncome)}).
                {totalBudget / totalIncome < 0.8 && (
                  <> This leaves {formatPercent((1 - totalBudget / totalIncome) * 100, false)} for savings and investing.</>
                )}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Link
              href="/cash-flow"
              className="inline-flex items-center gap-1.5 text-sm text-vela-teal hover:text-vela-teal-dim transition-colors"
            >
              Manage entries in Cash Flow <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Budget targets are synced to your account. Add or update expense entries in Cash Flow to track against your budgets.
            </p>
          </div>
        </>
      )}
    </PageTransition>
    </TierGate>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <Target className="w-7 h-7 text-vela-teal" />
        Monthly Budget
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Set spending limits per category and track actual vs budget.
      </p>
    </div>
  );
}

// ── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ data, editing, editValue, onStartEdit, onSetEditValue, onConfirm, onCancel, onRemove }: {
  data: CategoryBudget;
  editing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSetEditValue: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const barPct = data.target > 0 ? Math.min(data.pct, 100) : 0;
  const overflowPct = data.pct > 100 ? Math.min(data.pct - 100, 50) : 0;

  return (
    <div className="vela-card">
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${statusBg(data.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">{data.label}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {data.type === "fixed" ? "Fixed" : "Variable"}
                {data.entries > 0 && <> · {data.entries} item{data.entries !== 1 ? "s" : ""}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Actual */}
              <div className="text-right">
                <p className={`text-sm font-semibold tabular ${statusColor(data.status)}`}>
                  {formatCurrency(data.actual)}
                </p>
                {data.target > 0 && (
                  <p className="text-[10px] text-zinc-500 tabular">
                    of {formatCurrency(data.target)}
                  </p>
                )}
              </div>

              {/* Edit button or inline edit */}
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => onSetEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onConfirm();
                      if (e.key === "Escape") onCancel();
                    }}
                    placeholder="Budget"
                    min="0"
                    step="1"
                    autoFocus
                    className="input-field w-20 text-xs tabular py-1"
                  />
                  <button onClick={onConfirm} className="p-1 rounded hover:bg-zinc-800 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onCancel} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onStartEdit}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Set budget"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {data.target > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                {/* Normal fill up to 100% */}
                <div
                  className={`h-full rounded-full transition-all ${statusBg(data.status)}`}
                  style={{ width: `${barPct}%` }}
                />
                {/* Overflow pulse — renders on top when over budget */}
                {overflowPct > 0 && (
                  <div
                    className="absolute right-0 top-0 h-full bg-rose-500/50 animate-pulse rounded-full"
                    style={{ width: `${Math.min(overflowPct * 2, 40)}%` }}
                  />
                )}
              </div>
              <span className={`text-[10px] tabular w-10 text-right ${statusColor(data.status)}`}>
                {data.pct.toFixed(0)}%
              </span>
            </div>
          )}

          {/* Over-budget warning */}
          {data.status === "over" && (
            <p className="text-[10px] text-rose-400 mt-1">
              Over by {formatCurrency(data.actual - data.target)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
