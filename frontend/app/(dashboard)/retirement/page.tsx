"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Umbrella, TrendingUp, DollarSign,
  AlertTriangle, CheckCircle2, Info, ArrowRight, Flame,
} from "lucide-react";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Simulation ────────────────────────────────────────────────────────

interface YearPoint { age: number; balance: number; withdrawal: number; }

function simulate(
  startBalance: number, annualWithdrawal: number, annualSS: number,
  returnRate: number, inflationRate: number,
  retireAge: number, ssStartAge: number, endAge: number,
): YearPoint[] {
  const pts: YearPoint[] = [];
  let bal = startBalance, expenses = annualWithdrawal, ss = annualSS;
  for (let age = retireAge; age <= endAge; age++) {
    const ssIncome = age >= ssStartAge ? ss : 0;
    const need = Math.max(0, expenses - ssIncome);
    const wd = Math.min(need, bal);
    pts.push({ age, balance: Math.round(bal), withdrawal: Math.round(wd) });
    bal = Math.max(0, bal - wd) * (1 + returnRate);
    expenses *= 1 + inflationRate;
    ss *= 1 + inflationRate;
  }
  return pts;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1.5">Age {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className={p.dataKey === "balance" ? "text-sky-400" : "text-zinc-400"}>
          {p.dataKey === "balance" ? "Portfolio" : "Annual withdrawal"}: {formatCompact(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

export default function RetirementPage() {
  const { summary: nwSummary, isLoading: nwLoading } = useNetWorthSummary();
  const { summary: cfSummary, isLoading: cfLoading } = useCashFlowSummary();
  const { profile } = useProfile();

  const [currentAge, setCurrentAge] = useState(profile.age);
  const [retireAge, setRetireAge] = useState(60);
  const [ssStartAge, setSsStartAge] = useState(67);
  const [annualSS, setAnnualSS] = useState(18000);
  const [returnRate, setReturnRate] = useState(6);
  const [inflationRate, setInflationRate] = useState(3);
  const [extraMonthly, setExtraMonthly] = useState(0);

  const loading = nwLoading || cfLoading;
  const startBalance = nwSummary?.net_worth ?? 0;
  const monthlyExpenses = cfSummary?.total_expenses ?? 0;
  const annualExpenses = monthlyExpenses * 12;
  const monthlySavings = cfSummary ? cfSummary.total_income - cfSummary.total_expenses : 0;
  const realReturn = returnRate - inflationRate;

  const balanceAtRetirement = useMemo(() => {
    const yearsToRetire = Math.max(0, retireAge - currentAge);
    const rr = realReturn / 100;
    const annualContrib = (monthlySavings + extraMonthly) * 12;
    let bal = startBalance;
    for (let y = 0; y < yearsToRetire; y++) bal = bal * (1 + rr) + annualContrib;
    return Math.max(0, bal);
  }, [startBalance, retireAge, realReturn, monthlySavings, extraMonthly]);

  // The whole projection is modeled in today's-dollar (real) terms: the
  // accumulation phase above grows at the real return, so the drawdown must too.
  // Pass the real return and a 0 inflation step (expenses/SS are already in real
  // dollars). Previously this grew the balance at the full nominal return while
  // inflating expenses, which mixed real and nominal units and let the nest egg
  // balloon unrealistically through retirement.
  const data = useMemo(() => simulate(
    balanceAtRetirement, annualExpenses, annualSS,
    realReturn / 100, 0,
    retireAge, ssStartAge, retireAge + 40,
  ), [balanceAtRetirement, annualExpenses, annualSS, realReturn, retireAge, ssStartAge]);

  const depletionAge = data.find((d) => d.balance === 0)?.age ?? null;
  const finalBalance = data[data.length - 1]?.balance ?? 0;
  const sustainableMonthly = balanceAtRetirement * (0.04 / 12);
  const canRetire = !depletionAge || depletionAge > retireAge + 30;

  if (loading) return <DashboardSkeleton />;
  const hasData = !!(nwSummary && cfSummary);

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Umbrella className="w-6 h-6 text-vela-teal" />
          Retirement Projection
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          How long does your money last if you retire at {retireAge}?
        </p>
      </div>

      {!hasData ? (
        <div className="vela-card text-center py-16 space-y-4">
          <Umbrella className="w-12 h-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400">Add your net worth and cash flow data first.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/net-worth" className="btn-primary text-sm inline-flex items-center gap-2">Net Worth <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/cash-flow" className="btn-primary text-sm inline-flex items-center gap-2">Cash Flow <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <FloatingCard glowColor="rgba(56,189,248,0.08)" tilt={false}>
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 py-2">
              <div className="flex flex-col items-center gap-1">
                {canRetire
                  ? <><CheckCircle2 className="w-10 h-10 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">On track</span></>
                  : <><AlertTriangle className="w-10 h-10 text-amber-400" /><span className="text-xs text-amber-400 font-medium">{depletionAge ? `Runs out at ${depletionAge}` : "Review needed"}</span></>
                }
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-center sm:text-left">
                <div>
                  <p className="text-xs text-zinc-500">Portfolio at {retireAge}</p>
                  <p className="text-lg font-display font-bold text-vela-teal tabular-nums">{formatCompact(balanceAtRetirement)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Lasts until</p>
                  <p className={`text-lg font-display font-bold tabular-nums ${canRetire ? "text-emerald-400" : "text-rose-400"}`}>
                    {depletionAge ? `Age ${depletionAge}` : `Age ${retireAge + 40}+`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Sustainable/mo (4%)</p>
                  <p className="text-lg font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(sustainableMonthly)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Current expenses/mo</p>
                  <p className="text-lg font-display font-bold text-zinc-300 tabular-nums">{formatCurrency(monthlyExpenses)}</p>
                </div>
              </div>
            </div>
          </FloatingCard>

          {/* Chart */}
          <RevealOnScroll>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Portfolio in Retirement</h2>
              <div className="h-[280px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(56,189,248)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="rgb(56,189,248)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39,39,42)" />
                    <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      label={{ value: "Age", position: "bottom", fill: "#52525b", fontSize: 11, offset: -5 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => formatCompact(v)} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine x={ssStartAge} stroke="rgb(251,191,36)" strokeDasharray="4 4"
                      label={{ value: "SS", position: "top", fill: "rgb(251,191,36)", fontSize: 10 }} />
                    {depletionAge && (
                      <ReferenceLine x={depletionAge} stroke="rgb(244,63,94)" strokeDasharray="4 4"
                        label={{ value: "Depleted", position: "top", fill: "rgb(244,63,94)", fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="balance" stroke="rgb(56,189,248)" strokeWidth={2} fill="url(#retGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </RevealOnScroll>

          {/* Parameters */}
          <RevealOnScroll delay={0.05}>
            <div className="vela-card">
              <div className="flex items-center gap-2 mb-5">
                <Info className="w-4 h-4 text-zinc-500" />
                <h2 className="section-heading !mb-0">Assumptions</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {([
                  { label: "Current age", value: currentAge, set: setCurrentAge, min: 18, max: 70, step: 1, suffix: "", desc: "Your age today (seeded from My Profile)" },
                  { label: "Retire at age", value: retireAge, set: setRetireAge, min: 40, max: 80, step: 1, suffix: "", desc: `${Math.max(0, retireAge - currentAge)} years of accumulation remaining` },
                  { label: "Social Security starts", value: ssStartAge, set: setSsStartAge, min: 62, max: 70, step: 1, suffix: "", desc: "Earlier = lower monthly benefit" },
                  { label: "SS monthly benefit", value: annualSS / 12, set: (v: number) => setAnnualSS(v * 12), min: 0, max: 5000, step: 100, suffix: "", isMoney: true, desc: "Estimated monthly Social Security" },
                  { label: "Expected return", value: returnRate, set: setReturnRate, min: 2, max: 12, step: 0.5, suffix: "%", desc: `Real return +${realReturn.toFixed(1)}% after inflation` },
                  { label: "Inflation", value: inflationRate, set: setInflationRate, min: 1, max: 6, step: 0.5, suffix: "%", desc: "Applied to expenses and SS COLA" },
                  { label: "Extra savings/mo", value: extraMonthly, set: setExtraMonthly, min: 0, max: 10000, step: 100, suffix: "", isMoney: true, desc: "Additional investing beyond current surplus" },
                ] as Array<{ label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; suffix: string; desc: string; isMoney?: boolean }>).map((s) => (
                  <div key={s.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="text-xs text-zinc-400 font-medium">{s.label}</label>
                      <span className="text-sm font-display font-bold text-zinc-200 tabular-nums">
                        {s.isMoney ? formatCurrency(s.value) : `${s.value}${s.suffix}`}
                      </span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="w-full accent-sky-500 h-1.5" />
                    <p className="text-[10px] text-zinc-600 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Insights */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">What This Means</h2>
              <div className="space-y-2">
                {(() => {
                  const ins: { type: "success" | "warning" | "info"; text: string }[] = [];

                  if (canRetire) {
                    ins.push({ type: "success", text: `At a 4% withdrawal rate your portfolio sustains ${formatCurrency(sustainableMonthly)}/mo - ${sustainableMonthly >= monthlyExpenses ? "comfortably covering" : "close to"} your current ${formatCurrency(monthlyExpenses)}/mo in expenses${annualSS > 0 ? `, plus ${formatCurrency(annualSS / 12)}/mo Social Security` : ""}.` });
                  } else if (depletionAge) {
                    ins.push({ type: "warning", text: `Portfolio runs out at age ${depletionAge}. Consider retiring later, increasing savings now, or reducing expenses. Even ${formatCurrency(200)}/mo more today significantly extends the runway.` });
                  }

                  if (annualSS > 0 && ssStartAge > retireAge) {
                    ins.push({ type: "info", text: `Social Security starts at ${ssStartAge} - your portfolio carries the full load for ${ssStartAge - retireAge} years first. The yellow line on the chart shows when that cushion kicks in.` });
                  }

                  if (finalBalance > balanceAtRetirement * 0.5) {
                    ins.push({ type: "success", text: `You are projected to have ${formatCompact(finalBalance)} remaining at age ${retireAge + 40}. You may have room to retire earlier or spend more - try adjusting the retirement age slider.` });
                  }

                  return ins.map((item, i) => {
                    const Icon = item.type === "success" ? CheckCircle2 : item.type === "warning" ? AlertTriangle : Info;
                    const cls = item.type === "success" ? "text-gain border-gain/20 bg-gain/5" : item.type === "warning" ? "text-amber-400 border-amber-400/20 bg-amber-400/5" : "text-teal-400 border-teal-400/20 bg-teal-400/5";
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg border ${cls}`}>
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-zinc-300">{item.text}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </RevealOnScroll>

          {/* Related */}
          <RevealOnScroll delay={0.15}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { href: "/fi", label: "FI Tracker", desc: "Track your path to financial independence", icon: Flame, hoverColor: "group-hover:bg-orange-500/10", iconColor: "group-hover:text-orange-400" },
                { href: "/monte-carlo", label: "Monte Carlo", desc: "Simulate thousands of market scenarios", icon: TrendingUp, hoverColor: "group-hover:bg-vela-teal/10", iconColor: "group-hover:text-vela-teal" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="vela-card group hover:border-zinc-600 transition-colors flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-zinc-800 ${link.hoverColor} transition-colors`}>
                    <link.icon className={`w-4 h-4 text-zinc-500 ${link.iconColor} transition-colors`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{link.label}</p>
                    <p className="text-xs text-zinc-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </Link>
              ))}
            </div>
          </RevealOnScroll>
        </>
      )}
    </PageTransition>
  );
}
