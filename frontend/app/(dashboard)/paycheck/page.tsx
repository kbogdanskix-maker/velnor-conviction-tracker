"use client";

import { useState, useMemo } from "react";
import {
  Banknote,
  Download,
} from "lucide-react";
import { exportCSV } from "@/lib/export";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

// ── Tax brackets (2024 US, single filer) ─────────────────────────────

const FEDERAL_BRACKETS = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION = 14600;
const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_CAP = 168600;
const MEDICARE_RATE = 0.0145;
const MEDICARE_ADDITIONAL_THRESHOLD = 200000;
const MEDICARE_ADDITIONAL_RATE = 0.009;

type Frequency = "annual" | "monthly" | "biweekly" | "weekly";

// ── Paycheck calculation ─────────────────────────────────────────────

interface PaycheckResult {
  grossAnnual: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  totalDeductions: number;
  preTaxDeductions: number;
  postTaxDeductions: number;
  netAnnual: number;
  netPeriod: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: { label: string; amount: number; color: string }[];
  bracketBreakdown: { bracket: string; amount: number; tax: number }[];
}

function calculatePaycheck(params: {
  grossAnnual: number;
  stateRate: number;
  retirement401k: number;
  hsaContribution: number;
  healthPremium: number;
  otherPreTax: number;
  frequency: Frequency;
}): PaycheckResult {
  const { grossAnnual, stateRate, retirement401k, hsaContribution, healthPremium, otherPreTax, frequency } = params;

  // Pre-tax deductions
  const preTaxDeductions = retirement401k + hsaContribution + healthPremium + otherPreTax;

  // Taxable income (after pre-tax deductions and standard deduction)
  const taxableIncome = Math.max(0, grossAnnual - preTaxDeductions - STANDARD_DEDUCTION);

  // Federal tax (progressive brackets)
  let federalTax = 0;
  let marginalRate = 0.10;
  const bracketBreakdown: PaycheckResult["bracketBreakdown"] = [];

  for (const bracket of FEDERAL_BRACKETS) {
    if (taxableIncome > bracket.min) {
      const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
      const tax = taxable * bracket.rate;
      federalTax += tax;
      marginalRate = bracket.rate;
      if (taxable > 0) {
        bracketBreakdown.push({
          bracket: `${(bracket.rate * 100).toFixed(0)}%`,
          amount: Math.round(taxable),
          tax: Math.round(tax),
        });
      }
    }
  }

  // State tax (flat rate approximation)
  const stateTax = Math.max(0, grossAnnual - preTaxDeductions - STANDARD_DEDUCTION) * (stateRate / 100);

  // FICA — Social Security
  const ssIncome = Math.min(grossAnnual, SOCIAL_SECURITY_CAP);
  const socialSecurity = ssIncome * SOCIAL_SECURITY_RATE;

  // FICA — Medicare
  let medicare = grossAnnual * MEDICARE_RATE;
  if (grossAnnual > MEDICARE_ADDITIONAL_THRESHOLD) {
    medicare += (grossAnnual - MEDICARE_ADDITIONAL_THRESHOLD) * MEDICARE_ADDITIONAL_RATE;
  }

  const totalDeductions = federalTax + stateTax + socialSecurity + medicare + preTaxDeductions;
  const netAnnual = grossAnnual - totalDeductions;
  const effectiveRate = grossAnnual > 0 ? ((federalTax + stateTax + socialSecurity + medicare) / grossAnnual) * 100 : 0;

  const periods: Record<Frequency, number> = { annual: 1, monthly: 12, biweekly: 26, weekly: 52 };
  const netPeriod = netAnnual / periods[frequency];

  const breakdown: PaycheckResult["breakdown"] = [
    { label: "Take-Home Pay", amount: netAnnual, color: "#14b8a6" },
    { label: "Federal Tax", amount: federalTax, color: "#3b82f6" },
    { label: "State Tax", amount: stateTax, color: "#8b5cf6" },
    { label: "Social Security", amount: socialSecurity, color: "#f59e0b" },
    { label: "Medicare", amount: medicare, color: "#ec4899" },
    { label: "Retirement (401k)", amount: retirement401k, color: "#10b981" },
    { label: "Health/HSA", amount: hsaContribution + healthPremium, color: "#06b6d4" },
  ].filter((d) => d.amount > 0);

  return {
    grossAnnual, taxableIncome, federalTax, stateTax, socialSecurity, medicare,
    totalDeductions, preTaxDeductions, postTaxDeductions: 0,
    netAnnual, netPeriod, effectiveRate, marginalRate, breakdown, bracketBreakdown,
  };
}

// ── Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; amount: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-200">{d.label}</p>
      <p className="text-teal-400 font-medium">{formatCurrency(d.amount)}</p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function PaycheckPage() {
  const [salary, setSalary] = useState(75000);
  const [stateRate, setStateRate] = useState(5);
  const [retirement, setRetirement] = useState(6000);
  const [hsa, setHsa] = useState(0);
  const [health, setHealth] = useState(200);
  const [otherPreTax, setOtherPreTax] = useState(0);
  const [frequency, setFrequency] = useState<Frequency>("biweekly");

  const result = useMemo(
    () => calculatePaycheck({
      grossAnnual: salary,
      stateRate,
      retirement401k: retirement,
      hsaContribution: hsa,
      healthPremium: health * 12,
      otherPreTax,
      frequency,
    }),
    [salary, stateRate, retirement, hsa, health, otherPreTax, frequency]
  );

  const freqLabel: Record<Frequency, string> = { annual: "year", monthly: "month", biweekly: "paycheck", weekly: "week" };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" />
            Paycheck Calculator
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Estimate your take-home pay after taxes and deductions
          </p>
        </div>
        <button
          onClick={() => exportCSV([{
            "Gross Annual": salary, "Taxable Income": result.taxableIncome,
            "Federal Tax": result.federalTax.toFixed(2), "State Tax": result.stateTax.toFixed(2),
            "Social Security": result.socialSecurity.toFixed(2), "Medicare": result.medicare.toFixed(2),
            "Pre-Tax Deductions": result.preTaxDeductions.toFixed(2),
            "Net Annual": result.netAnnual.toFixed(2), "Net Per Period": result.netPeriod.toFixed(2),
            "Effective Rate": `${result.effectiveRate.toFixed(1)}%`, "Marginal Rate": `${(result.marginalRate * 100).toFixed(0)}%`,
          }], `vela-paycheck-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Hero — take-home pay */}
      <FloatingCard glowColor="rgba(16, 185, 129, 0.10)" tilt={false}>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <div className="text-center sm:text-left">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Take-Home Pay</p>
            <p className="text-4xl font-display font-bold text-gain tabular-nums">{formatCurrency(result.netPeriod)}</p>
            <p className="text-sm text-zinc-500 mt-0.5">per {freqLabel[frequency]}</p>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 w-full">
            <div className="text-center sm:text-left">
              <p className="text-xs text-zinc-500">Net Annual</p>
              <p className="text-lg font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(result.netAnnual)}</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs text-zinc-500">Effective Rate</p>
              <p className="text-lg font-display font-bold text-amber-400 tabular-nums">{result.effectiveRate.toFixed(1)}%</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs text-zinc-500">Marginal Rate</p>
              <p className="text-lg font-display font-bold text-zinc-400 tabular-nums">{(result.marginalRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </FloatingCard>

      {/* Inputs + Breakdown */}
      <RevealOnScroll>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="vela-card">
            <h2 className="section-heading mb-4">Income & Deductions</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs text-zinc-400">Annual Salary</label>
                  <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(salary)}</span>
                </div>
                <input type="range" min={20000} max={500000} step={1000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs text-zinc-400">State Income Tax Rate</label>
                  <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">{stateRate}%</span>
                </div>
                <input type="range" min={0} max={13} step={0.5} value={stateRate} onChange={(e) => setStateRate(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs text-zinc-400">401(k) Contribution (Annual)</label>
                  <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(retirement)}</span>
                </div>
                <input type="range" min={0} max={23000} step={500} value={retirement} onChange={(e) => setRetirement(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs text-zinc-400">HSA Contribution (Annual)</label>
                  <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(hsa)}</span>
                </div>
                <input type="range" min={0} max={4150} step={100} value={hsa} onChange={(e) => setHsa(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs text-zinc-400">Health Insurance (Monthly)</label>
                  <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">{formatCurrency(health)}/mo</span>
                </div>
                <input type="range" min={0} max={1500} step={25} value={health} onChange={(e) => setHealth(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Pay Frequency</label>
                <div className="flex bg-zinc-800 rounded-lg p-1">
                  {(["biweekly", "monthly", "weekly", "annual"] as Frequency[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        frequency === f ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown chart */}
          <div className="vela-card">
            <h2 className="section-heading mb-4">Where Your Money Goes</h2>
            <div className="flex items-center gap-6">
              <div className="w-[140px] h-[140px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={result.breakdown} dataKey="amount" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                      {result.breakdown.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {result.breakdown.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-zinc-400 flex-1">{d.label}</span>
                    <span className="text-xs font-medium text-zinc-200 tabular-nums">{formatCurrency(d.amount)}</span>
                    <span className="text-[10px] text-zinc-600 tabular-nums w-10 text-right">
                      {salary > 0 ? ((d.amount / salary) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* Tax bracket breakdown */}
      <RevealOnScroll delay={0.05}>
        <div className="vela-card">
          <h2 className="section-heading mb-3">Federal Tax Brackets</h2>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.bracketBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                <XAxis dataKey="bracket" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} width={55} />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Bar dataKey="tax" radius={[4, 4, 0, 0]}>
                  {result.bracketBreakdown.map((_, i) => (
                    <Cell key={i} fill={`hsl(${220 + i * 20}, 70%, ${55 + i * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left py-1.5 font-medium">Bracket</th>
                  <th className="text-right py-1.5 font-medium">Taxable Income</th>
                  <th className="text-right py-1.5 font-medium">Tax Owed</th>
                </tr>
              </thead>
              <tbody>
                {result.bracketBreakdown.map((b) => (
                  <tr key={b.bracket} className="border-b border-zinc-800/50">
                    <td className="py-1.5 text-zinc-300 font-medium">{b.bracket}</td>
                    <td className="py-1.5 text-right text-zinc-400 tabular-nums">{formatCurrency(b.amount)}</td>
                    <td className="py-1.5 text-right text-blue-400 tabular-nums">{formatCurrency(b.tax)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1.5 text-zinc-200">Total</td>
                  <td className="py-1.5 text-right text-zinc-300 tabular-nums">{formatCurrency(result.taxableIncome)}</td>
                  <td className="py-1.5 text-right text-blue-400 tabular-nums">{formatCurrency(result.federalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </RevealOnScroll>

      {/* FICA detail */}
      <RevealOnScroll delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="vela-card">
            <h3 className="text-sm font-medium text-zinc-200 mb-3">FICA Taxes</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Social Security (6.2%)</span>
                <span className="text-sm font-medium text-amber-400 tabular-nums">{formatCurrency(result.socialSecurity)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Medicare (1.45%)</span>
                <span className="text-sm font-medium text-pink-400 tabular-nums">{formatCurrency(result.medicare)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-300 font-medium">Total FICA</span>
                <span className="text-sm font-bold text-zinc-200 tabular-nums">{formatCurrency(result.socialSecurity + result.medicare)}</span>
              </div>
            </div>
          </div>
          <div className="vela-card">
            <h3 className="text-sm font-medium text-zinc-200 mb-3">Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Gross Income</span>
                <span className="text-sm font-medium text-zinc-200 tabular-nums">{formatCurrency(salary)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Total Taxes</span>
                <span className="text-sm font-medium text-loss tabular-nums">
                  -{formatCurrency(result.federalTax + result.stateTax + result.socialSecurity + result.medicare)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Pre-Tax Deductions</span>
                <span className="text-sm font-medium text-zinc-400 tabular-nums">-{formatCurrency(result.preTaxDeductions)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-300 font-medium">Net Take-Home</span>
                <span className="text-sm font-bold text-gain tabular-nums">{formatCurrency(result.netAnnual)}</span>
              </div>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}
