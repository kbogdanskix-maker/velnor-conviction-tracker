"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useCloudStore } from "@/hooks/useCloudStore";
import PageTransition from "@/components/celestial/PageTransition";
import ErrorState from "@/components/shared/ErrorState";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Plus, X, Heart, Trash2, Edit2, DollarSign, Calendar, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── types ──────────────────────────────────────────────────── */

interface Donation {
  id: string;
  date: string;
  organization: string;
  amount: number;
  category: DonationCategory;
  taxDeductible: boolean;
  notes?: string;
}

type DonationCategory = "charity" | "religious" | "education" | "disaster" | "health" | "environment" | "arts" | "other";

const CATEGORIES: { value: DonationCategory; label: string; color: string }[] = [
  { value: "charity", label: "Charity", color: "#14b8a6" },
  { value: "religious", label: "Religious", color: "#8b5cf6" },
  { value: "education", label: "Education", color: "#38bdf8" },
  { value: "disaster", label: "Disaster Relief", color: "#f59e0b" },
  { value: "health", label: "Health", color: "#34d399" },
  { value: "environment", label: "Environment", color: "#22c55e" },
  { value: "arts", label: "Arts & Culture", color: "#ec4899" },
  { value: "other", label: "Other", color: "#a1a1aa" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const YEAR = new Date().getFullYear();

/* ── component ──────────────────────────────────────────────── */

export default function GivingPage() {
  const { data: donations, save, isLoading, error } = useCloudStore<Donation[]>("donations");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoading && donations && !synced.current) {
      synced.current = true;
    }
  }, [isLoading, donations]);

  const list = donations || [];

  // Current year donations
  const yearDonations = list.filter((d) => d.date.startsWith(String(YEAR)));
  const totalGiven = yearDonations.reduce((s, d) => s + d.amount, 0);
  const taxDeductible = yearDonations.filter((d) => d.taxDeductible).reduce((s, d) => s + d.amount, 0);

  // Tax impact at different brackets
  const taxSavings22 = taxDeductible * 0.22;
  const taxSavings35 = taxDeductible * 0.35;

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    yearDonations.forEach((d) => {
      map[d.category] = (map[d.category] || 0) + d.amount;
    });
    return CATEGORIES
      .filter((c) => map[c.value])
      .map((c) => ({ name: c.label, value: map[c.value], color: c.color }));
  }, [yearDonations]);

  // Monthly totals
  const monthlyData = useMemo(() => {
    const months: { month: string; amount: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(YEAR, m, 1);
      const key = `${YEAR}-${String(m + 1).padStart(2, "0")}`;
      const total = yearDonations
        .filter((don) => don.date.startsWith(key))
        .reduce((s, don) => s + don.amount, 0);
      months.push({
        month: d.toLocaleDateString("en-US", { month: "short" }),
        amount: total,
      });
    }
    return months;
  }, [yearDonations]);

  // Top recipients
  const topOrgs = useMemo(() => {
    const map: Record<string, number> = {};
    yearDonations.forEach((d) => {
      map[d.organization] = (map[d.organization] || 0) + d.amount;
    });
    return Object.entries(map)
      .map(([org, amount]) => ({ org, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [yearDonations]);

  function handleSave(donation: Donation) {
    const exists = list.find((d) => d.id === donation.id);
    const updated = exists
      ? list.map((d) => (d.id === donation.id ? donation : d))
      : [...list, donation];
    save(updated);
    setShowAdd(false);
    setEditId(null);
  }

  function handleDelete(id: string) {
    save(list.filter((d) => d.id !== id));
  }

  if (error) return <ErrorState message="Failed to load giving data." onRetry={() => window.location.reload()} />;

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100">Giving</h1>
            <p className="text-zinc-400 text-sm mt-1">Track charitable donations & tax deductions</p>
          </div>
          <button
            onClick={() => { setEditId(null); setShowAdd(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vela-teal/15 text-vela-teal text-sm font-medium hover:bg-vela-teal/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Log Donation
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                TOTAL GIVEN
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalGiven)}</p>
              <p className="text-xs text-zinc-500 mt-1">{yearDonations.length} donations in {YEAR}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Building2 className="w-3.5 h-3.5" />
                TAX DEDUCTIBLE
              </div>
              <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(taxDeductible)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {totalGiven > 0 ? `${((taxDeductible / totalGiven) * 100).toFixed(0)}% of total` : "—"}
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                TAX SAVINGS (22%)
              </div>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(taxSavings22)}</p>
              <p className="text-xs text-zinc-500 mt-1">At 35%: {formatCurrency(taxSavings35)}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.3}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Calendar className="w-3.5 h-3.5" />
                AVG DONATION
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">
                {yearDonations.length > 0 ? formatCurrency(totalGiven / yearDonations.length) : "$0"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {topOrgs.length > 0 ? `Top: ${topOrgs[0].org}` : "—"}
              </p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Charts ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly */}
          <RevealOnScroll>
            <FloatingCard delay={0.4}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Monthly Giving</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip cursor={false}
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v), "Donated"]}
                      />
                      <Bar dataKey="amount" fill="#f43f5e" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>

          {/* By Category */}
          {byCategory.length > 0 && (
            <RevealOnScroll>
              <FloatingCard delay={0.5}>
                <div className="p-5">
                  <h2 className="font-display font-semibold text-zinc-100 mb-4">By Category</h2>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byCategory}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75}
                          dataKey="value" nameKey="name"
                          stroke="none"
                        >
                          {byCategory.map((d, i) => (
                            <Cell key={i} fill={d.color} fillOpacity={0.85} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                          formatter={(v: number) => [formatCurrency(v), ""]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {byCategory.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              </FloatingCard>
            </RevealOnScroll>
          )}
        </div>

        {/* ── Top Recipients ──────────────────────────────────── */}
        {topOrgs.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.6}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Top Recipients</h2>
                <div className="space-y-2">
                  {topOrgs.map((o, i) => (
                    <div key={o.org} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 w-5 font-mono">{i + 1}.</span>
                      <span className="flex-1 text-sm text-zinc-200 truncate">{o.org}</span>
                      <div className="w-32 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400"
                          style={{ width: `${(o.amount / topOrgs[0].amount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-zinc-100 tabular-nums w-20 text-right">{formatCurrency(o.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {/* ── Donation Log ────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.7}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Donation Log</h2>

              {list.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <Heart className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-zinc-300 font-medium mb-1">No donations logged</p>
                  <p className="text-sm">Track your charitable giving for tax deductions.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left py-2 px-3">Organization</th>
                          <th className="text-left py-2 px-3">Category</th>
                          <th className="text-right py-2 px-3">Amount</th>
                          <th className="text-center py-2 px-3">Tax Ded.</th>
                          <th className="text-right py-2 pl-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {[...list].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                          <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 pr-3 text-zinc-400 tabular-nums">{d.date}</td>
                            <td className="py-2.5 px-3 text-zinc-100">{d.organization}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  background: `${CAT_MAP[d.category]?.color ?? "#71717a"}15`,
                                  color: CAT_MAP[d.category]?.color ?? "#71717a",
                                }}
                              >
                                {CAT_MAP[d.category]?.label ?? d.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-zinc-100 tabular-nums">{formatCurrency(d.amount)}</td>
                            <td className="py-2.5 px-3 text-center">
                              {d.taxDeductible ? (
                                <span className="text-emerald-400 text-xs">✓</span>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => { setEditId(d.id); setShowAdd(true); }}
                                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(d.id)}
                                  className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {[...list].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                      <div key={d.id} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-zinc-100">{d.organization}</span>
                          <span className="font-bold text-zinc-100 tabular-nums">{formatCurrency(d.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="tabular-nums">{d.date}</span>
                          <span>·</span>
                          <span style={{ color: CAT_MAP[d.category]?.color }}>{CAT_MAP[d.category]?.label}</span>
                          {d.taxDeductible && <span className="text-emerald-400">Tax ded.</span>}
                        </div>
                        <div className="flex justify-end gap-1 mt-2">
                          <button onClick={() => { setEditId(d.id); setShowAdd(true); }} className="p-1 rounded text-zinc-500 hover:text-zinc-300">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(d.id)} className="p-1 rounded text-zinc-500 hover:text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Tax Note ────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-sm text-zinc-400">
            <p className="font-medium text-amber-400 mb-1">Tax Deduction Note</p>
            <p>
              Charitable deductions require itemizing. The standard deduction for 2024 is $14,600 (single) / $29,200 (married filing jointly).
              Keep receipts for all donations over $250. Consult a tax professional for your specific situation.
            </p>
          </div>
        </RevealOnScroll>

        {/* ── Add/Edit Modal ──────────────────────────────────── */}
        {showAdd && (
          <DonationModal
            donation={editId ? list.find((d) => d.id === editId) : undefined}
            onSave={handleSave}
            onClose={() => { setShowAdd(false); setEditId(null); }}
          />
        )}
      </div>
    </PageTransition>
  );
}

/* ── Donation Modal ─────────────────────────────────────────── */

function DonationModal({
  donation,
  onSave,
  onClose,
}: {
  donation?: Donation;
  onSave: (d: Donation) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(donation?.date ?? new Date().toISOString().slice(0, 10));
  const [organization, setOrganization] = useState(donation?.organization ?? "");
  const [amount, setAmount] = useState(donation?.amount?.toString() ?? "");
  const [category, setCategory] = useState<DonationCategory>(donation?.category ?? "charity");
  const [taxDeductible, setTaxDeductible] = useState(donation?.taxDeductible ?? true);
  const [notes, setNotes] = useState(donation?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: donation?.id ?? crypto.randomUUID(),
      date,
      organization: organization.trim(),
      amount: parseFloat(amount) || 0,
      category,
      taxDeductible,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-zinc-100">
            {donation ? "Edit Donation" : "Log Donation"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal" required />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" required />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Organization</label>
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Red Cross"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal" required />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Category</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {CATEGORIES.map((c) => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    category === c.value
                      ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={taxDeductible} onChange={(e) => setTaxDeductible(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/50" />
            <span className="text-sm text-zinc-300">Tax-deductible (501(c)(3))</span>
          </label>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Receipt #, event, etc."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal resize-none" />
          </div>

          <button type="submit" className="w-full py-2.5 rounded-lg bg-vela-teal text-zinc-950 font-semibold text-sm hover:bg-vela-teal/90 transition-colors">
            {donation ? "Save Changes" : "Log Donation"}
          </button>
        </form>
      </div>
    </div>
  );
}
