"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Receipt, DollarSign, TrendingDown, Percent, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── tax tables (2024) ──────────────────────────────────────── */

const FED_BRACKETS = [
  { min: 0, max: 11_600, rate: 0.10 },
  { min: 11_600, max: 47_150, rate: 0.12 },
  { min: 47_150, max: 100_525, rate: 0.22 },
  { min: 100_525, max: 191_950, rate: 0.24 },
  { min: 191_950, max: 243_725, rate: 0.32 },
  { min: 243_725, max: 609_350, rate: 0.35 },
  { min: 609_350, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION = 14_600;
const SS_WAGE_CAP = 168_600;
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const MEDICARE_SURTAX_RATE = 0.009;
const MEDICARE_SURTAX_THRESHOLD = 200_000;
const NIIT_RATE = 0.038;
const NIIT_THRESHOLD = 200_000;

const LTCG_BRACKETS = [
  { min: 0, max: 47_025, rate: 0.00 },
  { min: 47_025, max: 518_900, rate: 0.15 },
  { min: 518_900, max: Infinity, rate: 0.20 },
];

const STATE_TAX_RATES: { label: string; rate: number }[] = [
  { label: "None (FL, TX, NV...)", rate: 0 },
  { label: "Low (~3%)", rate: 0.03 },
  { label: "Medium (~5%)", rate: 0.05 },
  { label: "High (~8%)", rate: 0.08 },
  { label: "Very High (~10%)", rate: 0.10 },
  { label: "CA (~13.3%)", rate: 0.133 },
];

/* ── compute ────────────────────────────────────────────────── */

function computeProgressiveTax(income: number, brackets: typeof FED_BRACKETS) {
  let tax = 0;
  const breakdown: { bracket: string; tax: number; income: number; rate: number }[] = [];

  for (const b of brackets) {
    if (income <= b.min) break;
    const taxable = Math.min(income, b.max) - b.min;
    const t = taxable * b.rate;
    tax += t;
    if (taxable > 0) {
      breakdown.push({
        bracket: `${(b.rate * 100).toFixed(0)}%`,
        tax: t,
        income: taxable,
        rate: b.rate,
      });
    }
  }
  return { tax, breakdown };
}

interface TaxResult {
  grossIncome: number;
  agi: number;
  taxableIncome: number;
  fedIncomeTax: number;
  fedBreakdown: { bracket: string; tax: number; income: number; rate: number }[];
  ssTax: number;
  medicareTax: number;
  medicareSurtax: number;
  niit: number;
  ltcgTax: number;
  stateTax: number;
  totalFederal: number;
  totalAll: number;
  effectiveRate: number;
  marginalRate: number;
  takeHome: number;
  pieData: { name: string; value: number; fill: string }[];
}

function computeTax(
  wageIncome: number,
  investmentIncome: number,
  ltcg: number,
  deductions: number,
  stateRate: number,
  retirement401k: number,
  hsaContribution: number,
): TaxResult {
  const grossIncome = wageIncome + investmentIncome + ltcg;
  const preTaxDeductions = retirement401k + hsaContribution;
  const agi = wageIncome - preTaxDeductions + investmentIncome + ltcg;
  const totalDeductions = Math.max(deductions, STANDARD_DEDUCTION);

  // Ordinary income
  const ordinaryTaxable = Math.max(0, wageIncome - preTaxDeductions + investmentIncome - totalDeductions);
  const { tax: fedIncomeTax, breakdown: fedBreakdown } = computeProgressiveTax(ordinaryTaxable, FED_BRACKETS);

  // LTCG
  const ltcgTaxable = Math.max(0, ltcg);
  const { tax: ltcgTax } = computeProgressiveTax(ltcgTaxable, LTCG_BRACKETS);

  // FICA
  const ssWages = Math.min(wageIncome, SS_WAGE_CAP);
  const ssTax = ssWages * SS_RATE;
  const medicareTax = wageIncome * MEDICARE_RATE;
  const medicareSurtax = Math.max(0, wageIncome - MEDICARE_SURTAX_THRESHOLD) * MEDICARE_SURTAX_RATE;

  // NIIT
  const niit = agi > NIIT_THRESHOLD ? Math.min(investmentIncome + ltcg, agi - NIIT_THRESHOLD) * NIIT_RATE : 0;

  // State
  const stateTax = agi * stateRate;

  // Totals
  const totalFederal = fedIncomeTax + ltcgTax + ssTax + medicareTax + medicareSurtax + niit;
  const totalAll = totalFederal + stateTax;
  const effectiveRate = grossIncome > 0 ? (totalAll / grossIncome) * 100 : 0;

  // Marginal
  const marginalBracket = FED_BRACKETS.find((b) => ordinaryTaxable >= b.min && ordinaryTaxable < b.max);
  const marginalRate = (marginalBracket?.rate ?? 0.37) * 100;

  const takeHome = grossIncome - totalAll;

  const pieData = [
    { name: "Take Home", value: takeHome, fill: "#14b8a6" },
    { name: "Federal Income", value: fedIncomeTax, fill: "#f59e0b" },
    { name: "FICA", value: ssTax + medicareTax + medicareSurtax, fill: "#ef4444" },
    { name: "Capital Gains", value: ltcgTax + niit, fill: "#8b5cf6" },
    { name: "State", value: stateTax, fill: "#3b82f6" },
  ].filter((d) => d.value > 0);

  return {
    grossIncome, agi, taxableIncome: ordinaryTaxable, fedIncomeTax, fedBreakdown,
    ssTax, medicareTax, medicareSurtax, niit, ltcgTax, stateTax,
    totalFederal, totalAll, effectiveRate, marginalRate, takeHome, pieData,
  };
}

/* ── component ──────────────────────────────────────────────── */

export default function TaxProjectionPage() {
  const [wageIncome, setWageIncome] = useState(120_000);
  const [investmentIncome, setInvestmentIncome] = useState(5_000);
  const [ltcg, setLtcg] = useState(15_000);
  const [deductions, setDeductions] = useState(0);
  const [stateIdx, setStateIdx] = useState(0);
  const [retirement401k, setRetirement401k] = useState(23_000);
  const [hsaContribution, setHsaContribution] = useState(4_150);

  const result = useMemo(
    () => computeTax(wageIncome, investmentIncome, ltcg, deductions, STATE_TAX_RATES[stateIdx].rate, retirement401k, hsaContribution),
    [wageIncome, investmentIncome, ltcg, deductions, stateIdx, retirement401k, hsaContribution],
  );

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Tax Projection</h1>
          <p className="text-zinc-400 text-sm mt-1">Estimate your annual federal & state tax liability</p>
        </div>

        {/* ── Income Inputs ───────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5 space-y-5">
            <h3 className="text-sm font-medium text-zinc-300">Income</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-zinc-400">W-2 / Salary Income</label>
                <input type="number" value={wageIncome} onChange={(e) => setWageIncome(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Investment Income (dividends, interest)</label>
                <input type="number" value={investmentIncome} onChange={(e) => setInvestmentIncome(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Long-Term Capital Gains</label>
                <input type="number" value={ltcg} onChange={(e) => setLtcg(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
            </div>

            <h3 className="text-sm font-medium text-zinc-300 pt-2">Deductions & Pre-Tax</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-zinc-400">Itemized Deductions</label>
                <input type="number" value={deductions} onChange={(e) => setDeductions(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
                <p className="text-[10px] text-zinc-500 mt-1">Standard: {formatCurrency(STANDARD_DEDUCTION)}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400">401(k) Contribution</label>
                <input type="number" value={retirement401k} onChange={(e) => setRetirement401k(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
                <p className="text-[10px] text-zinc-500 mt-1">Max: $23,000</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400">HSA Contribution</label>
                <input type="number" value={hsaContribution} onChange={(e) => setHsaContribution(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
                <p className="text-[10px] text-zinc-500 mt-1">Max: $4,150 (self)</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400">State Tax</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {STATE_TAX_RATES.map((s, i) => (
                    <button key={s.label} onClick={() => setStateIdx(i)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        stateIdx === i
                          ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FloatingCard>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                TOTAL TAX
              </div>
              <p className="text-2xl font-display font-bold text-rose-400 tabular-nums">{formatCurrency(result.totalAll)}</p>
              <p className="text-xs text-zinc-500 mt-1">Federal + State + FICA</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Percent className="w-3.5 h-3.5 text-vela-teal" />
                EFFECTIVE RATE
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{result.effectiveRate.toFixed(1)}%</p>
              <p className="text-xs text-zinc-500 mt-1">Marginal: {result.marginalRate.toFixed(0)}%</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                TAKE HOME
              </div>
              <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(result.takeHome)}</p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(result.takeHome / 12)}/month</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.25}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Receipt className="w-3.5 h-3.5 text-sky-400" />
                TAX SAVINGS
              </div>
              <p className="text-2xl font-display font-bold text-sky-400 tabular-nums">
                {formatCurrency((retirement401k + hsaContribution) * (result.marginalRate / 100))}
              </p>
              <p className="text-xs text-zinc-500 mt-1">From pre-tax deductions</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Charts Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie */}
          <RevealOnScroll>
            <FloatingCard delay={0.3}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Income Breakdown</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={result.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                        stroke="#09090b" strokeWidth={2}>
                        {result.pieData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {result.pieData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>

          {/* Bracket Chart */}
          <RevealOnScroll>
            <FloatingCard delay={0.35}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Federal Tax by Bracket</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.fedBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="bracket" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip cursor={false}
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number, name: string) => [formatCurrency(v), name === "tax" ? "Tax" : "Income in Bracket"]}
                      />
                      <Bar dataKey="income" fill="#3f3f46" radius={[4, 4, 0, 0]} name="Income in Bracket" />
                      <Bar dataKey="tax" fill="#f59e0b" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="Tax" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── Detailed Breakdown ──────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.4}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Tax Detail</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {[
                  { label: "Gross Income", value: result.grossIncome },
                  { label: "Pre-Tax Deductions", value: -(retirement401k + hsaContribution), color: "text-emerald-400" },
                  { label: "AGI", value: result.agi },
                  { label: `Deduction (${deductions > STANDARD_DEDUCTION ? "itemized" : "standard"})`, value: -Math.max(deductions, STANDARD_DEDUCTION), color: "text-emerald-400" },
                  { label: "Taxable Ordinary Income", value: result.taxableIncome },
                  { divider: true },
                  { label: "Federal Income Tax", value: result.fedIncomeTax, color: "text-rose-400" },
                  { label: "LTCG Tax", value: result.ltcgTax, color: "text-rose-400" },
                  { label: "Social Security (6.2%)", value: result.ssTax, color: "text-rose-400" },
                  { label: "Medicare (1.45%)", value: result.medicareTax, color: "text-rose-400" },
                  ...(result.medicareSurtax > 0 ? [{ label: "Medicare Surtax (0.9%)", value: result.medicareSurtax, color: "text-rose-400" }] : []),
                  ...(result.niit > 0 ? [{ label: "NIIT (3.8%)", value: result.niit, color: "text-rose-400" }] : []),
                  ...(result.stateTax > 0 ? [{ label: `State Tax (${(STATE_TAX_RATES[stateIdx].rate * 100).toFixed(1)}%)`, value: result.stateTax, color: "text-rose-400" }] : []),
                  { divider: true },
                  { label: "Total Tax", value: result.totalAll, color: "text-rose-400", bold: true },
                  { label: "Take Home", value: result.takeHome, color: "text-emerald-400", bold: true },
                ].map((row, i) =>
                  "divider" in row ? (
                    <div key={i} className="col-span-full border-t border-zinc-800 my-1" />
                  ) : (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className={`text-zinc-400 ${row.bold ? "font-medium text-zinc-200" : ""}`}>{row.label}</span>
                      <span className={`tabular-nums ${row.color ?? "text-zinc-200"} ${row.bold ? "font-semibold" : ""}`}>
                        {formatCurrency(Math.abs(row.value as number))}{(row.value as number) < 0 ? " saved" : ""}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Info ─────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-sm text-zinc-400">
            <p className="font-medium text-amber-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Disclaimer
            </p>
            <p className="text-xs">
              This is an estimate for educational purposes only. Actual tax liability depends on filing status,
              credits, AMT, state-specific rules, and other factors. Consult a tax professional for accurate projections.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
