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

const COLORS = ["#1AA8BB", "#f59e0b", "#a78bfa", "#f43f5e", "#38bdf8", "#84cc16"];

interface StockData {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  pe: number | null;
  forwardPe: number | null;
  dividendYield: number | null;
  beta: number | null;
  yearHigh: number;
  yearLow: number;
  volume: number;
  avgVolume: number;
  dayReturn: number;
  operatingMargin: number | null;
  profitMargin: number | null;
  // Extended fundamentals
  pegRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  roe: number | null;          // %  (returnOnEquity × 100)
  roa: number | null;          // %  (returnOnAssets × 100)
  debtToEquity: number | null; // yfinance value (total debt / equity × 100)
  currentRatio: number | null;
  quickRatio: number | null;
  revenueGrowth: number | null;  // %  (yoy)
  earningsGrowth: number | null; // %  (yoy)
}

/** Median of the non-null numbers in an array; null if none. */
const median = (vals: (number | null)[]): number | null => {
  const xs = vals.filter((v): v is number => v != null).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

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
  // Bulk endpoint returns fundamentals + live quote merged per ticker
  const { data: quotesData } = useSWR(
    tickerParam ? `/markets/info/bulk?tickers=${tickerParam}` : null,
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
      const q = (quotesData as Record<string, Record<string, number | string | null>>)?.[ticker];
      if (!q) return null;
      // dividend_yield from yfinance is a decimal (0.0035 = 0.35%)  - multiply by 100 for display
      const rawYield = q.dividend_yield as number | null;
      return {
        ticker,
        name: q.name as string | null,
        sector: q.sector as string | null,
        price: (q.price as number) ?? 0,
        change: (q.change as number) ?? 0,
        changePct: (q.change_pct as number) ?? 0,
        marketCap: (q.market_cap as number) ?? 0,
        pe: (q.trailing_pe ?? q.pe) as number | null,
        forwardPe: q.forward_pe as number | null,
        dividendYield: rawYield != null ? rawYield * 100 : null,
        beta: q.beta as number | null,
        yearHigh: (q.fifty_two_week_high as number) ?? 0,
        yearLow: (q.fifty_two_week_low as number) ?? 0,
        volume: (q.volume as number) ?? 0,
        avgVolume: (q.average_volume as number) ?? 0,
        dayReturn: (q.change_pct as number) ?? 0,
        operatingMargin: q.operating_margins != null ? (q.operating_margins as number) * 100 : null,
        profitMargin: q.profit_margins != null ? (q.profit_margins as number) * 100 : null,
        pegRatio: q.peg_ratio as number | null,
        priceToSales: q.price_to_sales as number | null,
        priceToBook: q.price_to_book as number | null,
        evToEbitda: q.ev_to_ebitda as number | null,
        roe: q.return_on_equity != null ? (q.return_on_equity as number) * 100 : null,
        roa: q.return_on_assets != null ? (q.return_on_assets as number) * 100 : null,
        debtToEquity: q.debt_to_equity as number | null,
        currentRatio: q.current_ratio as number | null,
        quickRatio: q.quick_ratio as number | null,
        revenueGrowth: q.revenue_growth != null ? (q.revenue_growth as number) * 100 : null,
        earningsGrowth: q.earnings_growth != null ? (q.earnings_growth as number) * 100 : null,
      };
    }).filter(Boolean) as StockData[];
  }, [quotesData, tickers]);

  // Profile scores (0–100). Each metric uses a transparent, finance-grounded formula.
  const PROFILE_METRICS: { key: string; desc: string; fn: (s: StockData) => number }[] = [
    {
      key: "Value",
      desc: "Based on Forward P/E. Score = 100 × 15 / (fwdPE + 1). P/E 15 → ~94, P/E 30 → ~48, P/E 60 → ~25. No P/E data = 50.",
      fn: (s) => s.forwardPe != null && s.forwardPe > 0
        ? Math.round(Math.max(0, Math.min(100, 100 * 15 / (s.forwardPe + 1))))
        : s.pe != null && s.pe > 0
          ? Math.round(Math.max(0, Math.min(100, 100 * 15 / (s.pe + 1))))
          : 50,
    },
    {
      key: "Momentum",
      desc: "52-week range position: (Price − 52W Low) / (52W High − 52W Low) × 100. 100 = at 52W high, 0 = at 52W low.",
      fn: (s) => {
        const range = s.yearHigh - s.yearLow;
        return range > 0 ? Math.round(Math.max(0, Math.min(100, ((s.price - s.yearLow) / range) * 100))) : 50;
      },
    },
    {
      key: "Quality",
      desc: "Operating margin score: margin × 2.5. 40% margin → 100, 20% → 50, 0% → 0. Measures operational efficiency.",
      fn: (s) => s.operatingMargin != null
        ? Math.round(Math.max(0, Math.min(100, s.operatingMargin * 2.5)))
        : 50,
    },
    {
      key: "Stability",
      desc: "Beta proximity to 1.0: 100 − |beta − 1| × 50. Beta 1.0 = 100 (moves with market). Beta 0 or 2 = 50. Beta 3 = 0.",
      fn: (s) => s.beta != null
        ? Math.round(Math.max(0, Math.min(100, 100 - Math.abs(s.beta - 1) * 50)))
        : 50,
    },
    {
      key: "Yield",
      desc: "Dividend yield score: yield% × 20. 5% yield → 100, 2.5% → 50, 0% → 0. Higher is better for income investors.",
      fn: (s) => Math.round(Math.min(100, (s.dividendYield ?? 0) * 20)),
    },
    {
      key: "Size",
      desc: "Market cap score: cap / $500B × 100, capped at 100. $500B+ = 100, $250B = 50, $100B = 20. Larger = more established.",
      fn: (s) => Math.round(Math.min(100, (s.marketCap / 5e11) * 100)),
    },
  ];

  // Config-driven fundamentals table. `better` drives winner highlighting:
  // "low" = smaller value wins (cheaper / less leverage), "high" = larger wins,
  // null = informational only (no winner).
  type Row = { label: string; get: (s: StockData) => number | null; fmt: (v: number) => string; better: "high" | "low" | null };
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const x1 = (v: number) => v.toFixed(1);
  const x2 = (v: number) => v.toFixed(2);
  const METRIC_ROWS: Row[] = [
    { label: "Market Cap", get: (s) => s.marketCap || null, fmt: fmtB, better: null },
    { label: "P/E (TTM)", get: (s) => s.pe, fmt: x1, better: "low" },
    { label: "P/E (Fwd)", get: (s) => s.forwardPe, fmt: x1, better: "low" },
    { label: "PEG", get: (s) => (s.pegRatio != null && s.pegRatio > 0 ? s.pegRatio : null), fmt: x2, better: "low" },
    { label: "P/S", get: (s) => s.priceToSales, fmt: x2, better: "low" },
    { label: "P/B", get: (s) => s.priceToBook, fmt: x2, better: "low" },
    { label: "EV/EBITDA", get: (s) => s.evToEbitda, fmt: x1, better: "low" },
    { label: "ROE", get: (s) => s.roe, fmt: pct, better: "high" },
    { label: "ROA", get: (s) => s.roa, fmt: pct, better: "high" },
    { label: "Op. Margin", get: (s) => s.operatingMargin, fmt: pct, better: "high" },
    { label: "Profit Margin", get: (s) => s.profitMargin, fmt: pct, better: "high" },
    { label: "Rev. Growth", get: (s) => s.revenueGrowth, fmt: pct, better: "high" },
    { label: "Earnings Growth", get: (s) => s.earningsGrowth, fmt: pct, better: "high" },
    { label: "Debt/Equity", get: (s) => s.debtToEquity, fmt: x1, better: "low" },
    { label: "Current Ratio", get: (s) => s.currentRatio, fmt: x2, better: "high" },
    { label: "Quick Ratio", get: (s) => s.quickRatio, fmt: x2, better: "high" },
    { label: "Dividend Yield", get: (s) => s.dividendYield, fmt: pct, better: "high" },
    { label: "Beta", get: (s) => s.beta, fmt: x2, better: null },
  ];

  const radarData = useMemo(() => {
    if (stocks.length === 0) return [];
    return PROFILE_METRICS.map((m) => {
      const row: Record<string, string | number> = { metric: m.key };
      stocks.forEach((s) => { row[s.ticker] = m.fn(s); });
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-semibold text-zinc-100">Fundamentals</h2>
                    {stocks.length > 1 && (
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" /> best in row
                      </span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-xs">
                        <th className="text-left pb-3 font-medium">Metric</th>
                        {stocks.map((s, i) => (
                          <th key={s.ticker} className="text-right pb-3 font-medium" style={{ color: COLORS[i % COLORS.length] }}>
                            {s.ticker}
                          </th>
                        ))}
                        {stocks.length > 1 && (
                          <th className="text-right pb-3 font-medium text-zinc-500">Median</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {/* Identity rows (no winner) */}
                      <tr>
                        <td className="py-2.5 text-zinc-400">Price</td>
                        {stocks.map((s) => <td key={s.ticker} className="py-2.5 text-right text-zinc-100 tabular-nums">{formatCurrency(s.price)}</td>)}
                        {stocks.length > 1 && <td className="py-2.5" />}
                      </tr>
                      <tr>
                        <td className="py-2.5 text-zinc-400">Sector</td>
                        {stocks.map((s) => (
                          <td key={s.ticker} className="py-2.5 text-right text-zinc-400 text-xs">{s.sector ?? " -"}</td>
                        ))}
                        {stocks.length > 1 && <td className="py-2.5" />}
                      </tr>

                      {/* Config-driven metric rows with per-row winner + median */}
                      {METRIC_ROWS.map((row) => {
                        const vals = stocks.map((s) => row.get(s));
                        const present = vals.filter((v): v is number => v != null);
                        const best =
                          row.better && present.length > 1
                            ? row.better === "low"
                              ? Math.min(...present)
                              : Math.max(...present)
                            : null;
                        const med = median(vals);
                        return (
                          <tr key={row.label}>
                            <td className="py-2.5 text-zinc-400">{row.label}</td>
                            {stocks.map((s) => {
                              const v = row.get(s);
                              const isWinner = best != null && v != null && v === best;
                              return (
                                <td
                                  key={s.ticker}
                                  className={`py-2.5 text-right tabular-nums ${
                                    isWinner ? "text-emerald-400 font-semibold" : "text-zinc-100"
                                  }`}
                                >
                                  {v != null ? row.fmt(v) : " -"}
                                </td>
                              );
                            })}
                            {stocks.length > 1 && (
                              <td className="py-2.5 text-right text-zinc-500 tabular-nums">
                                {med != null ? row.fmt(med) : " -"}
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* 52-week range position bar (no winner) */}
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
                        {stocks.length > 1 && <td className="py-2.5" />}
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
                        {stocks.length > 1 && <td className="py-2.5" />}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </FloatingCard>
            </RevealOnScroll>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Profile Comparison ─────────────────────────── */}
              {radarData.length > 0 && (
                <RevealOnScroll>
                  <FloatingCard delay={0.3}>
                    <div className="p-5">
                      <h2 className="font-display font-semibold text-zinc-100 mb-1">Profile Comparison</h2>
                      <p className="text-[11px] text-zinc-500 mb-4">Normalized scores 0–100</p>
                      <div className="space-y-3">
                        {radarData.map((row) => {
                          const meta = PROFILE_METRICS.find((m) => m.key === row.metric);
                          return (
                          <div key={row.metric as string}>
                            <div className="flex items-center gap-1 mb-1 group/metric relative">
                              <p className="text-[11px] text-zinc-400">{row.metric as string}</p>
                              <span className="text-[10px] text-zinc-600 cursor-help select-none">ⓘ</span>
                              {meta && (
                                <div className="absolute left-0 top-5 z-20 hidden group-hover/metric:block w-56 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] text-zinc-300 shadow-xl leading-relaxed">
                                  {meta.desc}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {stocks.map((s, i) => {
                                const score = row[s.ticker] as number;
                                return (
                                  <div key={s.ticker} className="flex items-center gap-2">
                                    <span className="text-[10px] w-10 shrink-0 tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>{s.ticker}</span>
                                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${score}%`, background: COLORS[i % COLORS.length], opacity: 0.75 }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-zinc-500 w-6 text-right tabular-nums">{score}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ); })}
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
                            <Tooltip
                              cursor={false}
                              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: "#a1a1aa" }}
                              itemStyle={{ color: "#e4e4e7" }}
                              formatter={(v: number) => [fmtB(v), "Market Cap"]}
                            />
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
