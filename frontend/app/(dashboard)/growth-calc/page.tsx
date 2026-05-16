"use client";

import { useState, useMemo } from "react";
import { TrendingUp, DollarSign, Calendar, Info } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import { formatCurrency, formatPercent, formatCompact } from "@/lib/formatters";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import PageTransition from "@/components/celestial/PageTransition";

// ── Types ────────────────────────────────────────────────────────────────────

interface GrowthInputs {
  initialAmount: number;
  monthlyContribution: number;
  annualReturn: number;      // %
  years: number;
  inflationRate: number;     // %
}

interface YearData {
  year: number;
  lumpSum: number;
  dca: number;
  contributions: number;
  lumpGrowth: number;
  dcaGrowth: number;
}

// ── Math ─────────────────────────────────────────────────────────────────────

function computeGrowth(inputs: GrowthInputs): YearData[] {
  const { initialAmount, monthlyContribution, annualReturn, years } = inputs;
  const monthlyRate = annualReturn / 100 / 12;

  const data: YearData[] = [];

  // Lump sum: invest everything upfront (initial + total future contributions)
  const totalContributions = initialAmount + monthlyContribution * years * 12;

  for (let y = 0; y <= years; y++) {
    const months = y * 12;

    // Lump sum: all money invested at start
    const lumpSum = totalContributions * Math.pow(1 + monthlyRate, months);

    // DCA: initial + monthly additions
    let dca = initialAmount * Math.pow(1 + monthlyRate, months);
    // Future value of annuity for monthly contributions
    if (monthlyRate > 0 && months > 0) {
      dca += monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    } else {
      dca += monthlyContribution * months;
    }

    const contributions = initialAmount + monthlyContribution * months;

    data.push({
      year: y,
      lumpSum: Math.round(lumpSum),
      dca: Math.round(dca),
      contributions: Math.round(contributions),
      lumpGrowth: Math.round(lumpSum - totalContributions),
      dcaGrowth: Math.round(dca - contributions),
    });
  }

  return data;
}


// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Conservative", return: 6, desc: "Bonds + balanced funds" },
  { label: "Moderate", return: 8, desc: "60/40 stock-bond mix" },
  { label: "Growth", return: 10, desc: "S&P 500 historical avg" },
  { label: "Aggressive", return: 12, desc: "Growth stocks / tech-heavy" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthCalcPage() {
  const [inputs, setInputs] = useState<GrowthInputs>({
    initialAmount: 10000,
    monthlyContribution: 500,
    annualReturn: 10,
    years: 20,
    inflationRate: 3,
  });

  function set<K extends keyof GrowthInputs>(key: K, value: number) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const data = useMemo(() => computeGrowth(inputs), [inputs]);
  const final = data[data.length - 1];
  const totalContributed = final.contributions;
  const dcaFinal = final.dca;
  const dcaGrowth = final.dcaGrowth;
  const lumpFinal = final.lumpSum;

  // Inflation-adjusted
  const realReturn = (1 + inputs.annualReturn / 100) / (1 + inputs.inflationRate / 100) - 1;
  const realFinal = computeGrowth({
    ...inputs,
    annualReturn: realReturn * 100,
  });
  const realDcaFinal = realFinal[realFinal.length - 1].dca;

  // Rule of 72
  const doublingYears = inputs.annualReturn > 0 ? (72 / inputs.annualReturn).toFixed(1) : "∞";

  // Chart data — every year
  const chartData = data.map((d) => ({
    year: d.year === 0 ? "Start" : `Y${d.year}`,
    DCA: d.dca,
    "Lump Sum": d.lumpSum,
    Contributed: d.contributions,
  }));

  // Breakdown bar
  const breakdownData = [
    { name: "Contributed", value: totalContributed, color: "#3f3f46" },
    { name: "Growth (DCA)", value: dcaGrowth, color: "#14b8a6" },
  ];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-vela-teal" />
          Investment Growth Calculator
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          See how your money grows with regular investing. Compare DCA vs lump sum over time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="space-y-4">
          <div className="vela-card space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Inputs</h2>

            <SliderField
              label="Initial Investment"
              value={inputs.initialAmount}
              onChange={(v) => set("initialAmount", v)}
              min={0} max={500000} step={1000}
              format={formatCompact}
            />
            <SliderField
              label="Monthly Contribution"
              value={inputs.monthlyContribution}
              onChange={(v) => set("monthlyContribution", v)}
              min={0} max={10000} step={50}
              format={formatCompact}
            />
            <SliderField
              label="Expected Annual Return"
              value={inputs.annualReturn}
              onChange={(v) => set("annualReturn", v)}
              min={0} max={20} step={0.5}
              format={(v) => `${v}%`}
            />
            <SliderField
              label="Time Horizon"
              value={inputs.years}
              onChange={(v) => set("years", v)}
              min={1} max={40} step={1}
              format={(v) => `${v} years`}
            />
            <SliderField
              label="Inflation Rate"
              value={inputs.inflationRate}
              onChange={(v) => set("inflationRate", v)}
              min={0} max={8} step={0.5}
              format={(v) => `${v}%`}
            />
          </div>

          {/* Return presets */}
          <div className="vela-card space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Return Presets</p>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => set("annualReturn", p.return)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                  inputs.annualReturn === p.return
                    ? "bg-vela-teal/10 text-vela-teal"
                    : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-zinc-500">{p.return}% — {p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="vela-card text-center py-4">
              <AnimatedNumber value={dcaFinal} format={formatCompact} duration={1000} className="text-2xl font-bold tabular text-vela-teal" />
              <p className="text-[10px] text-zinc-500 mt-1">Final Value (DCA)</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber value={dcaGrowth} format={formatCompact} duration={1000} className="text-2xl font-bold tabular text-emerald-400" />
              <p className="text-[10px] text-zinc-500 mt-1">Investment Growth</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber value={totalContributed} format={formatCompact} duration={1000} className="text-2xl font-bold tabular text-zinc-100" />
              <p className="text-[10px] text-zinc-500 mt-1">Total Contributed</p>
            </div>
            <div className="vela-card text-center py-4">
              <AnimatedNumber value={realDcaFinal} format={formatCompact} duration={1000} className="text-2xl font-bold tabular text-amber-400" />
              <p className="text-[10px] text-zinc-500 mt-1">Real Value (adj.)</p>
            </div>
          </div>

          {/* Growth chart */}
          <div className="vela-card">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Growth Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradDCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLump" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={55} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, name: string) => [formatCurrency(val), name]}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Area type="monotone" dataKey="Contributed" stroke="#3f3f46" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="Lump Sum" stroke="#a78bfa" fill="url(#gradLump)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="DCA" stroke="#14b8a6" fill="url(#gradDCA)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-vela-teal" /> DCA (Monthly)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" /> Lump Sum</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /> Contributed</span>
            </div>
          </div>

          {/* Key insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="vela-card py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Growth Multiplier</p>
              <p className="text-xl font-bold tabular text-zinc-100">
                {totalContributed > 0 ? `${(dcaFinal / totalContributed).toFixed(1)}x` : "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Every $1 invested becomes ${totalContributed > 0 ? (dcaFinal / totalContributed).toFixed(2) : "—"}
              </p>
            </div>
            <div className="vela-card py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Rule of 72</p>
              <p className="text-xl font-bold tabular text-zinc-100">{doublingYears} years</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Time to double your money at {inputs.annualReturn}% return
              </p>
            </div>
            <div className="vela-card py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Lump Sum Advantage</p>
              <p className={`text-xl font-bold tabular ${lumpFinal > dcaFinal ? "text-purple-400" : "text-vela-teal"}`}>
                {lumpFinal > dcaFinal ? `+${formatCompact(lumpFinal - dcaFinal)}` : `−${formatCompact(dcaFinal - lumpFinal)}`}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                {lumpFinal > dcaFinal
                  ? "Lump sum wins — time in market beats timing"
                  : "DCA ahead — monthly investing smooths entry"}
              </p>
            </div>
            <div className="vela-card py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Inflation Impact</p>
              <p className="text-xl font-bold tabular text-amber-400">
                −{formatCompact(dcaFinal - realDcaFinal)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Purchasing power lost to {inputs.inflationRate}% inflation over {inputs.years} years
              </p>
            </div>
          </div>

          {/* DCA vs Lump Sum explainer */}
          <div className="vela-card px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div className="text-xs text-zinc-500 leading-relaxed space-y-1">
                <p>
                  <span className="text-zinc-300 font-medium">DCA (Dollar-Cost Averaging)</span>{" "}
                  means investing a fixed amount regularly regardless of price. You buy more shares when prices are low and fewer when high,
                  which can reduce the impact of volatility on your average cost.
                </p>
                <p>
                  <span className="text-zinc-300 font-medium">Lump Sum</span>{" "}
                  historically outperforms DCA ~68% of the time because markets tend to go up — but DCA reduces
                  the emotional risk of investing everything right before a downturn.
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Assumes constant returns compounded monthly. Actual returns vary year to year.
              Past performance does not predict future results. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

// ── Slider Field ─────────────────────────────────────────────────────────────

function SliderField({ label, value, onChange, min, max, step, format }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-zinc-500">{label}</label>
        <span className="text-xs font-medium text-zinc-200 tabular">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full accent-vela-teal h-1.5"
      />
    </div>
  );
}
