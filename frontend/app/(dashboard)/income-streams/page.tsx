"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  DollarSign, Plus, Trash2, Edit3, Briefcase, TrendingUp,
  Home, Coins, Gift, PiggyBank, Layers, X, Check,
} from "lucide-react";
import { useCloudStore } from "@/hooks/useCloudStore";
import { formatCurrency } from "@/lib/formatters";

/* ── types ──────────────────────────────────────────────────── */

type StreamType = "salary" | "freelance" | "rental" | "dividends" | "business" | "pension" | "social_security" | "other";

interface IncomeStream {
  id: string;
  name: string;
  type: StreamType;
  amount: number; // monthly
  frequency: "monthly" | "quarterly" | "annual";
  active: boolean;
  taxable: boolean;
  growth: number; // annual % growth
}

const STREAM_TYPES: { key: StreamType; label: string; icon: typeof Briefcase; color: string }[] = [
  { key: "salary", label: "Salary / W-2", icon: Briefcase, color: "#14b8a6" },
  { key: "freelance", label: "Freelance / 1099", icon: Layers, color: "#38bdf8" },
  { key: "rental", label: "Rental Income", icon: Home, color: "#f59e0b" },
  { key: "dividends", label: "Dividends", icon: Coins, color: "#a78bfa" },
  { key: "business", label: "Business", icon: TrendingUp, color: "#34d399" },
  { key: "pension", label: "Pension", icon: PiggyBank, color: "#f97316" },
  { key: "social_security", label: "Social Security", icon: Gift, color: "#ec4899" },
  { key: "other", label: "Other", icon: DollarSign, color: "#71717a" },
];

function typeInfo(type: StreamType) {
  return STREAM_TYPES.find((t) => t.key === type) ?? STREAM_TYPES[STREAM_TYPES.length - 1];
}

function monthlyAmount(stream: IncomeStream): number {
  switch (stream.frequency) {
    case "monthly": return stream.amount;
    case "quarterly": return stream.amount / 3;
    case "annual": return stream.amount / 12;
  }
}

/* ── component ──────────────────────────────────────────────── */

const DEFAULT_STREAMS: IncomeStream[] = [];

export default function IncomeStreamsPage() {
  const { data: streams, save: setStreams } = useCloudStore<IncomeStream[]>("income_streams");
  const syncedRef = useRef(false);
  const [local, setLocal] = useState<IncomeStream[]>(DEFAULT_STREAMS);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<StreamType>("salary");
  const [formAmount, setFormAmount] = useState(5000);
  const [formFreq, setFormFreq] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [formTaxable, setFormTaxable] = useState(true);
  const [formGrowth, setFormGrowth] = useState(3);

  // Sync cloud → local (once)
  useEffect(() => {
    if (streams && !syncedRef.current) {
      setLocal(streams);
      syncedRef.current = true;
    }
  }, [streams]);

  // Persist
  const save = (next: IncomeStream[]) => {
    setLocal(next);
    setStreams(next);
  };

  const resetForm = () => {
    setFormName(""); setFormType("salary"); setFormAmount(5000);
    setFormFreq("monthly"); setFormTaxable(true); setFormGrowth(3);
    setShowAdd(false); setEditId(null);
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editId) {
      save(local.map((s) => s.id === editId ? { ...s, name: formName, type: formType, amount: formAmount, frequency: formFreq, taxable: formTaxable, growth: formGrowth } : s));
    } else {
      save([...local, {
        id: Date.now().toString(36),
        name: formName, type: formType, amount: formAmount,
        frequency: formFreq, active: true, taxable: formTaxable, growth: formGrowth,
      }]);
    }
    resetForm();
  };

  const startEdit = (s: IncomeStream) => {
    setEditId(s.id); setFormName(s.name); setFormType(s.type);
    setFormAmount(s.amount); setFormFreq(s.frequency);
    setFormTaxable(s.taxable); setFormGrowth(s.growth);
    setShowAdd(true);
  };

  const deleteStream = (id: string) => save(local.filter((s) => s.id !== id));
  const toggleActive = (id: string) => save(local.map((s) => s.id === id ? { ...s, active: !s.active } : s));

  // Computed
  const activeStreams = local.filter((s) => s.active);
  const totalMonthly = activeStreams.reduce((s, st) => s + monthlyAmount(st), 0);
  const totalAnnual = totalMonthly * 12;
  const taxableIncome = activeStreams.filter((s) => s.taxable).reduce((s, st) => s + monthlyAmount(st), 0) * 12;
  const passiveIncome = activeStreams
    .filter((s) => ["rental", "dividends", "business", "pension", "social_security"].includes(s.type))
    .reduce((s, st) => s + monthlyAmount(st), 0) * 12;

  // Pie data
  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    activeStreams.forEach((s) => {
      const t = typeInfo(s.type);
      byType[t.label] = (byType[t.label] ?? 0) + monthlyAmount(s) * 12;
    });
    return Object.entries(byType).map(([name, value]) => ({
      name,
      value,
      fill: STREAM_TYPES.find((t) => t.label === name)?.color ?? "#71717a",
    }));
  }, [activeStreams]);

  // Monthly bar chart (by stream)
  const monthlyData = activeStreams.map((s) => ({
    name: s.name,
    amount: monthlyAmount(s),
    fill: typeInfo(s.type).color,
  }));

  // 5-year projection
  const projectionData = useMemo(() => {
    const years: { year: number; income: number; passive: number }[] = [];
    for (let y = 0; y <= 5; y++) {
      let total = 0;
      let passive = 0;
      activeStreams.forEach((s) => {
        const annual = monthlyAmount(s) * 12 * Math.pow(1 + s.growth / 100, y);
        total += annual;
        if (["rental", "dividends", "business", "pension", "social_security"].includes(s.type)) {
          passive += annual;
        }
      });
      years.push({ year: new Date().getFullYear() + y, income: total, passive });
    }
    return years;
  }, [activeStreams]);

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100">Income Streams</h1>
            <p className="text-zinc-400 text-sm mt-1">Track and visualize all your income sources</p>
          </div>
          <button onClick={() => { resetForm(); setShowAdd(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vela-teal/10 text-vela-teal text-sm font-medium hover:bg-vela-teal/20 transition-colors">
            <Plus className="w-4 h-4" /> Add Stream
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> MONTHLY INCOME
              </div>
              <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(totalMonthly)}</p>
              <p className="text-xs text-zinc-500 mt-1">{activeStreams.length} active stream{activeStreams.length !== 1 ? "s" : ""}</p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.05}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-vela-teal" /> ANNUAL INCOME
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalAnnual)}</p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> PASSIVE INCOME
              </div>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(passiveIncome)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {totalAnnual > 0 ? ((passiveIncome / totalAnnual) * 100).toFixed(0) : 0}% of total
              </p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Briefcase className="w-3.5 h-3.5 text-sky-400" /> TAXABLE INCOME
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(taxableIncome)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {totalAnnual > 0 ? ((taxableIncome / totalAnnual) * 100).toFixed(0) : 0}% taxable
              </p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Add/Edit Modal ──────────────────────────────────── */}
        {showAdd && (
          <FloatingCard delay={0}>
            <div className="p-5 space-y-4 border-l-2 border-vela-teal">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-zinc-100">{editId ? "Edit" : "Add"} Income Stream</h3>
                <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Name</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Day Job"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Amount</label>
                  <input type="number" value={formAmount} onChange={(e) => setFormAmount(+e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Frequency</label>
                  <select value={formFreq} onChange={(e) => setFormFreq(e.target.value as typeof formFreq)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {STREAM_TYPES.map((t) => (
                    <button key={t.key} onClick={() => setFormType(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        formType === t.key
                          ? "border text-zinc-100"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
                      }`}
                      style={formType === t.key ? { borderColor: t.color + "60", background: t.color + "15", color: t.color } : {}}>
                      <t.icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Annual Growth %</label>
                  <input type="range" min={0} max={10} step={0.5} value={formGrowth} onChange={(e) => setFormGrowth(+e.target.value)}
                    className="w-full mt-1 accent-vela-teal" />
                  <span className="text-xs text-zinc-400">{formGrowth}%/yr</span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button onClick={() => setFormTaxable(!formTaxable)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      formTaxable ? "bg-vela-teal/20 border-vela-teal/40" : "bg-zinc-800 border-zinc-700"
                    }`}>
                    {formTaxable && <Check className="w-3 h-3 text-vela-teal" />}
                  </button>
                  <span className="text-sm text-zinc-300">Taxable income</span>
                </div>
              </div>
              <button onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-vela-teal text-zinc-900 font-medium text-sm hover:bg-vela-teal/90 transition-colors">
                {editId ? "Update" : "Add"} Stream
              </button>
            </div>
          </FloatingCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Income Breakdown Pie ──────────────────────────── */}
          <RevealOnScroll>
            <FloatingCard delay={0.2}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Income Mix</h2>
                {pieData.length > 0 ? (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                            innerRadius={40} outerRadius={75} stroke="#09090b" strokeWidth={2}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Pie>
                          <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                            formatter={(v: number) => [formatCurrency(v), "Annual"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                      {pieData.map((d) => (
                        <span key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-500 text-center py-8">Add income streams to see breakdown</p>
                )}
              </div>
            </FloatingCard>
          </RevealOnScroll>

          {/* ── Monthly Bar Chart ─────────────────────────────── */}
          <RevealOnScroll>
            <FloatingCard delay={0.25}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Monthly by Stream</h2>
                {monthlyData.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                          formatter={(v: number) => [formatCurrency(v), "Monthly"]} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                          {monthlyData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.7} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No streams yet</p>
                )}
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── 5-Year Projection ───────────────────────────────── */}
        {projectionData.length > 0 && activeStreams.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.3}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">5-Year Income Projection</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number, name: string) => [formatCurrency(v), name === "income" ? "Total Income" : "Passive Income"]} />
                      <Area type="monotone" dataKey="income" stroke="#14b8a6" strokeWidth={2} fill="url(#incGrad)" />
                      <Area type="monotone" dataKey="passive" stroke="#f59e0b" strokeWidth={1.5} fill="url(#passGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-vela-teal inline-block rounded" /> Total</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Passive</span>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {/* ── Streams List ────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.35}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">All Streams</h2>
              {local.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No income streams added yet. Click &quot;Add Stream&quot; to get started.</p>
              ) : (
                <div className="space-y-2">
                  {local.map((s) => {
                    const info = typeInfo(s.type);
                    const Icon = info.icon;
                    return (
                      <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        s.active ? "bg-zinc-800/30 border-zinc-800" : "bg-zinc-900/50 border-zinc-800/50 opacity-50"
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: info.color + "15" }}>
                            <Icon className="w-4 h-4" style={{ color: info.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{s.name}</p>
                            <p className="text-xs text-zinc-500">{info.label} · {s.frequency} · {s.growth}% growth</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-zinc-100 tabular-nums">{formatCurrency(monthlyAmount(s))}/mo</p>
                            <p className="text-[10px] text-zinc-500 tabular-nums">{formatCurrency(monthlyAmount(s) * 12)}/yr</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleActive(s.id)}
                              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                s.active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                              }`}>
                              {s.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => startEdit(s)} className="w-7 h-7 rounded-md bg-zinc-800 text-zinc-400 flex items-center justify-center hover:text-zinc-200 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteStream(s.id)} className="w-7 h-7 rounded-md bg-zinc-800 text-zinc-400 flex items-center justify-center hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
