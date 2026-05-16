"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, PieChart, Pie,
} from "recharts";
import { Wallet, DollarSign, TrendingDown, Clock, Shield, Info, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";

/* ── RMD table (Uniform Lifetime Table — IRS Publication 590-B) ── */

const RMD_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
  79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};

function getRmdFactor(age: number): number {
  if (age < 72) return 0;
  if (age > 100) return 5.2;
  return RMD_TABLE[age] ?? 10;
}

/* ── strategies ─────────────────────────────────────────────── */

type Strategy = "fixed" | "guardrails" | "bucket" | "rmd";

interface YearData {
  year: number;
  age: number;
  balance: number;
  withdrawal: number;
  rate: number;
  depleted: boolean;
}

function simulate(
  strategy: Strategy,
  startingBalance: number,
  annualExpenses: number,
  expectedReturn: number,
  inflation: number,
  startAge: number,
  endAge: number,
  fixedRate: number,
  socialSecurity: number,
): YearData[] {
  const data: YearData[] = [];
  let balance = startingBalance;
  const retRate = expectedReturn / 100;
  const infRate = inflation / 100;
  let currentExpenses = annualExpenses;
  let currentSS = socialSecurity;
  const ssStartAge = 67;

  for (let age = startAge; age <= endAge; age++) {
    if (balance <= 0) {
      data.push({ year: new Date().getFullYear() + (age - startAge), age, balance: 0, withdrawal: 0, rate: 0, depleted: true });
      continue;
    }

    const ssIncome = age >= ssStartAge ? currentSS : 0;
    const needFromPortfolio = Math.max(0, currentExpenses - ssIncome);
    let withdrawal = 0;

    switch (strategy) {
      case "fixed":
        withdrawal = balance * (fixedRate / 100);
        break;

      case "guardrails": {
        const baseWithdrawal = balance * (fixedRate / 100);
        const ceiling = currentExpenses * 1.2;
        const floor = currentExpenses * 0.8;
        withdrawal = Math.max(floor, Math.min(ceiling, baseWithdrawal));
        withdrawal = Math.min(withdrawal, needFromPortfolio * 1.1);
        break;
      }

      case "bucket":
        // Bucket: take from portfolio only what's needed beyond SS
        withdrawal = needFromPortfolio;
        break;

      case "rmd": {
        const factor = getRmdFactor(age);
        if (factor > 0 && age >= 72) {
          withdrawal = balance / factor;
        } else {
          withdrawal = needFromPortfolio;
        }
        break;
      }
    }

    withdrawal = Math.min(withdrawal, balance);
    const rate = balance > 0 ? (withdrawal / balance) * 100 : 0;

    data.push({
      year: new Date().getFullYear() + (age - startAge),
      age,
      balance,
      withdrawal,
      rate,
      depleted: false,
    });

    balance = (balance - withdrawal) * (1 + retRate);
    currentExpenses *= 1 + infRate;
    currentSS *= 1 + infRate; // COLA
  }

  return data;
}

/* ── component ──────────────────────────────────────────────── */

const STRATEGIES: { key: Strategy; label: string; desc: string }[] = [
  { key: "fixed", label: "Fixed %", desc: "Withdraw a fixed percentage of portfolio each year" },
  { key: "guardrails", label: "Guardrails", desc: "Flexible rate with ceiling and floor guardrails" },
  { key: "bucket", label: "Bucket", desc: "Only withdraw what expenses require beyond Social Security" },
  { key: "rmd", label: "RMD-Based", desc: "Follow IRS Required Minimum Distribution schedule" },
];

export default function WithdrawalPage() {
  const [startingBalance, setStartingBalance] = useState(1_500_000);
  const [annualExpenses, setAnnualExpenses] = useState(60_000);
  const [expectedReturn, setExpectedReturn] = useState(6);
  const [inflation, setInflation] = useState(3);
  const [startAge, setStartAge] = useState(65);
  const [endAge] = useState(95);
  const [fixedRate, setFixedRate] = useState(4);
  const [socialSecurity, setSocialSecurity] = useState(24_000);
  const [strategy, setStrategy] = useState<Strategy>("fixed");

  const data = useMemo(
    () => simulate(strategy, startingBalance, annualExpenses, expectedReturn, inflation, startAge, endAge, fixedRate, socialSecurity),
    [strategy, startingBalance, annualExpenses, expectedReturn, inflation, startAge, endAge, fixedRate, socialSecurity],
  );

  // Compare all strategies
  const comparison = useMemo(() => {
    return STRATEGIES.map((s) => {
      const sim = simulate(s.key, startingBalance, annualExpenses, expectedReturn, inflation, startAge, endAge, fixedRate, socialSecurity);
      const depletedAge = sim.find((d) => d.depleted)?.age ?? null;
      const totalWithdrawn = sim.reduce((acc, d) => acc + d.withdrawal, 0);
      const finalBalance = sim[sim.length - 1]?.balance ?? 0;
      const avgRate = sim.filter((d) => !d.depleted).reduce((s, d) => s + d.rate, 0) / sim.filter((d) => !d.depleted).length;
      return { ...s, depletedAge, totalWithdrawn, finalBalance, avgRate };
    });
  }, [startingBalance, annualExpenses, expectedReturn, inflation, startAge, endAge, fixedRate, socialSecurity]);

  const depletionAge = data.find((d) => d.depleted)?.age ?? null;
  const totalWithdrawn = data.reduce((s, d) => s + d.withdrawal, 0);
  const finalBalance = data[data.length - 1]?.balance ?? 0;
  const yearsOfIncome = data.filter((d) => !d.depleted).length;

  // Bucket allocation visualization
  const bucketData = [
    { name: "Cash (1-2yr)", value: Math.round(startingBalance * 0.1), fill: "#14b8a6" },
    { name: "Bonds (3-7yr)", value: Math.round(startingBalance * 0.35), fill: "#38bdf8" },
    { name: "Stocks (8yr+)", value: Math.round(startingBalance * 0.55), fill: "#a78bfa" },
  ];

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Withdrawal Strategy</h1>
          <p className="text-zinc-400 text-sm mt-1">Plan sustainable retirement income with multiple withdrawal strategies</p>
        </div>

        {/* ── Strategy Selector ────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5">
            <label className="text-xs text-zinc-400 font-medium mb-3 block">WITHDRAWAL STRATEGY</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STRATEGIES.map((s) => (
                <button key={s.key} onClick={() => setStrategy(s.key)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    strategy === s.key
                      ? "bg-vela-teal/10 border border-vela-teal/30 ring-1 ring-vela-teal/20"
                      : "bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600"
                  }`}>
                  <p className={`text-sm font-medium ${strategy === s.key ? "text-vela-teal" : "text-zinc-200"}`}>{s.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </FloatingCard>

        {/* ── Controls ────────────────────────────────────────── */}
        <FloatingCard delay={0.05}>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Starting Balance</label>
              <input type="number" value={startingBalance} onChange={(e) => setStartingBalance(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Annual Expenses</label>
              <input type="number" value={annualExpenses} onChange={(e) => setAnnualExpenses(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Social Security (/yr)</label>
              <input type="number" value={socialSecurity} onChange={(e) => setSocialSecurity(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Retirement Start Age</label>
              <input type="range" min={50} max={75} value={startAge} onChange={(e) => setStartAge(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>50</span><span className="text-zinc-200 font-medium">{startAge}</span><span>75</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Expected Return</label>
              <input type="range" min={1} max={10} step={0.5} value={expectedReturn} onChange={(e) => setExpectedReturn(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>1%</span><span className="text-zinc-200 font-medium">{expectedReturn}%</span><span>10%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Inflation</label>
              <input type="range" min={1} max={6} step={0.5} value={inflation} onChange={(e) => setInflation(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>1%</span><span className="text-zinc-200 font-medium">{inflation}%</span><span>6%</span>
              </div>
            </div>
            {(strategy === "fixed" || strategy === "guardrails") && (
              <div>
                <label className="text-xs text-zinc-400 font-medium">Withdrawal Rate</label>
                <input type="range" min={2} max={8} step={0.25} value={fixedRate} onChange={(e) => setFixedRate(+e.target.value)}
                  className="w-full mt-1 accent-vela-teal" />
                <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                  <span>2%</span><span className="text-zinc-200 font-medium">{fixedRate}%</span><span>8%</span>
                </div>
              </div>
            )}
          </div>
        </FloatingCard>

        {/* ── Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                LASTS UNTIL
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${depletionAge ? "text-rose-400" : "text-emerald-400"}`}>
                {depletionAge ? `Age ${depletionAge}` : `Age ${endAge}+`}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{yearsOfIncome} years of income</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                TOTAL WITHDRAWN
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalWithdrawn)}</p>
              <p className="text-xs text-zinc-500 mt-1">Over {yearsOfIncome} years</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                FINAL BALANCE
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${finalBalance > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(finalBalance)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">At age {endAge}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.25}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Shield className="w-3.5 h-3.5 text-vela-teal" />
                LEGACY
              </div>
              <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums">
                {finalBalance > startingBalance ? formatCurrency(finalBalance - startingBalance) : finalBalance > 0 ? formatCurrency(finalBalance) : "$0"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Remaining for heirs</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Balance + Withdrawal Chart ──────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.3}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Portfolio Balance Over Time</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.filter((d) => !d.depleted || d === data.find((x) => x.depleted))}>
                    <defs>
                      <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      labelFormatter={(v) => `Age ${v}`}
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "balance" ? "Balance" : "Withdrawal"]}
                    />
                    <ReferenceLine x={67} stroke="#f59e0b" strokeDasharray="4 4"
                      label={{ value: "SS starts", fill: "#f59e0b", fontSize: 10 }} />
                    {depletionAge && (
                      <ReferenceLine x={depletionAge} stroke="#ef4444" strokeDasharray="4 4"
                        label={{ value: "Depleted", fill: "#ef4444", fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} fill="url(#wdGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Annual Withdrawals Bar ──────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.35}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Annual Withdrawals</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.filter((d) => !d.depleted)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="age" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip cursor={false}
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "withdrawal" ? "Withdrawal" : `Rate: ${formatPercent(v, false)}`]}
                    />
                    <Bar dataKey="withdrawal" radius={[2, 2, 0, 0]}>
                      {data.filter((d) => !d.depleted).map((d, i) => (
                        <Cell key={i} fill={d.rate > 5 ? "#ef4444" : d.rate > 4 ? "#f59e0b" : "#14b8a6"} fillOpacity={0.6} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-vela-teal/60" /> &le;4% safe</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60" /> 4-5% caution</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60" /> &gt;5% high</span>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Strategy Comparison ─────────────────────────────── */}
          <RevealOnScroll>
            <FloatingCard delay={0.4}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Strategy Comparison</h2>
                <div className="space-y-3">
                  {comparison.map((c) => (
                    <div key={c.key} className={`p-3 rounded-lg border transition-colors ${
                      c.key === strategy ? "bg-vela-teal/5 border-vela-teal/20" : "bg-zinc-800/30 border-zinc-800"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${c.key === strategy ? "text-vela-teal" : "text-zinc-200"}`}>
                          {c.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          !c.depletedAge ? "bg-emerald-500/15 text-emerald-400" :
                          c.depletedAge > 90 ? "bg-amber-500/15 text-amber-400" :
                          "bg-rose-500/15 text-rose-400"
                        }`}>
                          {c.depletedAge ? `Runs out at ${c.depletedAge}` : "Survives 30yr+"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <p className="text-zinc-500">Total Withdrawn</p>
                          <p className="text-zinc-300 tabular-nums">{formatCurrency(c.totalWithdrawn)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Final Balance</p>
                          <p className="text-zinc-300 tabular-nums">{formatCurrency(c.finalBalance)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Avg Rate</p>
                          <p className="text-zinc-300 tabular-nums">{formatPercent(c.avgRate, false)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>

          {/* ── Bucket Strategy Allocation ─────────────────────── */}
          <RevealOnScroll>
            <FloatingCard delay={0.45}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-4">Bucket Allocation</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bucketData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={45} outerRadius={80} stroke="#09090b" strokeWidth={2}>
                        {bucketData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v), "Allocation"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3">
                  {bucketData.map((b) => (
                    <div key={b.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.fill }} />
                        {b.name}
                      </span>
                      <span className="text-zinc-400 tabular-nums">{formatCurrency(b.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-3">
                  Cash bucket covers 1-2 years of expenses. Bonds cover years 3-7. Stocks fund years 8+.
                  Replenish cash from bonds annually; bonds from stocks during up markets.
                </p>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── Tips ─────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/10 text-sm text-zinc-400">
            <p className="font-medium text-sky-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Withdrawal Planning Tips
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>The &quot;4% rule&quot; is a starting point, not gospel — adjust based on market conditions and health</li>
              <li>Guardrails strategy (Guyton-Klinger) adapts to market returns — cut spending 10% in bad years, raise 10% in good</li>
              <li>RMDs begin at 73 (SECURE 2.0) — consider Roth conversions before then to reduce future RMDs</li>
              <li>Sequence of returns risk is highest in the first 5-10 years of retirement</li>
              <li>Consider holding 2+ years of cash to avoid selling during downturns</li>
              <li>Tax-efficient withdrawal order: taxable first, then tax-deferred, then Roth</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
