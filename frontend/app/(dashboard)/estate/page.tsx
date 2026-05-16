"use client";

import { useState, useCallback } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Landmark, Users, FileText, Shield, Plus, Trash2, Info, Download } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── types ──────────────────────────────────────────────────── */

interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  share: number; // percentage
}

interface Asset {
  id: string;
  name: string;
  value: number;
  type: "property" | "investment" | "insurance" | "retirement" | "cash" | "other";
  beneficiary: string; // name or "Estate"
  titling: string; // joint, trust, individual, POD/TOD
}

const ASSET_COLORS: Record<string, string> = {
  property: "#f59e0b",
  investment: "#14b8a6",
  insurance: "#8b5cf6",
  retirement: "#3b82f6",
  cash: "#34d399",
  other: "#71717a",
};

const TITLING_OPTIONS = ["Individual", "Joint (WROS)", "Revocable Trust", "Irrevocable Trust", "POD/TOD", "Community Property"];

const uid = () => Math.random().toString(36).slice(2, 10);

/* ── estate tax calc (2024) ─────────────────────────────────── */

const FEDERAL_EXEMPTION = 13_610_000;
const ESTATE_TAX_RATE = 0.40;

function computeEstateTax(totalValue: number) {
  const taxable = Math.max(0, totalValue - FEDERAL_EXEMPTION);
  const tax = taxable * ESTATE_TAX_RATE;
  return { taxable, tax, exemptionUsed: Math.min(totalValue, FEDERAL_EXEMPTION) };
}

/* ── component ──────────────────────────────────────────────── */

export default function EstatePage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { id: uid(), name: "Spouse", relationship: "Spouse", share: 50 },
    { id: uid(), name: "Child 1", relationship: "Child", share: 25 },
    { id: uid(), name: "Child 2", relationship: "Child", share: 25 },
  ]);

  const [assets, setAssets] = useState<Asset[]>([
    { id: uid(), name: "Primary Residence", value: 550_000, type: "property", beneficiary: "Spouse", titling: "Joint (WROS)" },
    { id: uid(), name: "Brokerage Account", value: 320_000, type: "investment", beneficiary: "Estate", titling: "Individual" },
    { id: uid(), name: "401(k)", value: 480_000, type: "retirement", beneficiary: "Spouse", titling: "POD/TOD" },
    { id: uid(), name: "Life Insurance", value: 500_000, type: "insurance", beneficiary: "Estate", titling: "Individual" },
    { id: uid(), name: "Savings", value: 75_000, type: "cash", beneficiary: "Estate", titling: "Joint (WROS)" },
  ]);

  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    will: false,
    trust: false,
    poa: false,
    healthcare: false,
    beneficiaries_updated: false,
    insurance_reviewed: false,
    digital_assets: false,
    letter_of_intent: false,
  });

  const totalEstate = assets.reduce((s, a) => s + a.value, 0);
  const estateTax = computeEstateTax(totalEstate);

  // Beneficiary distribution
  const totalShares = beneficiaries.reduce((s, b) => s + b.share, 0);
  const beneficiaryDist = beneficiaries.map((b) => ({
    name: b.name,
    value: totalEstate * (b.share / Math.max(totalShares, 1)),
    pct: totalShares > 0 ? ((b.share / totalShares) * 100).toFixed(0) : "0",
  }));

  // Assets by type
  const assetsByType = Object.entries(
    assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + a.value;
      return acc;
    }, {}),
  ).map(([type, value]) => ({ type, value, fill: ASSET_COLORS[type] ?? "#71717a" }));

  // Probate vs non-probate
  const probateAssets = assets.filter((a) => a.titling === "Individual");
  const nonProbateAssets = assets.filter((a) => a.titling !== "Individual");
  const probateTotal = probateAssets.reduce((s, a) => s + a.value, 0);

  // Add beneficiary
  const addBeneficiary = useCallback(() => {
    setBeneficiaries((prev) => [...prev, { id: uid(), name: "", relationship: "Other", share: 0 }]);
  }, []);

  const removeBeneficiary = useCallback((id: string) => {
    setBeneficiaries((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Add asset
  const addAsset = useCallback(() => {
    setAssets((prev) => [...prev, { id: uid(), name: "", value: 0, type: "other", beneficiary: "Estate", titling: "Individual" }]);
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const checklistItems = [
    { key: "will", label: "Last Will & Testament" },
    { key: "trust", label: "Revocable Living Trust" },
    { key: "poa", label: "Power of Attorney (Financial)" },
    { key: "healthcare", label: "Healthcare Directive / Living Will" },
    { key: "beneficiaries_updated", label: "Beneficiary Designations Updated" },
    { key: "insurance_reviewed", label: "Life Insurance Coverage Reviewed" },
    { key: "digital_assets", label: "Digital Assets Inventory" },
    { key: "letter_of_intent", label: "Letter of Intent / Instructions" },
  ];

  const checklistPct = (Object.values(checklist).filter(Boolean).length / checklistItems.length) * 100;

  const PIE_COLORS = ["#14b8a6", "#f59e0b", "#8b5cf6", "#3b82f6", "#34d399", "#ef4444"];

  // CSV export
  const exportCSV = () => {
    const rows = [
      ["Asset", "Value", "Type", "Beneficiary", "Titling"],
      ...assets.map((a) => [a.name, a.value.toString(), a.type, a.beneficiary, a.titling]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estate-plan.csv";
    a.click();
  };

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100">Estate Planning</h1>
            <p className="text-zinc-400 text-sm mt-1">Beneficiary designations, asset titling & estate readiness</p>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                TOTAL ESTATE
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalEstate)}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Shield className="w-3.5 h-3.5 text-vela-teal" />
                ESTATE TAX
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${estateTax.tax > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {estateTax.tax > 0 ? formatCurrency(estateTax.tax) : "$0"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {estateTax.tax > 0
                  ? `${formatCurrency(estateTax.taxable)} above exemption`
                  : `${formatCurrency(FEDERAL_EXEMPTION - totalEstate)} under exemption`}
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                PROBATE EXPOSURE
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${probateTotal > 100_000 ? "text-amber-400" : "text-emerald-400"}`}>
                {formatCurrency(probateTotal)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{probateAssets.length} individually titled assets</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                READINESS
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${
                checklistPct >= 75 ? "text-emerald-400" : checklistPct >= 50 ? "text-amber-400" : "text-rose-400"
              }`}>
                {checklistPct.toFixed(0)}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  checklistPct >= 75 ? "bg-emerald-400" : checklistPct >= 50 ? "bg-amber-400" : "bg-rose-400"
                }`} style={{ width: `${checklistPct}%` }} />
              </div>
            </div>
          </FloatingCard>
        </div>

        {/* ── Charts Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RevealOnScroll>
            <FloatingCard delay={0.25}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Assets by Type</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assetsByType} dataKey="value" nameKey="type" cx="50%" cy="50%" innerRadius={40} outerRadius={75}
                        stroke="#09090b" strokeWidth={2}>
                        {assetsByType.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {assetsByType.map((d) => (
                    <span key={d.type} className="flex items-center gap-1.5 text-xs text-zinc-400 capitalize">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      {d.type}
                    </span>
                  ))}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>

          <RevealOnScroll>
            <FloatingCard delay={0.3}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Beneficiary Distribution</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={beneficiaryDist} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v)]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {beneficiaryDist.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── Beneficiaries ───────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.35}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-zinc-100">Beneficiaries</h2>
                <button onClick={addBeneficiary}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vela-teal/10 text-vela-teal text-xs font-medium hover:bg-vela-teal/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3">
                {beneficiaries.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                    <input value={b.name} placeholder="Name"
                      onChange={(e) => setBeneficiaries((prev) => prev.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                      className="flex-1 bg-transparent text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600" />
                    <select value={b.relationship}
                      onChange={(e) => setBeneficiaries((prev) => prev.map((x) => x.id === b.id ? { ...x, relationship: e.target.value } : x))}
                      className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                      {["Spouse", "Child", "Sibling", "Parent", "Trust", "Charity", "Other"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" value={b.share} min={0} max={100}
                        onChange={(e) => setBeneficiaries((prev) => prev.map((x) => x.id === b.id ? { ...x, share: +e.target.value } : x))}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 tabular-nums text-right" />
                      <span className="text-xs text-zinc-500">%</span>
                    </div>
                    <button onClick={() => removeBeneficiary(b.id)} className="text-zinc-600 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {totalShares !== 100 && (
                  <p className="text-xs text-amber-400">⚠ Shares total {totalShares}% (should be 100%)</p>
                )}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Assets ──────────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.4}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-zinc-100">Estate Assets</h2>
                <button onClick={addAsset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vela-teal/10 text-vela-teal text-xs font-medium hover:bg-vela-teal/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-xs">
                      <th className="text-left pb-3 font-medium">Asset</th>
                      <th className="text-right pb-3 font-medium">Value</th>
                      <th className="text-left pb-3 font-medium pl-4">Type</th>
                      <th className="text-left pb-3 font-medium">Beneficiary</th>
                      <th className="text-left pb-3 font-medium">Titling</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {assets.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2">
                          <input value={a.name} placeholder="Asset name"
                            onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                            className="bg-transparent text-zinc-200 text-sm focus:outline-none placeholder:text-zinc-600 w-full" />
                        </td>
                        <td className="py-2 text-right">
                          <input type="number" value={a.value}
                            onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, value: +e.target.value } : x))}
                            className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 tabular-nums text-right" />
                        </td>
                        <td className="py-2 pl-4">
                          <select value={a.type}
                            onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, type: e.target.value as Asset["type"] } : x))}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                            {["property", "investment", "insurance", "retirement", "cash", "other"].map((t) => (
                              <option key={t} value={t} className="capitalize">{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2">
                          <input value={a.beneficiary} placeholder="Name or Estate"
                            onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, beneficiary: e.target.value } : x))}
                            className="bg-transparent text-zinc-300 text-xs focus:outline-none placeholder:text-zinc-600 w-full" />
                        </td>
                        <td className="py-2">
                          <select value={a.titling}
                            onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, titling: e.target.value } : x))}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                            {TITLING_OPTIONS.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2">
                          <button onClick={() => removeAsset(a.id)} className="text-zinc-600 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {assets.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <input value={a.name} placeholder="Asset name"
                        onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                        className="bg-transparent text-zinc-200 text-sm font-medium focus:outline-none placeholder:text-zinc-600" />
                      <button onClick={() => removeAsset(a.id)} className="text-zinc-600 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input type="number" value={a.value}
                        onChange={(e) => setAssets((prev) => prev.map((x) => x.id === a.id ? { ...x, value: +e.target.value } : x))}
                        className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 tabular-nums" />
                      <span className="px-2 py-1 rounded text-[10px] capitalize" style={{ background: `${ASSET_COLORS[a.type]}20`, color: ASSET_COLORS[a.type] }}>
                        {a.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Checklist ───────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.45}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Estate Readiness Checklist</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checklistItems.map((item) => (
                  <label key={item.key} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                    <input type="checkbox" checked={checklist[item.key]}
                      onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-zinc-600 text-vela-teal focus:ring-vela-teal bg-zinc-900 accent-vela-teal" />
                    <span className={`text-sm ${checklist[item.key] ? "text-zinc-300 line-through" : "text-zinc-200"}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Info ─────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-sm text-zinc-400">
            <p className="font-medium text-amber-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Estate Planning Notes
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>2024 federal estate tax exemption: {formatCurrency(FEDERAL_EXEMPTION)} per individual ({formatCurrency(FEDERAL_EXEMPTION * 2)} for married couples)</li>
              <li>Assets in joint tenancy or with beneficiary designations bypass probate</li>
              <li>Revocable trusts avoid probate and provide privacy but don&apos;t reduce estate taxes</li>
              <li>Irrevocable trusts can reduce estate taxes but you give up control of assets</li>
              <li>Review beneficiary designations after major life events (marriage, divorce, birth)</li>
              <li>This is educational only — consult an estate planning attorney for your specific situation</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
