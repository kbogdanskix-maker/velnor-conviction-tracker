"use client";

import { useState, useMemo } from "react";
import {
  Coins, TrendingUp, DollarSign, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";

// ── DRIP simulation ─────────────────────────────────────────────────────────

interface DripInputs {
  initialShares: number;
  sharePrice: number;
  dividendYield: number; // annual %
  dividendGrowth: number; // annual %
  priceGrowth: number; // annual %
  years: number;
  additionalMonthly: number; // additional monthly investment
}

const DEFAULTS: DripInputs = {
  initialShares: 100,
  sharePrice: 50,
  dividendYield: 3.0,
  dividendGrowth: 5.0,
  priceGrowth: 7.0,
  years: 20,
  additionalMonthly: 200,
};

interface YearResult {
  year: number;
  shares: number;
  price: number;
  annualDividend: number;
  portfolioValue: number;
  totalDividends: number;
  totalInvested: number;
  withDrip: number;
  withoutDrip: number;
}

function simulate(inputs: DripInputs): YearResult[] {
  const {
    initialShares, sharePrice, dividendYield, dividendGrowth,
    priceGrowth, years, additionalMonthly,
  } = inputs;

  const results: YearResult[] = [];
  let shares = initialShares;
  let price = sharePrice;
  let currentYield = dividendYield / 100;
  let totalDividends = 0;
  let totalInvested = initialShares * sharePrice;

  // Without DRIP tracking
  let sharesNoDrip = initialShares;
  let noDripCash = 0;

  for (let y = 1; y <= years; y++) {
    // Price appreciation
    price = price * (1 + priceGrowth / 100);

    // Additional monthly investment (shares bought each month)
    const monthlyShares = additionalMonthly > 0 ? (additionalMonthly * 12) / price : 0;
    shares += monthlyShares;
    sharesNoDrip += monthlyShares;
    totalInvested += additionalMonthly * 12;

    // Dividend
    const divPerShare = price * currentYield;
    const annualDiv = divPerShare * shares;
    totalDividends += annualDiv;

    // DRIP: reinvest dividends into more shares
    const reinvestedShares = annualDiv / price;
    shares += reinvestedShares;

    // No DRIP: just accumulate cash
    const noDripDiv = divPerShare * sharesNoDrip;
    noDripCash += noDripDiv;

    // Dividend growth for next year
    currentYield = currentYield * (1 + dividendGrowth / 100);

    results.push({
      year: y,
      shares: Math.round(shares * 100) / 100,
      price: Math.round(price * 100) / 100,
      annualDividend: Math.round(annualDiv),
      portfolioValue: Math.round(shares * price),
      totalDividends: Math.round(totalDividends),
      totalInvested: Math.round(totalInvested),
      withDrip: Math.round(shares * price),
      withoutDrip: Math.round(sharesNoDrip * price + noDripCash),
    });
  }

  return results;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DripPage() {
  const [inputs, setInputs] = useState<DripInputs>(DEFAULTS);

  function set<K extends keyof DripInputs>(key: K, val: string) {
    setInputs((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  const results = useMemo(() => simulate(inputs), [inputs]);
  const final = results[results.length - 1];
  const initialInvestment = inputs.initialShares * inputs.sharePrice;
  const dripAdvantage = final ? final.withDrip - final.withoutDrip : 0;

  // Monthly dividend income projection (current year vs final year)
  const firstYearMonthly = results[0] ? results[0].annualDividend / 12 : 0;
  const finalYearMonthly = final ? final.annualDividend / 12 : 0;

  // Dividend growth chart
  const divGrowthData = results.map((r) => ({
    year: `Y${r.year}`,
    annual: r.annualDividend,
    monthly: Math.round(r.annualDividend / 12),
  }));

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">DRIP Calculator</h1>
        <p className="text-sm text-zinc-400 mt-1">
          See how dividend reinvestment compounds your wealth over time
        </p>
      </div>

      {/* Inputs + Key metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="lg:col-span-2 vela-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Parameters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InputField label="Initial Shares" value={inputs.initialShares} onChange={(v) => set("initialShares", v)} />
            <InputField label="Share Price" value={inputs.sharePrice} onChange={(v) => set("sharePrice", v)} prefix="$" />
            <InputField label="Dividend Yield" value={inputs.dividendYield} onChange={(v) => set("dividendYield", v)} suffix="%" />
            <InputField label="Div Growth/yr" value={inputs.dividendGrowth} onChange={(v) => set("dividendGrowth", v)} suffix="%" />
            <InputField label="Price Growth/yr" value={inputs.priceGrowth} onChange={(v) => set("priceGrowth", v)} suffix="%" />
            <InputField label="Years" value={inputs.years} onChange={(v) => set("years", v)} suffix="yr" />
            <InputField label="Monthly Add" value={inputs.additionalMonthly} onChange={(v) => set("additionalMonthly", v)} prefix="$" />
          </div>
        </div>

        {/* Key metrics */}
        <div className="space-y-4">
          <div className="vela-card p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Final Portfolio</p>
            <AnimatedNumber
              value={final ? final.withDrip : 0}
              format={(n) => formatCurrency(n)}
              className="text-2xl font-bold text-vela-teal tabular-nums mt-1"
            />
            <p className="text-xs text-zinc-500 mt-1">
              from {formatCurrency(initialInvestment)} initial
            </p>
          </div>
          <div className="vela-card p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">DRIP Advantage</p>
            <AnimatedNumber
              value={dripAdvantage}
              format={(n) => `+${formatCurrency(n)}`}
              className="text-2xl font-bold text-gain tabular-nums mt-1"
            />
            <p className="text-xs text-zinc-500 mt-1">vs taking dividends as cash</p>
          </div>
          <div className="vela-card p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Monthly Div Income</p>
            <p className="text-xs text-zinc-400 mt-1">
              Year 1: <span className="text-zinc-200 font-medium tabular-nums">{formatCurrency(firstYearMonthly)}</span>
            </p>
            <p className="text-xs text-zinc-400">
              Year {inputs.years}: <span className="text-gain font-bold tabular-nums">{formatCurrency(finalYearMonthly)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* DRIP vs No DRIP chart */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">DRIP vs No Reinvestment</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={results} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(y: number) => `Y${y}`} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                labelFormatter={(y: number) => `Year ${y}`}
                formatter={(v: number, name: string) => [formatCurrency(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
              <Area type="monotone" dataKey="withDrip" name="With DRIP" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="withoutDrip" name="Without DRIP" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="5 5" />
              <Area type="monotone" dataKey="totalInvested" name="Total Invested" stroke="#52525b" fill="none" strokeWidth={1} strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dividend growth chart */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Annual Dividend Income Growth</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={divGrowthData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
              <Tooltip cursor={false}
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                formatter={(v: number, name: string) => [formatCurrency(v), name === "annual" ? "Annual" : "Monthly"]}
              />
              <Bar dataKey="annual" name="Annual Dividend" fill="#14b8a6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table */}
      <div className="vela-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Year-by-Year Breakdown</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs text-zinc-500 font-medium py-2">Year</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2">Shares</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2">Price</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2">Annual Div</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2">Portfolio</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2">Total Divs</th>
            </tr>
          </thead>
          <tbody>
            {results.filter((_, i) => i % Math.max(1, Math.floor(inputs.years / 10)) === 0 || i === results.length - 1).map((r) => (
              <tr key={r.year} className="border-b border-zinc-800/50">
                <td className="py-2 text-zinc-200">{r.year}</td>
                <td className="text-right tabular-nums py-2 text-zinc-300">{r.shares.toLocaleString()}</td>
                <td className="text-right tabular-nums py-2 text-zinc-300">{formatCurrency(r.price)}</td>
                <td className="text-right tabular-nums py-2 text-gain">{formatCurrency(r.annualDividend)}</td>
                <td className="text-right tabular-nums py-2 text-zinc-200 font-medium">{formatCurrency(r.portfolioValue)}</td>
                <td className="text-right tabular-nums py-2 text-zinc-400">{formatCurrency(r.totalDividends)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Educational */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Why DRIP Matters</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p><span className="text-zinc-200 font-medium">Compound on compound</span> — reinvested dividends buy more shares, which earn more dividends, creating an accelerating cycle.</p>
          <p><span className="text-zinc-200 font-medium">Dollar-cost averaging</span> — DRIP automatically buys shares at various prices, reducing timing risk.</p>
          <p><span className="text-zinc-200 font-medium">No commission</span> — most brokers offer DRIP at zero cost, making every dividend dollar work.</p>
          <p><span className="text-zinc-200 font-medium">Behavioral benefit</span> — removes the temptation to spend dividend income, keeping your capital invested.</p>
        </div>
      </div>
    </PageTransition>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, prefix, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{prefix}</span>}
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal ${prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-8" : "px-3"}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}
