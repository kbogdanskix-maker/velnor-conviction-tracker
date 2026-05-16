"use client";

import { useState, useMemo, useCallback } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { GitCompare, Plus, X, TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import useSWR from "swr";
import { api } from "@/lib/api";

/* ── helpers ────────────────────────────────────────────────── */

/** Compact formatter for large market-cap values (T / B / M). */
const fmtB = (n: number) => {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return formatCurrency(n);
};

const COLORS = ["#14b8a6", "#f59e0b", "#a78bfa", "#f43f5e", "#38bdf8", "#84cc16"];

interface StockData {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  pe: number | null;
  dividendYield: number | null;
  beta: number | null;
  yearHigh: number;
  yearLow: number;
  volume: number;
  avgVolume: number;
  dayReturn: number;
}

/* ── component ──────────────────────────────────────────────── */

export default function StockComparePage() {
  const { summary } = useDefaultPortfolio();
  const holdings = summary?.holdings ?? [];
  const uniqueTickers = useMemo(() => {
    const seen = new Set<string>();
    return holdings.filter((h) => { if (seen.has(h.ticker)) return false; seen.add(h.ticker); return true; }).map((h) => h.ticker);
  }, [holdings]);

  const [selected, setSelected] = useState<string[]>([]);
  const [inputTicker, setInputTicker] = useState("");

  const tickers = selected.length > 0 ? selected : [];
  const tickerParam = tickers.join(",");
  const { data: quotesData } = useSWR(
    tickerParam ? `/quotes?tickers=${tickerParam}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const addTicker = useCallback((t: string) => {
    const ticker = t.toUpperCase().trim();
    if (ticker && !selected.includes(ticker) && selected.length < 6) {
      setSelected((prev) => [...prev, ticker]);
    }
    setInputTicker("");
  }, [selected]);

  const removeTicker = (t: string) => setSelected((prev) => prev.filter((x) => x !== t));

  // Parse quote data into our model
  const stocks: StockData[] = useMemo(() => {
    if (!quotesData) return [];
    return tickers.map((ticker) => {
      const q = (quotesData as Record<string, Record<string, number | null>>)?.[ticker];
      if (!q) return null;
      return {
        ticker,
        price: (q.price as number) ?? 0,
        change: (q.change as number) ?? 0,
        changePct: (q.change_pct as number) ?? 0,
        marketCap: (q.market_cap as number) ?? 0,
        pe: q.pe as number | null,
        dividendYield: q.dividend_yield as number | null,
        beta: q.beta as number | null,
        yearHigh: (q.year_high as number) ?? 0,
        yearLow: (q.year_low as number) ?? 0,
        volume: (q.volume as number) ?? 0,
        avgVolume: (q.avg_volume as number) ?? 0,
        dayReturn: (q.change_pct as number) ?? 0,
      };
    }).filter(Boolean) as StockData[];
  }, [quotesData, tickers]);

  // Radar chart data (normalize metrics to 0-100)
  const radarData = useMemo(() => {
    if (stocks.length === 0) return [];
    const metrics = [
      { key: "Value", fn: (s: StockData) => s.pe ? Math.max(0, 100 - s.pe * 2) : 50 },
      { key: "Yield", fn: (s: StockData) => Math.min(100, (s.dividendYield ?? 0) * 20) },
      { key: "Momentum", fn: (s: StockData) => Math.max(0, Math.min(100, 50 + s.changePct * 5)) },
      { key: "Stability", fn: (s: StockData) => s.beta ? Math.max(0, 100 - Math.abs(s.beta - 1) * 50) : 50 },
      { key: "Liquidity", fn: (s: StockData) => Math.min(100, (s.avgVolume / 10_000_000) * 100) },
      { key: "Size", fn: (s: StockData) => Math.min(100, (s.marketCap / 3e12) * 100) },
    ];

    return metrics.map((m) => {
      const row: Record<string, string | number> = { metric: m.key };
      stocks.forEach((s) => { row[s.ticker] = Math.round(m.fn(s)); });
      return row;
    });
  }, [stocks]);

  // Market cap comparison
  const capData = stocks.map((s) => ({ ticker: s.ticker, marketCap: s.marketCap }));

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Stock Compare</h1>
          <p className="text-zinc-400 text-sm mt-1">Side-by-side comparison of up to 6 stocks</p>
        </div>

        {/* ── Ticker Selector ─────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {selected.map((t, i) => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
                  style={{ borderColor: COLORS[i % COLORS.length] + "40", color: COLORS[i % COLORS.length], background: COLORS[i % COLORS.length] + "10" }}>
                  {t}
                  <button onClick={() => removeTicker(t)} className="hover:opacity-70 transition-opacity">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              {selected.length < 6 && (
                <form onSubmit={(e) => { e.preventDefault(); addTicker(inputTicker); }} className="flex items-center gap-2">
                  <input
                    value={inputTicker}
                    onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                    placeholder="Add ticker..."
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-vela-teal placeholder:text-zinc-600"
                  />
                  <button type="submit" className="p-1.5 rounded-lg bg-vela-teal/10 text-vela-teal hover:bg-vela-teal/20 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Quick add from portfolio */}
            {uniqueTickers.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Quick add from portfolio:</p>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueTickers.filter((t) => !selected.includes(t)).slice(0, 12).map((t) => (
                    <button key={t} onClick={() => addTicker(t)}
                      className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                      +{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FloatingCard>

        {stocks.length === 0 ? (
          <FloatingCard delay={0.1}>
            <div className="p-12 text-center text-zinc-500">
              <GitCompare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Add 2+ tickers above to compare</p>
            </div>
          </FloatingCard>
        ) : (
          <>
            {/* ── Price Cards ───────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {stocks.map((s, i) => (
                <FloatingCard key={s.ticker} delay={0.1 + i * 0.05}>
                  <div className="p-4" style={{ borderTop: `2px solid ${COLORS[i % COLORS.length]}` }}>
                    <p className="text-sm font-bold text-zinc-100">{s.ticker}</p>
                    <p className="text-lg font-display font-bold text-zinc-100 tabular-nums mt-1">{formatCurrency(s.price)}</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                      s.changePct > 0 ? "text-emerald-400" : s.changePct < 0 ? "text-rose-400" : "text-zinc-400"
                    }`}>
                      {s.changePct > 0 ? <TrendingUp className="w-3 h-3" /> : s.changePct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {s.changePct > 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                    </div>
                  </div>
                </FloatingCard>
              ))}
            </div>

            {/* ── Comparison Table ──────────────────────────────── */}
            <RevealOnScroll>
              <FloatingCard delay={0.2}>
                <div className="p-5 overflow-x-auto">
                  <h2 className="font-display font-semibold text-zinc-100 mb-4">Fundamentals</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-xs">
                        <th className="text-left pb-3 font-medium">Metric</th>
                        {stocks.map((s, i) => (
                          <th key={s.ticker} className="text-right pb-3 font-medium" style={{ color: COLORS[i % COLORS.length] }}>
                            {s.ticker}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      <tr>
                        <td className="py-2.5 text-zinc-400">Price</td>
                        {stocks.map((s) => <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">{formatCurrency(s.price)}</td>)}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Market Cap</td>
                        {stocks.map((s) => <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">{fmtB(s.marketCap)}</td>)}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">P/E Ratio</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className="py-2.5 text-right tabular-nums text-zinc-100">
                            {s.pe != null ? s.pe.toFixed(1) : "—"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Dividend Yield</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className="py-2.5 text-right tabular-nums text-zinc-100">
                            {formatPercent(s.dividendYield, false)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Beta</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className="py-2.5 text-right tabular-nums text-zinc-100">
                            {s.beta != null ? s.beta.toFixed(2) : "—"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">52W High</td>
                        {stocks.map((s) => <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">{formatCurrency(s.yearHigh)}</td>)}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">52W Low</td>
                        {stocks.map((s) => <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">{formatCurrency(s.yearLow)}</td>)}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">52W Range</td>
                        {stocks.map((s) => {
                          const range = s.yearHigh - s.yearLow;
                          const pos = range > 0 ? ((s.price - s.yearLow) / range) * 100 : 50;
                          return (
                            <td key={s.ticker} className="py-2.5 text-right">
                              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden inline-block" style={{ maxWidth: 80 }}>
                                <div className="h-full rounded-full bg-vela-teal/60" style={{ width: `${pos}%` }} />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Volume</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">
                            {s.volume > 1e6 ? `${(s.volume / 1e6).toFixed(1)}M` : `${(s.volume / 1e3).toFixed(0)}K`}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Day Change</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className={`py-2.5 text-right tabular-nums ${
                            s.changePct > 0 ? "text-emerald-400" : s.changePct < 0 ? "text-rose-400" : "text-zinc-400"
                          }`}>
                            {s.changePct > 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </FloatingCard>
            </RevealOnScroll>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Radar Chart ────────────────────────────────── */}
              {radarData.length > 0 && (
                <RevealOnScroll>
                  <FloatingCard delay={0.3}>
                    <div className="p-5">
                      <h2 className="font-display font-semibold text-zinc-100 mb-4">Profile Comparison</h2>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="#27272a" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: "#71717a", fontSize: 10 }} />
                            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                            {stocks.map((s, i) => (
                              <Radar key={s.ticker} name={s.ticker} dataKey={s.ticker}
                                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                                fillOpacity={0.1} strokeWidth={2} />
                            ))}
                            <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {stocks.map((s, i) => (
                          <span key={s.ticker} className="flex items-center gap-1.5 text-xs" style={{ color: COLORS[i % COLORS.length] }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            {s.ticker}
                          </span>
                        ))}
                      </div>
                    </div>
                  </FloatingCard>
                </RevealOnScroll>
              )}

              {/* ── Market Cap Bar Chart ───────────────────────── */}
              {capData.length > 0 && (
                <RevealOnScroll>
                  <FloatingCard delay={0.35}>
                    <div className="p-5">
                      <h2 className="font-display font-semibold text-zinc-100 mb-4">Market Cap</h2>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={capData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                              tickFormatter={(v) => v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${(v / 1e9).toFixed(0)}B`} />
                            <YAxis type="category" dataKey="ticker" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                            <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                              formatter={(v: number) => [fmtB(v), "Market Cap"]} />
                            <Bar dataKey="marketCap" radius={[0, 4, 4, 0]}>
                              {capData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </FloatingCard>
                </RevealOnScroll>
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
