"use client";

import { useState, useMemo } from "react";
import {
  GitCompare, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  BarChart2, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import TierGate from "@/components/shared/TierGate";

// ── Benchmark data (static — typical annual returns) ────────────────────────

interface BenchmarkProfile {
  key: string;
  label: string;
  annualReturn: number;
  volatility: number; // std dev
  maxDrawdown: number;
  sharpe: number;
  divYield: number;
  expenseRatio: number;
  description: string;
}

const BENCHMARKS: BenchmarkProfile[] = [
  { key: "sp500", label: "S&P 500", annualReturn: 10.5, volatility: 15.5, maxDrawdown: -33.9, sharpe: 0.68, divYield: 1.3, expenseRatio: 0.03, description: "US large-cap. The default benchmark for most portfolios." },
  { key: "nasdaq", label: "Nasdaq 100", annualReturn: 13.2, volatility: 20.1, maxDrawdown: -49.1, sharpe: 0.66, divYield: 0.6, expenseRatio: 0.20, description: "Tech-heavy large-cap growth. Higher returns, higher volatility." },
  { key: "total", label: "Total Market", annualReturn: 10.2, volatility: 15.2, maxDrawdown: -37.0, sharpe: 0.67, divYield: 1.4, expenseRatio: 0.03, description: "Entire US stock market including small & mid cap." },
  { key: "intl", label: "International", annualReturn: 7.8, volatility: 17.0, maxDrawdown: -43.4, sharpe: 0.46, divYield: 2.9, expenseRatio: 0.07, description: "Developed international ex-US markets." },
  { key: "bonds", label: "US Bonds", annualReturn: 4.5, volatility: 5.5, maxDrawdown: -13.0, sharpe: 0.82, divYield: 3.8, expenseRatio: 0.03, description: "US aggregate bonds. Low risk, low return, portfolio stabilizer." },
  { key: "6040", label: "60/40 Portfolio", annualReturn: 8.2, volatility: 10.5, maxDrawdown: -22.0, sharpe: 0.78, divYield: 2.0, expenseRatio: 0.05, description: "Classic 60% stocks / 40% bonds. The traditional balanced portfolio." },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function growthOf(initial: number, annualReturn: number, years: number): number[] {
  const result: number[] = [initial];
  for (let y = 1; y <= years; y++) {
    result.push(result[y - 1] * (1 + annualReturn / 100));
  }
  return result;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { summary, portfolio } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);
  const portfolioValue = summary?.total_value ?? 0;
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(["sp500", "6040"]);
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [years, setYears] = useState(10);
  // Seed with real annualized return from risk endpoint, fallback to 8%
  const realReturn = risk?.annualized_return != null ? Number(risk.annualized_return) : null;
  const [userReturn, setUserReturn] = useState(8);
  const [seededReturn, setSeededReturn] = useState(false);

  // Auto-fill once real data arrives
  if (realReturn != null && !seededReturn && realReturn !== 0) {
    setUserReturn(parseFloat(realReturn.toFixed(1)));
    setSeededReturn(true);
  }

  function toggleBenchmark(key: string) {
    setSelectedBenchmarks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < 4 ? [...prev, key] : prev
    );
  }

  const selected = useMemo(() => BENCHMARKS.filter((b) => selectedBenchmarks.includes(b.key)), [selectedBenchmarks]);

  // Growth projection chart data
  const growthData = useMemo(() => {
    const userGrowth = growthOf(investmentAmount, userReturn, years);
    const benchGrowths = selected.map((b) => ({
      key: b.key,
      label: b.label,
      values: growthOf(investmentAmount, b.annualReturn, years),
    }));

    return Array.from({ length: years + 1 }, (_, i) => {
      const point: Record<string, number | string> = { year: `Y${i}` };
      point["Your Portfolio"] = Math.round(userGrowth[i]);
      for (const bg of benchGrowths) {
        point[bg.label] = Math.round(bg.values[i]);
      }
      return point;
    });
  }, [investmentAmount, userReturn, years, selected]);

  // Bar chart: annual return comparison
  const returnCompData = useMemo(() => {
    const data = [{ name: "Your Portfolio", return: userReturn }];
    for (const b of selected) {
      data.push({ name: b.label, return: b.annualReturn });
    }
    return data;
  }, [userReturn, selected]);

  // Radar chart: risk/return profile
  const radarData = useMemo(() => {
    const metrics = ["Return", "Low Volatility", "Sharpe", "Yield", "Low Cost"];
    return metrics.map((metric) => {
      const point: Record<string, string | number> = { metric };
      // Normalize to 0-100 scale
      const rv = risk?.annualized_volatility != null ? Number(risk.annualized_volatility) : null;
      const rs = risk?.sharpe_ratio != null ? Number(risk.sharpe_ratio) : null;
      point["Your Portfolio"] = metric === "Return" ? Math.min(userReturn / 15 * 100, 100)
        : metric === "Low Volatility" ? (rv != null ? Math.max(0, (30 - rv) / 30 * 100) : 50)
        : metric === "Sharpe" ? (rs != null ? Math.min(rs / 1.0 * 100, 100) : 50)
        : metric === "Yield" ? 30
        : 100; // no fees for individual portfolio

      for (const b of selected) {
        point[b.label] = metric === "Return" ? Math.min(b.annualReturn / 15 * 100, 100)
          : metric === "Low Volatility" ? Math.max(0, (30 - b.volatility) / 30 * 100)
          : metric === "Sharpe" ? Math.min(b.sharpe / 1.0 * 100, 100)
          : metric === "Yield" ? Math.min(b.divYield / 4 * 100, 100)
          : Math.max(0, (0.5 - b.expenseRatio) / 0.5 * 100);
      }
      return point;
    });
  }, [userReturn, selected]);

  const COLORS = ["#14b8a6", "#f59e0b", "#a855f7", "#f43f5e", "#3b82f6"];

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Portfolio Comparison</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Compare your portfolio against major benchmarks and see how your returns stack up
        </p>
      </div>

      {/* Benchmark pills */}
      <div className="flex flex-wrap gap-2">
        {BENCHMARKS.map((b) => {
          const active = selectedBenchmarks.includes(b.key);
          return (
            <button
              key={b.key}
              onClick={() => toggleBenchmark(b.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                active
                  ? "bg-vela-teal/15 text-vela-teal border-vela-teal/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600"
              }`}
            >
              {b.label}
            </button>
          );
        })}
        <span className="text-[10px] text-zinc-600 self-center ml-1">Select up to 4</span>
      </div>

      {/* Config row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="vela-card p-4">
          <label className="text-xs text-zinc-500 block mb-1">Investment Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
            <input
              type="number"
              value={investmentAmount || ""}
              onChange={(e) => setInvestmentAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
            />
          </div>
        </div>
        <div className="vela-card p-4">
          <label className="text-xs text-zinc-500 block mb-1">
            Your Annual Return {seededReturn && <span className="text-vela-teal">(live)</span>}
          </label>
          <div className="relative">
            <input
              type="number"
              value={userReturn || ""}
              onChange={(e) => setUserReturn(parseFloat(e.target.value) || 0)}
              step="0.5"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
          </div>
        </div>
        <div className="vela-card p-4">
          <label className="text-xs text-zinc-500 block mb-1">Time Horizon</label>
          <select
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal"
          >
            {[5, 10, 15, 20, 25, 30].map((y) => (
              <option key={y} value={y}>{y} years</option>
            ))}
          </select>
        </div>
        <FloatingCard glowColor="rgba(20, 184, 166, 0.12)" delay={0.2}>
          <div className="p-4">
            <label className="text-xs text-zinc-500 block mb-1">Final Value (You)</label>
            <AnimatedNumber
              value={investmentAmount * Math.pow(1 + userReturn / 100, years)}
              format={formatCurrency}
              duration={800}
              className="text-lg font-bold text-vela-teal tabular-nums mt-1 block"
            />
          </div>
        </FloatingCard>
      </div>

      {/* Growth projection chart */}
      <RevealOnScroll>
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Growth Projection</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={false}
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                labelStyle={{ color: "#e4e4e7" }}
                formatter={(v: number) => [formatCurrency(v)]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
              <Bar dataKey="Your Portfolio" fill={COLORS[0]} radius={[2, 2, 0, 0]} />
              {selected.map((b, i) => (
                <Bar key={b.key} dataKey={b.label} fill={COLORS[i + 1]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      </RevealOnScroll>

      {/* Return comparison + Radar */}
      <RevealOnScroll delay={0.1}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Annual return comparison */}
        <div className="vela-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Annual Return Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnCompData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={95} />
                <Tooltip cursor={false}
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Annual Return"]}
                />
                <ReferenceLine x={0} stroke="#52525b" />
                {returnCompData.map((_, i) => null)}
                <Bar dataKey="return" radius={[0, 4, 4, 0]}>
                  {returnCompData.map((entry, i) => {
                    const fill = i === 0 ? COLORS[0] : COLORS[selectedBenchmarks.indexOf(
                      BENCHMARKS.find((b) => b.label === entry.name)?.key ?? ""
                    ) + 1] || "#71717a";
                    return <rect key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar chart */}
        <div className="vela-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Risk/Return Profile</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Your Portfolio" dataKey="Your Portfolio" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
                {selected.map((b, i) => (
                  <Radar key={b.key} name={b.label} dataKey={b.label} stroke={COLORS[i + 1]} fill={COLORS[i + 1]} fillOpacity={0.08} strokeWidth={1.5} />
                ))}
                <Legend wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      </RevealOnScroll>

      {/* Benchmark details table */}
      <RevealOnScroll delay={0.15}>
      <div className="vela-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Benchmark Details</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs text-zinc-500 font-medium py-2 pr-4">Benchmark</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Annual Return</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Volatility</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Max Drawdown</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Sharpe</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Div Yield</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">Expense</th>
              <th className="text-right text-xs text-zinc-500 font-medium py-2 px-3">{years}Y Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-800/50 bg-vela-teal/[0.04]">
              <td className="py-2.5 pr-4 font-medium text-vela-teal">Your Portfolio</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-200">{userReturn.toFixed(1)}%</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{risk?.annualized_volatility != null ? `${Number(risk.annualized_volatility).toFixed(1)}%` : "—"}</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-loss">{risk?.max_drawdown != null ? `${Number(risk.max_drawdown).toFixed(1)}%` : "—"}</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{risk?.sharpe_ratio != null ? Number(risk.sharpe_ratio).toFixed(2) : "—"}</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-500">—</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-500">—</td>
              <td className="text-right tabular-nums py-2.5 px-3 text-zinc-200 font-medium">
                {formatCurrency(investmentAmount * Math.pow(1 + userReturn / 100, years))}
              </td>
            </tr>
            {BENCHMARKS.map((b) => {
              const finalVal = investmentAmount * Math.pow(1 + b.annualReturn / 100, years);
              const isSelected = selectedBenchmarks.includes(b.key);
              return (
                <tr key={b.key} className={`border-b border-zinc-800/50 ${isSelected ? "" : "opacity-40"}`}>
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-zinc-200">{b.label}</span>
                  </td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-200">{b.annualReturn.toFixed(1)}%</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{b.volatility.toFixed(1)}%</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-loss">{b.maxDrawdown.toFixed(1)}%</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{b.sharpe.toFixed(2)}</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{b.divYield.toFixed(1)}%</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-400">{b.expenseRatio.toFixed(2)}%</td>
                  <td className="text-right tabular-nums py-2.5 px-3 text-zinc-200 font-medium">{formatCurrency(finalVal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </RevealOnScroll>

      {/* Glossary */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Understanding the Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><span className="font-medium text-zinc-300">Annual Return</span><span className="text-zinc-500"> — Average yearly return (historical, not guaranteed).</span></div>
          <div><span className="font-medium text-zinc-300">Volatility</span><span className="text-zinc-500"> — Standard deviation of returns. Higher = more price swings.</span></div>
          <div><span className="font-medium text-zinc-300">Max Drawdown</span><span className="text-zinc-500"> — Worst peak-to-trough decline. How bad can it get?</span></div>
          <div><span className="font-medium text-zinc-300">Sharpe Ratio</span><span className="text-zinc-500"> — Return per unit of risk. Higher is better (above 0.7 is good).</span></div>
          <div><span className="font-medium text-zinc-300">Dividend Yield</span><span className="text-zinc-500"> — Annual dividends as % of price. Income component.</span></div>
          <div><span className="font-medium text-zinc-300">Expense Ratio</span><span className="text-zinc-500"> — Annual fund management cost. Lower is better.</span></div>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}
