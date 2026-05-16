"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { ArrowRightLeft, DollarSign, TrendingUp, Percent, Info, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── tax tables 2024 ────────────────────────────────────────── */

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

/* ── compute ────────────────────────────────────────────────── */

function progressiveTax(income: number): number {
  let tax = 0;
  for (const b of FED_BRACKETS) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

function marginalRate(income: number): number {
  for (let i = FED_BRACKETS.length - 1; i >= 0; i--) {
    if (income > FED_BRACKETS[i].min) return FED_BRACKETS[i].rate;
  }
  return 0.10;
}

interface ConversionResult {
  year: number;
  age: number;
  traditionalBal: number;
  rothBal: number;
  conversionAmount: number;
  taxOnConversion: number;
  taxableIncome: number;
  marginalRate: number;
}

function simulateConversion(
  currentAge: number,
  retirementAge: number,
  traditionalBalance: number,
  rothBalance: number,
  otherIncome: number,
  annualConversion: number,
  expectedReturn: number,
  conversionYears: number,
) {
  const data: ConversionResult[] = [];
  let tradBal = traditionalBalance;
  let rothBal = rothBalance;
  const returnRate = expectedReturn / 100;
  const currentYear = new Date().getFullYear();

  for (let y = 0; y <= Math.max(conversionYears, retirementAge - currentAge); y++) {
    const age = currentAge + y;
    const converting = y < conversionYears;
    const convAmt = converting ? Math.min(annualConversion, tradBal) : 0;

    // Taxable income
    const taxableIncome = Math.max(0, otherIncome + convAmt - STANDARD_DEDUCTION);
    const taxOnConversion = converting ? progressiveTax(taxableIncome) - progressiveTax(Math.max(0, otherIncome - STANDARD_DEDUCTION)) : 0;
    const mRate = marginalRate(taxableIncome);

    data.push({
      year: currentYear + y,
      age,
      traditionalBal: tradBal,
      rothBal,
      conversionAmount: convAmt,
      taxOnConversion,
      taxableIncome,
      marginalRate: mRate,
    });

    // End-of-year growth
    tradBal = (tradBal - convAmt) * (1 + returnRate);
    rothBal = (rothBal + convAmt) * (1 + returnRate);
  }

  return data;
}

function simulateNoConversion(
  currentAge: number,
  retirementAge: number,
  traditionalBalance: number,
  rothBalance: number,
  expectedReturn: number,
) {
  const data: { age: number; traditionalBal: number; rothBal: number }[] = [];
  let tradBal = traditionalBalance;
  let rothBal = rothBalance;
  const returnRate = expectedReturn / 100;

  for (let y = 0; y <= retirementAge - currentAge; y++) {
    data.push({ age: currentAge + y, traditionalBal: tradBal, rothBal });
    tradBal *= 1 + returnRate;
    rothBal *= 1 + returnRate;
  }
  return data;
}

/* ── component ──────────────────────────────────────────────── */

export default function RothConversionPage() {
  const [currentAge, setCurrentAge] = useState(45);
  const [retirementAge, setRetirementAge] = useState(65);
  const [traditionalBalance, setTraditionalBalance] = useState(500_000);
  const [rothBalance, setRothBalance] = useState(50_000);
  const [otherIncome, setOtherIncome] = useState(60_000);
  const [annualConversion, setAnnualConversion] = useState(40_000);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [conversionYears, setConversionYears] = useState(10);

  const withConversion = useMemo(
    () => simulateConversion(currentAge, retirementAge, traditionalBalance, rothBalance, otherIncome, annualConversion, expectedReturn, conversionYears),
    [currentAge, retirementAge, traditionalBalance, rothBalance, otherIncome, annualConversion, expectedReturn, conversionYears],
  );

  const withoutConversion = useMemo(
    () => simulateNoConversion(currentAge, retirementAge, traditionalBalance, rothBalance, expectedReturn),
    [currentAge, retirementAge, traditionalBalance, rothBalance, expectedReturn],
  );

  // Summary stats
  const totalTaxPaid = withConversion.reduce((s, d) => s + d.taxOnConversion, 0);
  const totalConverted = withConversion.reduce((s, d) => s + d.conversionAmount, 0);
  const retirementIdx = retirementAge - currentAge;
  const finalWithConv = withConversion[retirementIdx] ?? withConversion[withConversion.length - 1];
  const finalWithout = withoutConversion[withoutConversion.length - 1];

  const rothAtRetirement = finalWithConv?.rothBal ?? 0;
  const tradAtRetirementConverted = finalWithConv?.traditionalBal ?? 0;
  const tradAtRetirementNoConv = finalWithout?.traditionalBal ?? 0;
  const rothAtRetirementNoConv = finalWithout?.rothBal ?? 0;

  // Tax-free wealth advantage
  const taxFreeWealth = rothAtRetirement;
  const taxFreeWealthNoConv = rothAtRetirementNoConv;

  // Chart: combined balance comparison
  const comparisonData = withConversion
    .filter((_, i) => i <= retirementIdx)
    .map((d, i) => ({
      age: d.age,
      withConvRoth: d.rothBal,
      withConvTrad: d.traditionalBal,
      withConvTotal: d.rothBal + d.traditionalBal,
      noConvTotal: (withoutConversion[i]?.traditionalBal ?? 0) + (withoutConversion[i]?.rothBal ?? 0),
    }));

  // Tax bracket fill chart
  const bracketData = withConversion.filter((d) => d.conversionAmount > 0).map((d) => ({
    age: d.age,
    tax: d.taxOnConversion,
    rate: d.marginalRate * 100,
    converted: d.conversionAmount,
  }));

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Roth Conversion Planner</h1>
          <p className="text-zinc-400 text-sm mt-1">Model a Roth conversion ladder strategy to optimize tax-free retirement income</p>
        </div>

        {/* ── Controls ────────────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Current Age</label>
                <input type="range" min={25} max={70} value={currentAge} onChange={(e) => setCurrentAge(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>25</span><span className="text-zinc-200 font-medium">{currentAge}</span><span>70</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Retirement Age</label>
                <input type="range" min={currentAge + 1} max={80} value={retirementAge} onChange={(e) => setRetirementAge(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>{currentAge + 1}</span><span className="text-zinc-200 font-medium">{retirementAge}</span><span>80</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Traditional IRA Balance</label>
                <input type="number" value={traditionalBalance} onChange={(e) => setTraditionalBalance(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Roth IRA Balance</label>
                <input type="number" value={rothBalance} onChange={(e) => setRothBalance(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Other Income (W-2, SS, etc.)</label>
                <input type="number" value={otherIncome} onChange={(e) => setOtherIncome(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Annual Conversion</label>
                <input type="range" min={0} max={200_000} step={5_000} value={annualConversion} onChange={(e) => setAnnualConversion(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>$0</span><span className="text-zinc-200 font-medium">{formatCurrency(annualConversion)}/yr</span><span>$200K</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Conversion Period</label>
                <input type="range" min={1} max={20} value={conversionYears} onChange={(e) => setConversionYears(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>1</span><span className="text-zinc-200 font-medium">{conversionYears} years</span><span>20</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Expected Return</label>
                <input type="range" min={1} max={12} step={0.5} value={expectedReturn} onChange={(e) => setExpectedReturn(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>1%</span><span className="text-zinc-200 font-medium">{expectedReturn}%</span><span>12%</span>
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
                <ArrowRightLeft className="w-3.5 h-3.5 text-vela-teal" />
                TOTAL CONVERTED
              </div>
              <p className="text-2xl font-display font-bold text-vela-teal tabular-nums">{formatCurrency(totalConverted)}</p>
              <p className="text-xs text-zinc-500 mt-1">Over {conversionYears} years</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-rose-400" />
                TAX COST
              </div>
              <p className="text-2xl font-display font-bold text-rose-400 tabular-nums">{formatCurrency(totalTaxPaid)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Avg rate: {totalConverted > 0 ? ((totalTaxPaid / totalConverted) * 100).toFixed(1) : "0"}%
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ROTH AT RETIREMENT
              </div>
              <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(rothAtRetirement)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                vs {formatCurrency(taxFreeWealthNoConv)} without
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.25}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                TAX-FREE %
              </div>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">
                {((rothAtRetirement / (rothAtRetirement + tradAtRetirementConverted || 1)) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                of retirement assets
              </p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Balance Growth Chart ────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.3}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-1">Balance Projection</h2>
              <p className="text-xs text-zinc-500 mb-4">Roth (tax-free) vs Traditional (taxable) growth over time</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={comparisonData}>
                    <defs>
                      <linearGradient id="rothGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tradGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      labelFormatter={(v) => `Age ${v}`}
                      formatter={(v: number, name: string) => {
                        const labels: Record<string, string> = {
                          withConvRoth: "Roth (tax-free)",
                          withConvTrad: "Traditional",
                          noConvTotal: "No Conversion Total",
                        };
                        return [formatCurrency(v), labels[name] ?? name];
                      }}
                    />
                    <ReferenceLine x={currentAge + conversionYears} stroke="#71717a" strokeDasharray="4 4"
                      label={{ value: "Conv. ends", fill: "#71717a", fontSize: 10 }} />
                    <Area type="monotone" dataKey="withConvRoth" stroke="#14b8a6" strokeWidth={2} fill="url(#rothGrad)" stackId="conv" />
                    <Area type="monotone" dataKey="withConvTrad" stroke="#f59e0b" strokeWidth={1.5} fill="url(#tradGrad)" stackId="conv" />
                    <Area type="monotone" dataKey="noConvTotal" stroke="#71717a" strokeWidth={1} strokeDasharray="4 4" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-vela-teal inline-block rounded" /> Roth (tax-free)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Traditional</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-zinc-500 inline-block rounded border-dashed" /> No Conversion</span>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Annual Tax Impact ────────────────────────────────── */}
        {bracketData.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.35}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Annual Conversion Tax</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bracketData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip cursor={false}
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number, name: string) => [
                          name === "rate" ? `${v.toFixed(0)}%` : formatCurrency(v),
                          name === "tax" ? "Tax Owed" : name === "converted" ? "Converted" : "Marginal Rate",
                        ]}
                      />
                      <Bar dataKey="converted" fill="#3f3f46" radius={[4, 4, 0, 0]} name="Converted" />
                      <Bar dataKey="tax" fill="#ef4444" fillOpacity={0.6} radius={[4, 4, 0, 0]} name="Tax" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {/* ── Conversion Schedule Table ───────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.4}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Conversion Schedule</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-xs">
                      <th className="text-left pb-3 font-medium">Year</th>
                      <th className="text-left pb-3 font-medium">Age</th>
                      <th className="text-right pb-3 font-medium">Convert</th>
                      <th className="text-right pb-3 font-medium">Tax</th>
                      <th className="text-right pb-3 font-medium">Marginal</th>
                      <th className="text-right pb-3 font-medium hidden md:table-cell">Trad Bal</th>
                      <th className="text-right pb-3 font-medium hidden md:table-cell">Roth Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {withConversion.filter((d) => d.conversionAmount > 0).map((d) => (
                      <tr key={d.year}>
                        <td className="py-2 text-zinc-300 tabular-nums">{d.year}</td>
                        <td className="py-2 text-zinc-400 tabular-nums">{d.age}</td>
                        <td className="py-2 text-right text-vela-teal tabular-nums">{formatCurrency(d.conversionAmount)}</td>
                        <td className="py-2 text-right text-rose-400 tabular-nums">{formatCurrency(d.taxOnConversion)}</td>
                        <td className="py-2 text-right text-zinc-400 tabular-nums">{(d.marginalRate * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right text-zinc-300 tabular-nums hidden md:table-cell">{formatCurrency(d.traditionalBal)}</td>
                        <td className="py-2 text-right text-emerald-400 tabular-nums hidden md:table-cell">{formatCurrency(d.rothBal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Info ─────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/10 text-sm text-zinc-400">
            <p className="font-medium text-sky-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Roth Conversion Strategy
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>Converting in low-income years (early retirement, sabbatical) minimizes the tax hit</li>
              <li>Stay below the next tax bracket to optimize the effective rate on conversions</li>
              <li>Roth accounts have no Required Minimum Distributions (RMDs) — better for estate planning</li>
              <li>Converted amounts must season 5 years before penalty-free withdrawal (under 59½)</li>
              <li>Consider the impact on Medicare IRMAA surcharges (income thresholds at $103K+)</li>
              <li>Pay conversion taxes from taxable accounts, not the IRA itself, to maximize growth</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
