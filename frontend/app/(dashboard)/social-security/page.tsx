"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { Shield, Clock, TrendingUp, DollarSign, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── constants ──────────────────────────────────────────────── */

const BEND_POINTS_2024 = [1_174, 7_078]; // monthly PIA bend points
const FACTORS = [0.90, 0.32, 0.15];

// Claiming age adjustments (relative to FRA 67)
const CLAIMING_AGES = [
  { age: 62, label: "62 (earliest)", factor: 0.70 },
  { age: 63, label: "63", factor: 0.75 },
  { age: 64, label: "64", factor: 0.80 },
  { age: 65, label: "65", factor: 0.867 },
  { age: 66, label: "66", factor: 0.933 },
  { age: 67, label: "67 (FRA)", factor: 1.00 },
  { age: 68, label: "68", factor: 1.08 },
  { age: 69, label: "69", factor: 1.16 },
  { age: 70, label: "70 (max)", factor: 1.24 },
];

/* ── compute ────────────────────────────────────────────────── */

function computeAIME(averageAnnualEarnings: number): number {
  return averageAnnualEarnings / 12;
}

function computePIA(aime: number): number {
  let pia = 0;
  const brackets = [BEND_POINTS_2024[0], BEND_POINTS_2024[1] - BEND_POINTS_2024[0], Infinity];
  let remaining = aime;

  for (let i = 0; i < 3; i++) {
    const portion = Math.min(remaining, brackets[i]);
    pia += portion * FACTORS[i];
    remaining -= portion;
    if (remaining <= 0) break;
  }
  return pia;
}

function projectBenefits(
  currentAge: number,
  averageEarnings: number,
  cola: number,
) {
  const aime = computeAIME(averageEarnings);
  const basePIA = computePIA(aime);

  // For each claiming age, project cumulative benefits
  const yearsToAge = (target: number) => Math.max(0, target - currentAge);

  const claimingData = CLAIMING_AGES.map((ca) => {
    const monthlyBenefit = basePIA * ca.factor;
    const annualBenefit = monthlyBenefit * 12;

    // Cumulative by age (up to 95)
    const cumulative: { age: number; total: number }[] = [];
    let total = 0;
    for (let age = ca.age; age <= 95; age++) {
      const yearsCollecting = age - ca.age;
      const colaAdjusted = annualBenefit * Math.pow(1 + cola / 100, yearsCollecting);
      total += colaAdjusted;
      cumulative.push({ age, total });
    }

    return {
      ...ca,
      monthlyBenefit,
      annualBenefit,
      cumulative,
      breakEvenVs67: 0,
    };
  });

  // Compute break-even ages (vs FRA at 67)
  const fra = claimingData.find((c) => c.age === 67)!;
  claimingData.forEach((c) => {
    if (c.age === 67) return;
    const fraCum = fra.cumulative;
    const thisCum = c.cumulative;
    for (let i = 0; i < thisCum.length; i++) {
      const fraPoint = fraCum.find((f) => f.age === thisCum[i].age);
      if (fraPoint && c.age < 67 && thisCum[i].total < fraPoint.total && i > 0) {
        c.breakEvenVs67 = thisCum[i].age;
      }
      if (fraPoint && c.age > 67 && thisCum[i].total >= fraPoint.total) {
        c.breakEvenVs67 = thisCum[i].age;
        break;
      }
    }
  });

  // Build comparison chart data: cumulative for 62, 67, 70
  const compareAges = [62, 67, 70];
  const chartData: Record<string, number>[] = [];
  for (let age = 62; age <= 95; age++) {
    const point: Record<string, number> = { age };
    compareAges.forEach((ca) => {
      const cd = claimingData.find((c) => c.age === ca);
      const cp = cd?.cumulative.find((p) => p.age === age);
      point[`age${ca}`] = cp?.total ?? 0;
    });
    chartData.push(point);
  }

  return { basePIA, aime, claimingData, chartData };
}

/* ── component ──────────────────────────────────────────────── */

export default function SocialSecurityPage() {
  const [currentAge, setCurrentAge] = useState(35);
  const [averageEarnings, setAverageEarnings] = useState(85000);
  const [cola, setCola] = useState(2.5);

  const { basePIA, aime, claimingData, chartData } = useMemo(
    () => projectBenefits(currentAge, averageEarnings, cola),
    [currentAge, averageEarnings, cola],
  );

  const fra = claimingData.find((c) => c.age === 67)!;
  const early = claimingData.find((c) => c.age === 62)!;
  const delayed = claimingData.find((c) => c.age === 70)!;

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Social Security Estimator</h1>
          <p className="text-zinc-400 text-sm mt-1">Estimate benefits based on claiming age & earnings history</p>
        </div>

        {/* ── Controls ────────────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Current Age</label>
              <input type="range" min={25} max={69} value={currentAge} onChange={(e) => setCurrentAge(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>25</span>
                <span className="text-zinc-200 font-medium">{currentAge}</span>
                <span>69</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Average Annual Earnings (top 35 years)</label>
              <input type="number" value={averageEarnings} onChange={(e) => setAverageEarnings(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Annual COLA Assumption</label>
              <input type="range" min={0} max={5} step={0.5} value={cola} onChange={(e) => setCola(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>0%</span>
                <span className="text-zinc-200 font-medium">{cola}%</span>
                <span>5%</span>
              </div>
            </div>
          </div>
        </FloatingCard>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                PIA (FRA)
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(basePIA)}/mo</p>
              <p className="text-xs text-zinc-500 mt-1">AIME: {formatCurrency(aime)}/mo</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                EARLY (62)
              </div>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(early.monthlyBenefit)}/mo</p>
              <p className="text-xs text-zinc-500 mt-1">30% reduction from FRA</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-vela-teal" />
                FRA (67)
              </div>
              <p className="text-2xl font-display font-bold text-vela-teal tabular-nums">{formatCurrency(fra.monthlyBenefit)}/mo</p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(fra.annualBenefit)}/year</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.25}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                DELAYED (70)
              </div>
              <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(delayed.monthlyBenefit)}/mo</p>
              <p className="text-xs text-zinc-500 mt-1">24% increase from FRA</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Cumulative Comparison Chart ──────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.3}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-1">Cumulative Benefits by Claiming Age</h2>
              <p className="text-xs text-zinc-500 mb-4">Compare total lifetime benefits at ages 62, 67, and 70</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="ss62" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ss67" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ss70" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
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
                        const labels: Record<string, string> = { age62: "Claim at 62", age67: "Claim at 67", age70: "Claim at 70" };
                        return [formatCurrency(v), labels[name] ?? name];
                      }}
                    />
                    <Area type="monotone" dataKey="age62" stroke="#f59e0b" strokeWidth={2} fill="url(#ss62)" />
                    <Area type="monotone" dataKey="age67" stroke="#14b8a6" strokeWidth={2} fill="url(#ss67)" />
                    <Area type="monotone" dataKey="age70" stroke="#34d399" strokeWidth={2} fill="url(#ss70)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Age 62</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-vela-teal inline-block rounded" /> Age 67 (FRA)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" /> Age 70</span>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── All Claiming Ages Table ─────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.4}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Benefit by Claiming Age</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-xs">
                      <th className="text-left pb-3 font-medium">Claiming Age</th>
                      <th className="text-right pb-3 font-medium">Monthly</th>
                      <th className="text-right pb-3 font-medium">Annual</th>
                      <th className="text-right pb-3 font-medium">% of FRA</th>
                      <th className="text-right pb-3 font-medium hidden md:table-cell">Cumulative by 85</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {claimingData.map((c) => {
                      const cum85 = c.cumulative.find((p) => p.age === 85)?.total ?? 0;
                      const isFra = c.age === 67;
                      return (
                        <tr key={c.age} className={isFra ? "bg-vela-teal/5" : ""}>
                          <td className={`py-2.5 font-medium ${isFra ? "text-vela-teal" : "text-zinc-200"}`}>
                            {c.label}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-zinc-200">{formatCurrency(c.monthlyBenefit)}</td>
                          <td className="py-2.5 text-right tabular-nums text-zinc-300">{formatCurrency(c.annualBenefit)}</td>
                          <td className="py-2.5 text-right tabular-nums text-zinc-400">{(c.factor * 100).toFixed(0)}%</td>
                          <td className="py-2.5 text-right tabular-nums text-zinc-300 hidden md:table-cell">{formatCurrency(cum85)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Monthly Benefit Comparison Bar ───────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.5}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Monthly Benefit Comparison</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip cursor={false}
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), "Monthly Benefit"]}
                    />
                    <Bar dataKey="monthlyBenefit" radius={[4, 4, 0, 0]}>
                      {claimingData.map((c) => (
                        <Cell key={c.age} fill={c.age === 67 ? "#14b8a6" : c.age < 67 ? "#f59e0b" : "#34d399"} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Info ─────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/10 text-sm text-zinc-400">
            <p className="font-medium text-sky-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> How Benefits Are Calculated
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>AIME (Average Indexed Monthly Earnings) is based on your highest 35 years of earnings</li>
              <li>PIA uses a progressive formula: 90% of first ${BEND_POINTS_2024[0].toLocaleString()}, 32% up to ${BEND_POINTS_2024[1].toLocaleString()}, 15% above</li>
              <li>Claiming before FRA (67) permanently reduces benefits by up to 30%</li>
              <li>Delaying past FRA earns 8% per year up to age 70 (24% total increase)</li>
              <li>Benefits are adjusted annually for COLA (Cost of Living Adjustment)</li>
              <li>Spousal benefits can be up to 50% of the higher earner&apos;s PIA</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
