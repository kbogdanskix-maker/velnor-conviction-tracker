"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Repeat, Plus, Trash2, Edit2, Check, X, AlertTriangle,
  DollarSign, Calendar, TrendingUp, ArrowUpRight, Download,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { exportCSV } from "@/lib/export";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useCloudStore } from "@/hooks/useCloudStore";
import PageTransition from "@/components/celestial/PageTransition";

// ── Types ───────────────────────────────────────────────────────────────────

type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

interface Subscription {
  id: string;
  name: string;
  cost: number;
  frequency: Frequency;
  category: string;
  startDate: string; // ISO date
  notes: string;
}

const CATEGORIES = [
  "Streaming", "Music", "Cloud Storage", "Software", "Gaming",
  "News & Media", "Fitness", "Food & Delivery", "Finance",
  "Education", "Productivity", "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  Streaming: "#f43f5e",
  Music: "#a855f7",
  "Cloud Storage": "#3b82f6",
  Software: "#1AA8BB",
  Gaming: "#f59e0b",
  "News & Media": "#6366f1",
  Fitness: "#22c55e",
  "Food & Delivery": "#f97316",
  Finance: "#06b6d4",
  Education: "#ec4899",
  Productivity: "#84cc16",
  Other: "#71717a",
};

// localStorage helpers removed  - now uses useCloudStore

function toMonthly(cost: number, freq: Frequency): number {
  switch (freq) {
    case "weekly": return cost * 52 / 12;
    case "monthly": return cost;
    case "quarterly": return cost / 3;
    case "yearly": return cost / 12;
  }
}

function toAnnual(cost: number, freq: Frequency): number {
  return toMonthly(cost, freq) * 12;
}

function freqLabel(f: Frequency): string {
  switch (f) {
    case "weekly": return "/wk";
    case "monthly": return "/mo";
    case "quarterly": return "/qtr";
    case "yearly": return "/yr";
  }
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { summary: cashFlow } = useCashFlowSummary();
  const { data: cloudSubs, save: saveSubs } = useCloudStore<Subscription[]>("subscriptions");
  const [subs, setSubs] = useState<Subscription[]>([]);

  // Sync from cloud store  - only when cloud data actually has content
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current && Array.isArray(cloudSubs) && cloudSubs.length > 0) {
      synced.current = true;
      setSubs(cloudSubs);
    }
  }, [cloudSubs]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"cost" | "name" | "category">("cost");

  // Form state
  const [fName, setFName] = useState("");
  const [fCost, setFCost] = useState("");
  const [fFreq, setFFreq] = useState<Frequency>("monthly");
  const [fCat, setFCat] = useState("Streaming");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fNotes, setFNotes] = useState("");

  function resetForm() {
    setFName(""); setFCost(""); setFFreq("monthly");
    setFCat("Streaming"); setFDate(new Date().toISOString().slice(0, 10));
    setFNotes(""); setEditId(null); setShowAdd(false);
  }

  function handleSave() {
    const sub: Subscription = {
      id: editId || crypto.randomUUID(),
      name: fName || "Untitled",
      cost: parseFloat(fCost) || 0,
      frequency: fFreq,
      category: fCat,
      startDate: fDate,
      notes: fNotes,
    };
    let updated: Subscription[];
    if (editId) {
      updated = subs.map((s) => (s.id === editId ? sub : s));
    } else {
      updated = [...subs, sub];
    }
    setSubs(updated);
    saveSubs(updated);  // cloud sync
    resetForm();
  }

  function handleEdit(s: Subscription) {
    setEditId(s.id); setFName(s.name); setFCost(String(s.cost));
    setFFreq(s.frequency); setFCat(s.category); setFDate(s.startDate);
    setFNotes(s.notes); setShowAdd(true);
  }

  function handleDelete(id: string) {
    const updated = subs.filter((s) => s.id !== id);
    setSubs(updated); saveSubs(updated);
  }

  const totalMonthly = useMemo(() => subs.reduce((s, sub) => s + toMonthly(sub.cost, sub.frequency), 0), [subs]);
  const totalAnnual = totalMonthly * 12;
  const monthlyIncome = cashFlow?.total_income ?? 0;
  const incomePercent = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of subs) {
      const monthly = toMonthly(sub.cost, sub.frequency);
      map.set(sub.category, (map.get(sub.category) || 0) + monthly);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [subs]);

  // Monthly cost per subscription for bar chart
  const subBarData = useMemo(() => {
    return subs
      .map((s) => ({ name: s.name, monthly: Math.round(toMonthly(s.cost, s.frequency) * 100) / 100 }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 10);
  }, [subs]);

  // Sorted subs
  const sortedSubs = useMemo(() => {
    const copy = [...subs];
    switch (sortBy) {
      case "cost": return copy.sort((a, b) => toMonthly(b.cost, b.frequency) - toMonthly(a.cost, a.frequency));
      case "name": return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "category": return copy.sort((a, b) => a.category.localeCompare(b.category));
    }
  }, [subs, sortBy]);

  // Insights
  const mostExpensive = subs.length > 0
    ? subs.reduce((max, s) => toMonthly(s.cost, s.frequency) > toMonthly(max.cost, max.frequency) ? s : max, subs[0])
    : null;

  const oldestSub = subs.length > 0
    ? subs.reduce((old, s) => s.startDate < old.startDate ? s : old, subs[0])
    : null;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Subscription Tracker</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Track recurring subscriptions, spot forgotten charges, and see the true annual cost
          </p>
        </div>
        {subs.length > 0 && (
          <button
            onClick={() =>
              exportCSV(
                subs.map((s) => ({
                  Name: s.name,
                  Cost: s.cost,
                  Frequency: s.frequency,
                  "Monthly Cost": toMonthly(s.cost, s.frequency).toFixed(2),
                  Category: s.category,
                  "Start Date": s.startDate,
                  Notes: s.notes,
                })),
                `vela-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Monthly Total</p>
          <p className="text-2xl font-bold text-zinc-100 tabular-nums mt-1">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Annual Total</p>
          <p className="text-2xl font-bold text-vela-teal tabular-nums mt-1">{formatCurrency(totalAnnual)}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Subscriptions</p>
          <p className="text-2xl font-bold text-zinc-100 tabular-nums mt-1">{subs.length}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">% of Income</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${incomePercent > 15 ? "text-loss" : incomePercent > 10 ? "text-yellow-400" : "text-gain"}`}>
            {monthlyIncome > 0 ? `${incomePercent.toFixed(1)}%` : " -"}
          </p>
        </div>
      </div>

      {/* Charts */}
      {subs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category pie */}
          <div className="vela-card p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">By Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || "#71717a"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                    formatter={(v: number) => [formatCurrency(v) + "/mo"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] || "#71717a" }} />
                  <span>{c.name}</span>
                  <span className="text-zinc-500 tabular-nums">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top subs bar */}
          <div className="vela-card p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Top by Monthly Cost</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subBarData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={70} />
                  <Tooltip cursor={false}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                    formatter={(v: number) => [formatCurrency(v) + "/mo"]}
                  />
                  <Bar dataKey="monthly" fill="#1AA8BB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      {subs.length > 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {mostExpensive && (
            <div className="vela-card p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Biggest Subscription</p>
              <p className="text-sm font-semibold text-zinc-200">{mostExpensive.name}</p>
              <p className="text-xs text-zinc-400">{formatCurrency(toMonthly(mostExpensive.cost, mostExpensive.frequency))}/mo · {formatCurrency(toAnnual(mostExpensive.cost, mostExpensive.frequency))}/yr</p>
            </div>
          )}
          <div className="vela-card p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Daily Cost</p>
            <p className="text-lg font-bold text-zinc-200 tabular-nums">{formatCurrency(totalAnnual / 365)}<span className="text-xs text-zinc-500 font-normal">/day</span></p>
            <p className="text-xs text-zinc-400">Your subscriptions cost you this much every single day</p>
          </div>
          {oldestSub && (
            <div className="vela-card p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Longest Running</p>
              <p className="text-sm font-semibold text-zinc-200">{oldestSub.name}</p>
              <p className="text-xs text-zinc-400">
                {daysSince(oldestSub.startDate)} days · {formatCurrency(toAnnual(oldestSub.cost, oldestSub.frequency) * (daysSince(oldestSub.startDate) / 365))} total spent
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subscription list */}
      <div className="vela-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Subscriptions</h2>
            <div className="flex gap-1">
              {(["cost", "name", "category"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${sortBy === s ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-vela-teal/15 text-vela-teal hover:bg-vela-teal/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Add/Edit form */}
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Name</label>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g. Netflix"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Cost</label>
                <input
                  type="number"
                  value={fCost}
                  onChange={(e) => setFCost(e.target.value)}
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Frequency</label>
                <select
                  value={fFreq}
                  onChange={(e) => setFFreq(e.target.value as Frequency)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <select
                  value={fCat}
                  onChange={(e) => setFCat(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                <input
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-vela-teal text-zinc-950 hover:bg-vela-teal/90 transition-colors">
                <Check className="w-3.5 h-3.5" />
                {editId ? "Update" : "Add"}
              </button>
              <button onClick={resetForm} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors">
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {sortedSubs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No subscriptions tracked yet. Add your recurring services to see the full picture.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedSubs.map((s) => {
              const monthly = toMonthly(s.cost, s.frequency);
              const annual = toAnnual(s.cost, s.frequency);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors group">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[s.category] || "#71717a" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">{s.name}</span>
                      <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">{s.category}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-zinc-500 mt-0.5">
                      <span className="tabular-nums">{formatCurrency(s.cost)}{freqLabel(s.frequency)}</span>
                      <span className="tabular-nums">≈ {formatCurrency(monthly)}/mo</span>
                      <span className="tabular-nums">{formatCurrency(annual)}/yr</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(s)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded text-zinc-500 hover:text-loss hover:bg-zinc-700 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Subscription Audit Tips</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p><span className="text-zinc-200 font-medium">Check bank statements</span>  - search for recurring charges you may have forgotten about.</p>
          <p><span className="text-zinc-200 font-medium">Audit quarterly</span>  - ask "Did I use this in the last 30 days?" for each subscription.</p>
          <p><span className="text-zinc-200 font-medium">Negotiate or downgrade</span>  - many services offer cheaper tiers or retention discounts if you call to cancel.</p>
          <p><span className="text-zinc-200 font-medium">Annual vs monthly</span>  - switching to annual billing often saves 15-20% on services you know you'll keep.</p>
        </div>
      </div>
    </PageTransition>
  );
}
