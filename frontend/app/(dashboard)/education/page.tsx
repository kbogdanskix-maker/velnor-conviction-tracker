"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { GraduationCap, DollarSign, TrendingUp, Calendar, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── constants ──────────────────────────────────────────────── */

const SCHOOL_COSTS: { label: string; annual: number }[] = [
  { label: "Public In-State", annual: 22_700 },
  { label: "Public Out-of-State", annual: 40_600 },
  { label: "Private University", annual: 56_200 },
  { label: "Community College", annual: 11_600 },
  { label: "Trade / Vocational", annual: 17_000 },
];

const INFLATION_RATE = 0.05; // education inflation ~5%

/* ── compute ────────────────────────────────────────────────── */

interface ProjectionPoint {
  year: number;
  age: number;
  balance: number;
  contributions: number;
  cost: number | null;
}

function projectEducation(
  childAge: number,
  currentSavings: number,
  monthlyContribution: number,
  expectedReturn: number,
  annualCost: number,
  yearsOfSchool: number,
) {
  const collegeStartAge = 18;
  const yearsUntilCollege = Math.max(0, collegeStartAge - childAge);
  const data: ProjectionPoint[] = [];
  let balance = currentSavings;
  let totalContributions = currentSavings;
  const monthlyReturn = expectedReturn / 100 / 12;

  // Growth phase
  for (let y = 0; y <= yearsUntilCollege + yearsOfSchool; y++) {
    const age = childAge + y;
    const inCollege = age >= collegeStartAge && age < collegeStartAge + yearsOfSchool;
    const inflatedCost = annualCost * Math.pow(1 + INFLATION_RATE, y);

    if (inCollege) {
      balance -= inflatedCost;
      data.push({ year: new Date().getFullYear() + y, age, balance: Math.max(0, balance), contributions: totalContributions, cost: inflatedCost });
    } else if (age < collegeStartAge) {
      // Accumulation
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyReturn) + monthlyContribution;
        totalContributions += monthlyContribution;
      }
      data.push({ year: new Date().getFullYear() + y, age, balance, contributions: totalContributions, cost: null });
    }
  }

  // Total cost at enrollment
  let totalCost = 0;
  for (let y = 0; y < yearsOfSchool; y++) {
    totalCost += annualCost * Math.pow(1 + INFLATION_RATE, yearsUntilCollege + y);
  }

  const finalBalance = data[data.length - 1]?.balance ?? 0;
  const funded = totalCost > 0 ? Math.min(100, ((balance > 0 ? data.find((d) => d.cost !== null)?.balance ?? currentSavings : currentSavings) + totalContributions) / totalCost * 100) : 0;

  // Better funded calc: balance at college start
  const balanceAtStart = data.find((d) => d.age === collegeStartAge)?.balance ?? 0;
  const fundedPct = totalCost > 0 ? Math.min(100, (balanceAtStart / totalCost) * 100) : 0;

  // Monthly needed to fully fund
  const deficit = Math.max(0, totalCost - currentSavings * Math.pow(1 + expectedReturn / 100, yearsUntilCollege));
  const fvFactor = yearsUntilCollege > 0
    ? ((Math.pow(1 + monthlyReturn, yearsUntilCollege * 12) - 1) / monthlyReturn)
    : 1;
  const monthlyNeeded = fvFactor > 0 ? deficit / fvFactor : 0;

  return {
    data,
    totalCost,
    balanceAtStart,
    fundedPct,
    monthlyNeeded: Math.max(0, monthlyNeeded),
    yearsUntilCollege,
    shortfall: Math.max(0, totalCost - balanceAtStart),
  };
}

/* ── component ──────────────────────────────────────────────── */

export default function EducationPage() {
  const [childAge, setChildAge] = useState(5);
  const [currentSavings, setCurrentSavings] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [schoolType, setSchoolType] = useState(0); // index into SCHOOL_COSTS
  const [yearsOfSchool, setYearsOfSchool] = useState(4);

  const annualCost = SCHOOL_COSTS[schoolType].annual;

  const result = useMemo(
    () => projectEducation(childAge, currentSavings, monthlyContribution, expectedReturn, annualCost, yearsOfSchool),
    [childAge, currentSavings, monthlyContribution, expectedReturn, annualCost, yearsOfSchool],
  );

  const { data, totalCost, balanceAtStart, fundedPct, monthlyNeeded, yearsUntilCollege, shortfall } = result;

  // Cost comparison across school types
  const costComparison = SCHOOL_COSTS.map((s) => {
    let cost = 0;
    for (let y = 0; y < yearsOfSchool; y++) {
      cost += s.annual * Math.pow(1 + INFLATION_RATE, yearsUntilCollege + y);
    }
    return { name: s.label, cost };
  });

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Education Planning</h1>
          <p className="text-zinc-400 text-sm mt-1">529 savings projections & college cost planning</p>
        </div>

        {/* ── Controls ────────────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Child&apos;s Age</label>
                <input type="range" min={0} max={17} value={childAge} onChange={(e) => setChildAge(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>0</span>
                  <span className="text-zinc-200 font-medium">{childAge} years</span>
                  <span>17</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Current Savings</label>
                <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(+e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Monthly Contribution</label>
                <input type="range" min={0} max={2000} step={25} value={monthlyContribution} onChange={(e) => setMonthlyContribution(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>$0</span>
                  <span className="text-zinc-200 font-medium">{formatCurrency(monthlyContribution)}/mo</span>
                  <span>$2K</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Expected Return</label>
                <input type="range" min={1} max={12} step={0.5} value={expectedReturn} onChange={(e) => setExpectedReturn(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>1%</span>
                  <span className="text-zinc-200 font-medium">{expectedReturn}%</span>
                  <span>12%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-2">
                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">School Type</label>
                <div className="flex flex-wrap gap-2">
                  {SCHOOL_COSTS.map((s, i) => (
                    <button key={s.label} onClick={() => setSchoolType(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        schoolType === i
                          ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Years of School</label>
                <input type="range" min={1} max={6} value={yearsOfSchool} onChange={(e) => setYearsOfSchool(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>1</span>
                  <span className="text-zinc-200 font-medium">{yearsOfSchool} years</span>
                  <span>6</span>
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
                TOTAL COST
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalCost)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {formatCurrency(annualCost)}/yr today × {yearsOfSchool}yr + {(INFLATION_RATE * 100).toFixed(0)}% inflation
              </p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                PROJECTED SAVINGS
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${balanceAtStart >= totalCost ? "text-emerald-400" : "text-zinc-100"}`}>
                {formatCurrency(balanceAtStart)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">At enrollment (age 18)</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.3}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                FUNDED
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${
                fundedPct >= 100 ? "text-emerald-400" : fundedPct >= 75 ? "text-amber-400" : "text-rose-400"
              }`}>
                {fundedPct.toFixed(0)}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    fundedPct >= 100 ? "bg-emerald-400" : fundedPct >= 75 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${Math.min(100, fundedPct)}%` }}
                />
              </div>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.4}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Calendar className="w-3.5 h-3.5" />
                {shortfall > 0 ? "MONTHLY NEEDED" : "ON TRACK"}
              </div>
              {shortfall > 0 ? (
                <>
                  <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(monthlyNeeded)}/mo</p>
                  <p className="text-xs text-zinc-500 mt-1">To fully fund by age 18</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-display font-bold text-emerald-400">✓</p>
                  <p className="text-xs text-zinc-500 mt-1">Savings exceed projected costs</p>
                </>
              )}
            </div>
          </FloatingCard>
        </div>

        {/* ── Projection Chart ────────────────────────────────── */}
        {data.length > 0 && (
          <RevealOnScroll>
            <FloatingCard delay={0.5}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Savings Projection</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="eduGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        label={{ value: "Child's Age", fill: "#52525b", fontSize: 10, position: "insideBottomRight", offset: -5 }} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        labelFormatter={(v) => `Age ${v}`}
                        formatter={(v: number, name: string) => [formatCurrency(v), name === "balance" ? "Balance" : name === "contributions" ? "Contributions" : "Cost"]}
                      />
                      <ReferenceLine x={18} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "College Starts", fill: "#f59e0b", fontSize: 10 }} />
                      <Area type="monotone" dataKey="contributions" stroke="#52525b" strokeDasharray="4 4" fill="none" />
                      <Area type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} fill="url(#eduGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        )}

        {/* ── Cost Comparison ─────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.6}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Cost Comparison (inflation-adjusted)</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costComparison} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip cursor={false}
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), "Total Cost"]}
                    />
                    <Bar dataKey="cost" fill="#38bdf8" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Based on {yearsOfSchool}-year program starting in {yearsUntilCollege} years with {(INFLATION_RATE * 100).toFixed(0)}% annual education inflation.
              </p>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── 529 Plan Info ────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/10 text-sm text-zinc-400">
            <p className="font-medium text-sky-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> 529 Plan Benefits
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>Tax-free growth and withdrawals for qualified education expenses</li>
              <li>Many states offer tax deductions for contributions</li>
              <li>High contribution limits (typically $300K+ lifetime per beneficiary)</li>
              <li>Can be used for K-12 tuition (up to $10K/year), college, and student loan repayment (up to $10K lifetime)</li>
              <li>Unused funds can be transferred to other family members or rolled into a Roth IRA (SECURE 2.0)</li>
              <li>No income restrictions for contributors</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
