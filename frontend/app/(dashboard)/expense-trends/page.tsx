"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Camera,
  Trash2,
  Download,
  PieChart,
} from "lucide-react";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useCloudStore } from "@/hooks/useCloudStore";
import { exportCSV } from "@/lib/export";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RPieChart,
  Pie,
  Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────

interface ExpenseSnapshot {
  id: string;
  date: string; // YYYY-MM
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  totalExpenses: number;
  savings: number;
  savingsRate: number;
  categories: Record<string, number>;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

const CATEGORY_COLORS = [
  "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6", "#3b82f6",
  "#10b981", "#ec4899", "#06b6d4", "#f97316", "#6366f1",
  "#84cc16", "#e11d48",
];

// ── Chart tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; fill?: string }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{monthLabel(label)}</p>
      {payload.map((p) => {
        const names: Record<string, string> = {
          income: "Income", totalExpenses: "Expenses", savings: "Savings",
          fixedExpenses: "Fixed", variableExpenses: "Variable", savingsRate: "Savings Rate",
        };
        const colors: Record<string, string> = {
          income: "text-gain", totalExpenses: "text-loss", savings: "text-teal-400",
          fixedExpenses: "text-blue-400", variableExpenses: "text-amber-400", savingsRate: "text-teal-400",
        };
        return (
          <p key={p.dataKey} className={colors[p.dataKey] ?? "text-zinc-300"}>
            {names[p.dataKey] ?? p.dataKey}: {p.dataKey === "savingsRate" ? `${p.value.toFixed(0)}%` : formatCurrency(p.value)}
          </p>
        );
      })}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function ExpenseTrendsPage() {
  const { summary: cfSummary, isLoading: cfLoading, error: cfError } = useCashFlowSummary();
  const { data: cloudData, save, isLoading: storeLoading, error: storeError } = useCloudStore<ExpenseSnapshot[]>("expense_trends");

  const [snapshots, setSnapshots] = useState<ExpenseSnapshot[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    if (cloudData && Array.isArray(cloudData) && !synced.current) {
      setSnapshots(cloudData);
      synced.current = true;
    }
  }, [cloudData]);

  useEffect(() => {
    if (synced.current && snapshots.length > 0) {
      save(snapshots);
    }
  }, [snapshots, save]);

  const sorted = useMemo(() => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)), [snapshots]);

  function handleSnapshot() {
    if (!cfSummary) return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Build category breakdown
    const categories: Record<string, number> = {};
    for (const entry of cfSummary.entries) {
      if (entry.entry_type !== "income" && entry.is_active) {
        categories[entry.category] = (categories[entry.category] ?? 0) + entry.amount;
      }
    }

    const snap: ExpenseSnapshot = {
      id: crypto.randomUUID(),
      date: ym,
      income: cfSummary.total_income,
      fixedExpenses: cfSummary.total_fixed,
      variableExpenses: cfSummary.total_variable,
      totalExpenses: cfSummary.total_expenses,
      savings: cfSummary.savings,
      savingsRate: cfSummary.savings_rate,
      categories,
    };

    // Replace existing same-month snapshot
    setSnapshots((prev) => {
      const filtered = prev.filter((s) => s.date !== ym);
      return [...filtered, snap];
    });
  }

  function handleDelete(id: string) {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  // Stats
  const stats = useMemo(() => {
    if (sorted.length < 2) return null;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const expChange = last.totalExpenses - first.totalExpenses;
    const avgExpenses = sorted.reduce((s, sn) => s + sn.totalExpenses, 0) / sorted.length;
    const avgSavingsRate = sorted.reduce((s, sn) => s + sn.savingsRate, 0) / sorted.length;
    const bestMonth = sorted.reduce((best, sn) => sn.savingsRate > best.savingsRate ? sn : best, sorted[0]);
    const worstMonth = sorted.reduce((worst, sn) => sn.savingsRate < worst.savingsRate ? sn : worst, sorted[0]);
    return { expChange, avgExpenses, avgSavingsRate, bestMonth, worstMonth };
  }, [sorted]);

  // Category aggregation for pie chart (latest snapshot)
  const categoryData = useMemo(() => {
    const latest = sorted[sorted.length - 1];
    if (!latest) return [];
    return Object.entries(latest.categories)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
      .sort((a, b) => b.value - a.value);
  }, [sorted]);

  const loading = cfLoading || storeLoading;
  if (cfError || storeError) return <ErrorState message="Failed to load expense trend data." onRetry={() => window.location.reload()} />;
  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Expense Trends</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track spending and savings patterns over time</p>
        </div>
        <div className="flex items-center gap-2">
          {sorted.length > 0 && (
            <button
              onClick={() => exportCSV(sorted.map((s) => ({
                Month: s.date, Income: s.income.toFixed(2), Fixed: s.fixedExpenses.toFixed(2),
                Variable: s.variableExpenses.toFixed(2), Total: s.totalExpenses.toFixed(2),
                Savings: s.savings.toFixed(2), "Savings Rate": `${s.savingsRate.toFixed(1)}%`,
              })), `vela-expense-trends-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          {cfSummary && (
            <button onClick={handleSnapshot} className="btn-primary text-sm flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-4">
          <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No expense data yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Take monthly snapshots of your cash flow to see spending trends. Set up your cash flow first if you haven&apos;t.
            </p>
          </div>
          {cfSummary ? (
            <button onClick={handleSnapshot} className="btn-primary text-sm inline-flex items-center gap-2">
              <Camera className="w-4 h-4" /> Take First Snapshot
            </button>
          ) : (
            <Link href="/cash-flow" className="inline-flex items-center gap-2 btn-primary text-sm">
              Set Up Cash Flow <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Stats row */}
          {stats && (
            <FloatingCard glowColor="rgba(20, 184, 166, 0.10)" tilt={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs text-zinc-500">Avg Monthly Expenses</p>
                  <p className="text-xl font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(stats.avgExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Avg Savings Rate</p>
                  <p className={`text-xl font-display font-bold tabular-nums ${stats.avgSavingsRate >= 20 ? "text-gain" : stats.avgSavingsRate >= 10 ? "text-teal-400" : "text-amber-400"}`}>
                    {stats.avgSavingsRate.toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Best Month</p>
                  <p className="text-sm font-medium text-gain tabular-nums">{monthLabel(stats.bestMonth.date)}</p>
                  <p className="text-xs text-gain/60">{stats.bestMonth.savingsRate.toFixed(0)}% saved</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Expense Trend</p>
                  <div className="flex items-center gap-1.5">
                    {stats.expChange > 0 ? <TrendingUp className="w-4 h-4 text-loss" /> : <TrendingDown className="w-4 h-4 text-gain" />}
                    <p className={`text-sm font-medium tabular-nums ${stats.expChange > 0 ? "text-loss" : "text-gain"}`}>
                      {stats.expChange > 0 ? "+" : ""}{formatCurrency(stats.expChange)}
                    </p>
                  </div>
                </div>
              </div>
            </FloatingCard>
          )}

          {/* Income vs Expenses bar chart */}
          {sorted.length >= 2 && (
            <RevealOnScroll>
              <div className="vela-card">
                <h2 className="section-heading mb-4">Income vs Expenses</h2>
                <div className="h-[280px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sorted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                      <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} width={55} />
                      <Tooltip cursor={false} content={<ChartTooltip />} />
                      <Bar dataKey="income" fill="rgb(52, 211, 153)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalExpenses" fill="rgb(244, 63, 94)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-6 mt-2 text-xs text-zinc-500 justify-center">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-gain rounded opacity-70" /> Income</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-loss rounded opacity-70" /> Expenses</span>
                </div>
              </div>
            </RevealOnScroll>
          )}

          {/* Savings rate + Category breakdown */}
          <RevealOnScroll delay={0.05}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Savings rate over time */}
              {sorted.length >= 2 && (
                <div className="vela-card">
                  <h2 className="section-heading mb-4">Savings Rate Over Time</h2>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sorted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                        <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} width={35} domain={[0, "auto"]} />
                        <Tooltip cursor={false} content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="savingsRate" stroke="rgb(20, 184, 166)" strokeWidth={2} fill="url(#srGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Category pie */}
              {categoryData.length > 0 && (
                <div className="vela-card">
                  <h2 className="section-heading mb-4">Expense Breakdown (Latest)</h2>
                  <div className="flex items-center gap-6">
                    <div className="w-[140px] h-[140px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <RPieChart>
                          <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                            {categoryData.map((_, i) => (
                              <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                        </RPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {categoryData.slice(0, 8).map((cat, i) => (
                        <div key={cat.name} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                          <span className="text-xs text-zinc-400 flex-1 truncate capitalize">{cat.name}</span>
                          <span className="text-xs font-medium text-zinc-200 tabular-nums">{formatCurrency(cat.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </RevealOnScroll>

          {/* Monthly log */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Monthly Log</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                      <th className="text-left py-2 pr-3 font-medium">Month</th>
                      <th className="text-right py-2 px-3 font-medium">Income</th>
                      <th className="text-right py-2 px-3 font-medium">Fixed</th>
                      <th className="text-right py-2 px-3 font-medium">Variable</th>
                      <th className="text-right py-2 px-3 font-medium">Savings</th>
                      <th className="text-right py-2 px-3 font-medium">Rate</th>
                      <th className="text-center py-2 pl-3 font-medium w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].reverse().map((s) => (
                      <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                        <td className="py-2 pr-3 text-zinc-200">{monthLabel(s.date)}</td>
                        <td className="py-2 px-3 text-right text-gain tabular-nums">{formatCurrency(s.income)}</td>
                        <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">{formatCurrency(s.fixedExpenses)}</td>
                        <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">{formatCurrency(s.variableExpenses)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${s.savings >= 0 ? "text-teal-400" : "text-loss"}`}>{formatCurrency(s.savings)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-medium ${s.savingsRate >= 20 ? "text-gain" : s.savingsRate >= 0 ? "text-amber-400" : "text-loss"}`}>
                          {s.savingsRate.toFixed(0)}%
                        </td>
                        <td className="py-2 pl-3 text-center">
                          <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-zinc-600 hover:text-loss hover:bg-loss/10 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        </>
      )}
    </PageTransition>
  );
}
