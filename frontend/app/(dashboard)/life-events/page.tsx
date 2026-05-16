"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Heart, Baby, Home, GraduationCap, Briefcase, Plane,
  Car, Activity, Clock, DollarSign, TrendingDown, TrendingUp,
  ChevronRight, AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── event presets ──────────────────────────────────────────── */

interface LifeEvent {
  id: string;
  name: string;
  icon: typeof Heart;
  color: string;
  upfrontCost: number;
  monthlyIncrease: number; // net monthly cost change
  monthlyIncomeChange: number; // net income change
  duration: number; // months this impact lasts (0 = permanent)
  description: string;
}

const EVENT_PRESETS: LifeEvent[] = [
  {
    id: "marriage", name: "Getting Married", icon: Heart, color: "#ec4899",
    upfrontCost: 35_000, monthlyIncrease: -200, monthlyIncomeChange: 0,
    duration: 0, description: "Wedding costs offset by shared living expenses",
  },
  {
    id: "baby", name: "Having a Baby", icon: Baby, color: "#f59e0b",
    upfrontCost: 12_000, monthlyIncrease: 1_500, monthlyIncomeChange: 0,
    duration: 0, description: "Childcare, diapers, healthcare, gear — ongoing costs",
  },
  {
    id: "home", name: "Buying a Home", icon: Home, color: "#14b8a6",
    upfrontCost: 80_000, monthlyIncrease: 800, monthlyIncomeChange: 0,
    duration: 0, description: "Down payment + higher monthly housing costs vs renting",
  },
  {
    id: "career", name: "Career Change", icon: Briefcase, color: "#38bdf8",
    upfrontCost: 5_000, monthlyIncrease: 0, monthlyIncomeChange: 1_500,
    duration: 0, description: "Short-term costs for transition, potential higher income",
  },
  {
    id: "grad", name: "Grad School", icon: GraduationCap, color: "#a78bfa",
    upfrontCost: 0, monthlyIncrease: 2_500, monthlyIncomeChange: -3_000,
    duration: 24, description: "Tuition + lost income for 2 years, then higher earning power",
  },
  {
    id: "sabbatical", name: "Sabbatical / Gap Year", icon: Plane, color: "#34d399",
    upfrontCost: 5_000, monthlyIncrease: 2_000, monthlyIncomeChange: -5_000,
    duration: 12, description: "No income, travel costs — purely an expense period",
  },
  {
    id: "car", name: "New Car Purchase", icon: Car, color: "#71717a",
    upfrontCost: 8_000, monthlyIncrease: 450, monthlyIncomeChange: 0,
    duration: 60, description: "Down payment + 5-year loan payment + insurance increase",
  },
  {
    id: "health", name: "Health Event", icon: Activity, color: "#ef4444",
    upfrontCost: 15_000, monthlyIncrease: 500, monthlyIncomeChange: -2_000,
    duration: 6, description: "Medical costs + reduced work capacity",
  },
];

/* ── simulation ─────────────────────────────────────────────── */

interface MonthPoint {
  month: number;
  label: string;
  netWorth: number;
  baseline: number;
  monthlyExpenses: number;
  monthlyIncome: number;
}

function simulateLifeEvent(
  event: LifeEvent,
  currentNetWorth: number,
  monthlyIncome: number,
  monthlyExpenses: number,
  investReturn: number,
  months: number,
): MonthPoint[] {
  const data: MonthPoint[] = [];
  let nw = currentNetWorth;
  let baseNw = currentNetWorth;
  const monthlyReturn = investReturn / 100 / 12;
  const startMonth = 3; // event happens at month 3

  // Apply upfront cost
  for (let m = 0; m <= months; m++) {
    const isPostEvent = m >= startMonth;
    const isInDuration = event.duration === 0 ? isPostEvent : (m >= startMonth && m < startMonth + event.duration);

    let curExpenses = monthlyExpenses;
    let curIncome = monthlyIncome;

    if (isPostEvent && m === startMonth) {
      nw -= event.upfrontCost; // one-time cost
    }

    if (isInDuration) {
      curExpenses += event.monthlyIncrease;
      curIncome += event.monthlyIncomeChange;
    } else if (isPostEvent && event.duration > 0 && m >= startMonth + event.duration) {
      // Post-event: if grad school, income goes up permanently after
      if (event.id === "grad") {
        curIncome += 2_500; // higher earning after grad school
      }
    }

    const savings = curIncome - curExpenses;
    nw = nw * (1 + monthlyReturn) + savings;

    // Baseline (no event)
    const baseSavings = monthlyIncome - monthlyExpenses;
    baseNw = baseNw * (1 + monthlyReturn) + baseSavings;

    const year = Math.floor(m / 12);
    const mo = m % 12;
    data.push({
      month: m,
      label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][mo]} Y${year + 1}`,
      netWorth: nw,
      baseline: baseNw,
      monthlyExpenses: curExpenses,
      monthlyIncome: curIncome,
    });
  }

  return data;
}

/* ── component ──────────────────────────────────────────────── */

export default function LifeEventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<LifeEvent>(EVENT_PRESETS[0]);
  const [netWorth, setNetWorth] = useState(200_000);
  const [monthlyIncome, setMonthlyIncome] = useState(8_000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(5_000);
  const [investReturn, setInvestReturn] = useState(7);
  const [timeHorizon, setTimeHorizon] = useState(60); // months

  // Allow custom override of event values
  const [customUpfront, setCustomUpfront] = useState(selectedEvent.upfrontCost);
  const [customMonthly, setCustomMonthly] = useState(selectedEvent.monthlyIncrease);

  const handleSelectEvent = (e: LifeEvent) => {
    setSelectedEvent(e);
    setCustomUpfront(e.upfrontCost);
    setCustomMonthly(e.monthlyIncrease);
  };

  const effectiveEvent = { ...selectedEvent, upfrontCost: customUpfront, monthlyIncrease: customMonthly };

  const data = useMemo(
    () => simulateLifeEvent(effectiveEvent, netWorth, monthlyIncome, monthlyExpenses, investReturn, timeHorizon),
    [effectiveEvent, netWorth, monthlyIncome, monthlyExpenses, investReturn, timeHorizon],
  );

  const finalDiff = (data[data.length - 1]?.netWorth ?? 0) - (data[data.length - 1]?.baseline ?? 0);
  const totalImpact = effectiveEvent.upfrontCost + (effectiveEvent.monthlyIncrease * (effectiveEvent.duration || timeHorizon));
  const recoveryMonth = data.find((d, i) => i > 3 && d.netWorth >= d.baseline);
  const monthsToRecover = recoveryMonth ? recoveryMonth.month - 3 : null;

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Life Events Planner</h1>
          <p className="text-zinc-400 text-sm mt-1">Model the financial impact of major life changes</p>
        </div>

        {/* ── Event Selector ──────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5">
            <label className="text-xs text-zinc-400 font-medium mb-3 block">SELECT LIFE EVENT</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EVENT_PRESETS.map((e) => {
                const Icon = e.icon;
                return (
                  <button key={e.id} onClick={() => handleSelectEvent(e)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedEvent.id === e.id
                        ? "ring-1 ring-opacity-30 border"
                        : "bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600"
                    }`}
                    style={selectedEvent.id === e.id ? {
                      borderColor: e.color + "40",
                      background: e.color + "08",
                      boxShadow: `0 0 0 1px ${e.color}30`,
                    } : {}}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-4 h-4" style={{ color: e.color }} />
                      <span className={`text-sm font-medium ${selectedEvent.id === e.id ? "text-zinc-100" : "text-zinc-300"}`}>
                        {e.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{e.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </FloatingCard>

        {/* ── Controls ────────────────────────────────────────── */}
        <FloatingCard delay={0.05}>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Current Net Worth</label>
              <input type="number" value={netWorth} onChange={(e) => setNetWorth(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Monthly Income</label>
              <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Monthly Expenses</label>
              <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Time Horizon</label>
              <input type="range" min={12} max={120} step={6} value={timeHorizon} onChange={(e) => setTimeHorizon(+e.target.value)}
                className="w-full mt-1 accent-vela-teal" />
              <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                <span>1yr</span><span className="text-zinc-200 font-medium">{(timeHorizon / 12).toFixed(0)} years</span><span>10yr</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Upfront Cost (adjust)</label>
              <input type="number" value={customUpfront} onChange={(e) => setCustomUpfront(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium">Monthly Cost Change</label>
              <input type="number" value={customMonthly} onChange={(e) => setCustomMonthly(+e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
            </div>
          </div>
        </FloatingCard>

        {/* ── Impact Summary ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <DollarSign className="w-3.5 h-3.5 text-rose-400" />
                UPFRONT COST
              </div>
              <p className="text-2xl font-display font-bold text-rose-400 tabular-nums">{formatCurrency(effectiveEvent.upfrontCost)}</p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.15}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                TOTAL IMPACT
              </div>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{formatCurrency(Math.abs(totalImpact))}</p>
              <p className="text-xs text-zinc-500 mt-1">Direct cost over period</p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: selectedEvent.color }} />
                NET WORTH IMPACT
              </div>
              <p className={`text-2xl font-display font-bold tabular-nums ${finalDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {finalDiff >= 0 ? "+" : ""}{formatCurrency(finalDiff)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">At end of {(timeHorizon / 12).toFixed(0)} years</p>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.25}>
            <div className="p-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                RECOVERY TIME
              </div>
              <p className="text-2xl font-display font-bold text-sky-400 tabular-nums">
                {monthsToRecover != null ? `${monthsToRecover} mo` : "N/A"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {monthsToRecover != null ? "To match baseline NW" : "Doesn't recover in period"}
              </p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Net Worth Comparison Chart ───────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.3}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Net Worth: Event vs Baseline</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.filter((_, i) => i % 3 === 0 || i === data.length - 1)}>
                    <defs>
                      <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={selectedEvent.color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={selectedEvent.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 9 }} axisLine={false} tickLine={false}
                      interval={Math.floor(data.length / 15)} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "netWorth" ? "With Event" : "Baseline"]}
                    />
                    <Area type="monotone" dataKey="baseline" stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                    <Area type="monotone" dataKey="netWorth" stroke={selectedEvent.color} strokeWidth={2} fill="url(#eventGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block rounded" style={{ background: selectedEvent.color }} /> With {selectedEvent.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-zinc-500 inline-block rounded border-dashed" /> Baseline
                </span>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Planning Tips ───────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-sm text-zinc-400">
            <p className="font-medium text-amber-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Planning Considerations
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs">
              <li>Build an emergency fund (3-6 months) before major life events</li>
              <li>Consider timing: low-market periods may not be ideal for large withdrawals</li>
              <li>Factor in tax implications — home purchases have deductions, career changes may change brackets</li>
              <li>Insurance needs change with life events — review coverage after each milestone</li>
              <li>Adjust your investment risk tolerance post-event (e.g., more conservative with dependents)</li>
            </ul>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
