"use client";

import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ExternalLink, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Lock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { useTickerInfo } from "@/hooks/useTickerInfo";
import { useOptionsChain } from "@/hooks/useOptions";
import type { OptionContract, OptionsChain } from "@/hooks/useOptions";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";

interface Props {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "overview" | "options";

export default function TickerDetailModal({ ticker, open, onOpenChange }: Props) {
  const { info, isLoading, hasError } = useTickerInfo(open ? ticker : null);
  const [tab, setTab] = useState<TabType>("overview");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-h-[85vh] overflow-y-auto bg-vela-card border border-vela-border rounded-lg shadow-xl transition-all ${tab === "options" ? "max-w-2xl" : "max-w-lg"}`}>
          {isLoading ? (
            <LoadingSkeleton />
          ) : hasError || !info ? (
            <ErrorState ticker={ticker} onClose={() => onOpenChange(false)} />
          ) : (
            <>
              {/* Header */}
              <div className="sticky top-0 bg-vela-card z-10 flex items-start justify-between px-5 py-4 border-b border-vela-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Dialog.Title className="text-lg font-semibold text-zinc-100">
                      {info.name || info.ticker}
                    </Dialog.Title>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-vela-teal/15 text-vela-teal">
                      {info.ticker}
                    </span>
                  </div>
                  {(info.sector || info.industry) && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {info.sector && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {info.sector}
                        </span>
                      )}
                      {info.industry && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {info.industry}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Dialog.Close className="ml-3 text-zinc-500 hover:text-zinc-100 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 px-5 pt-3 border-b border-vela-border">
                {(["overview", "options"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      tab === t
                        ? "text-vela-teal border-vela-teal"
                        : "text-zinc-500 border-transparent hover:text-zinc-300"
                    }`}
                  >
                    {t === "overview" ? "Overview" : "Options"}
                  </button>
                ))}
              </div>

              {tab === "overview" ? (
              <div className="p-5 space-y-5">
                {/* Description */}
                {info.description && (
                  <div>
                    <h3 className="text-sm text-zinc-400 font-medium mb-2">
                      What does {info.name?.split(" ")[0] || info.ticker} do?
                    </h3>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {info.description.length > 500
                        ? info.description.slice(0, 500) + "…"
                        : info.description}
                    </p>
                  </div>
                )}

                {/* Key Stats */}
                <div>
                  <h3 className="text-sm text-zinc-400 font-medium mb-3">
                    Key numbers
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="Market Cap"
                      value={info.market_cap != null ? formatCurrency(info.market_cap, "USD", true) : null}
                      hint="Total company value"
                    />
                    <StatCard
                      label="Price-to-Earnings"
                      value={info.trailing_pe != null ? info.trailing_pe.toFixed(1) + "x" : null}
                      hint="How much you pay per $1 of profit"
                    />
                    <StatCard
                      label="Beta"
                      value={info.beta != null ? info.beta.toFixed(2) : null}
                      hint={
                        info.beta != null
                          ? info.beta > 1
                            ? "More volatile than the market"
                            : info.beta < 1
                            ? "Less volatile than the market"
                            : "Moves with the market"
                          : "Volatility vs. market"
                      }
                    />
                    <StatCard
                      label="Dividend Yield"
                      value={info.dividend_yield != null ? formatPercent(info.dividend_yield * 100, false) : null}
                      hint="Annual income per share"
                    />
                  </div>
                </div>

                {/* 52-Week Range */}
                {info.fifty_two_week_low != null && info.fifty_two_week_high != null && (
                  <div>
                    <h3 className="text-sm text-zinc-400 font-medium mb-3">
                      52-Week Range
                    </h3>
                    <RangeBar low={info.fifty_two_week_low} high={info.fifty_two_week_high} />
                  </div>
                )}

                {/* Margins */}
                {(info.gross_margins != null || info.operating_margins != null || info.profit_margins != null) && (
                  <div>
                    <h3 className="text-sm text-zinc-400 font-medium mb-3">
                      Profitability
                    </h3>
                    <div className="space-y-2">
                      {info.gross_margins != null && (
                        <MarginBar label="Gross Margin" value={info.gross_margins} />
                      )}
                      {info.operating_margins != null && (
                        <MarginBar label="Operating Margin" value={info.operating_margins} />
                      )}
                      {info.profit_margins != null && (
                        <MarginBar label="Net Margin" value={info.profit_margins} />
                      )}
                    </div>
                  </div>
                )}

                {/* Volume */}
                {info.average_volume != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Avg. Daily Volume</span>
                    <span className="text-zinc-300 tabular">{formatNumber(info.average_volume, 0)}</span>
                  </div>
                )}

                {/* Website link */}
                {info.website && (
                  <a
                    href={info.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-vela-teal hover:text-vela-teal-dim transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {info.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
              ) : (
                <OptionsTab ticker={info.ticker} />
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Options Tab ────────────────────────────────────────────────────────────

function daysToExpiry(expiry: string): number {
  const now = new Date();
  const exp = new Date(expiry);
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatExpiry(exp: string): string {
  const d = new Date(exp);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function OptionsTab({ ticker }: { ticker: string }) {
  const { data: chain, isLoading, error } = useOptionsChain(ticker);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [showPro, setShowPro] = useState(false);

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-40 w-full rounded-lg" />
        <div className="skeleton h-6 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-center py-12">
        <p className="text-sm text-zinc-400">Could not load options data.</p>
        <p className="text-xs text-zinc-600 mt-1">Check that the backend server is running on port 8000.</p>
      </div>
    );
  }

  if (!chain || chain.expiries.length === 0) {
    return (
      <div className="p-5 text-center py-12">
        <p className="text-sm text-zinc-400">No options data available for {ticker}.</p>
        <p className="text-xs text-zinc-600 mt-1">This security may not have listed options, or data is temporarily unavailable.</p>
      </div>
    );
  }

  const expiry = selectedExpiry || chain.expiries[0];

  return (
    <div className="p-5 space-y-5">
      {/* Expiry selector  - scrollable with DTE labels */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Expiration date</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {chain.expiries.map((exp) => {
            const dte = daysToExpiry(exp);
            const active = exp === expiry;
            return (
              <button
                key={exp}
                onClick={() => setSelectedExpiry(exp)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                  active
                    ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-transparent"
                }`}
              >
                <span className="font-medium">{formatExpiry(exp)}</span>
                <span className={`text-[10px] mt-0.5 ${active ? "text-vela-teal/70" : "text-zinc-600"}`}>
                  {dte}d
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Implied price range  - hero visual */}
      <ImpliedRangeBar chain={chain} expiry={expiry} />

      {/* Key metrics row */}
      <OptionsMetrics chain={chain} expiry={expiry} />

      {/* OI by Strike Chart  - main chart */}
      <OptionsOIChart chain={chain} expiry={expiry} />

      {/* Pro section  - IV skew + raw chain */}
      <div className="border-t border-vela-border pt-4">
        <button
          onClick={() => setShowPro(!showPro)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
        >
          {showPro ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span className="font-medium">Detailed view</span>
          <span className="text-zinc-600"> - IV skew, full chain</span>
        </button>

        {showPro && (
          <div className="mt-4 space-y-5">
            <IVByStrike chain={chain} expiry={expiry} />
            <RawChainSection chain={chain} expiry={expiry} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Implied Price Range Bar ───────────────────────────────────────────────

function ImpliedRangeBar({ chain, expiry }: { chain: OptionsChain; expiry: string }) {
  const stats = useMemo(() => {
    const calls = chain.chains[expiry]?.calls || [];
    const puts = chain.chains[expiry]?.puts || [];
    const price = chain.currentPrice;
    if (!price || price === 0 || calls.length === 0 || puts.length === 0) return null;

    const atmCall = calls.reduce((best, c) =>
      Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best, calls[0]);
    const atmPut = puts.reduce((best, p) =>
      Math.abs(p.strike - price) < Math.abs(best.strike - price) ? p : best, puts[0]);

    const straddle = (atmCall?.lastPrice ?? atmCall?.ask ?? 0) + (atmPut?.lastPrice ?? atmPut?.ask ?? 0);
    const impliedPct = price > 0 ? (straddle / price) * 100 : 0;
    const lo = price - straddle;
    const hi = price + straddle;

    return { price, lo, hi, straddle, impliedPct };
  }, [chain, expiry]);

  if (!stats) return null;

  // Position indicator: price is in the center
  const rangeWidth = stats.hi - stats.lo;
  const pricePos = rangeWidth > 0 ? ((stats.price - stats.lo) / rangeWidth) * 100 : 50;

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-400 font-medium">Implied price range</p>
        <p className="text-xs text-zinc-500">
          by expiry ({daysToExpiry(expiry)}d)
        </p>
      </div>

      {/* Price labels row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold tabular text-loss">${stats.lo.toFixed(2)}</span>
        <span className="text-sm font-bold tabular text-zinc-100">${stats.price.toFixed(2)}</span>
        <span className="text-sm font-bold tabular text-gain">${stats.hi.toFixed(2)}</span>
      </div>

      {/* Visual range bar */}
      <div className="relative h-3 bg-zinc-700/50 rounded-full overflow-hidden">
        {/* Gradient fill */}
        <div className="absolute inset-0 bg-gradient-to-r from-loss/40 via-zinc-500/20 to-gain/40 rounded-full" />
        {/* Current price marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-zinc-100"
          style={{ left: `${pricePos}%` }}
        />
      </div>

      {/* Labels below */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-loss/80">−{stats.impliedPct.toFixed(1)}%</span>
        <span className="text-[10px] text-zinc-500">
          ATM straddle: ${stats.straddle.toFixed(2)} (±{stats.impliedPct.toFixed(1)}%)
        </span>
        <span className="text-[10px] text-gain/80">+{stats.impliedPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Options Key Metrics ──────────────────────────────────────────────────

function OptionsMetrics({ chain, expiry }: { chain: OptionsChain; expiry: string }) {
  const stats = useMemo(() => {
    const calls = chain.chains[expiry]?.calls || [];
    const puts = chain.chains[expiry]?.puts || [];
    const price = chain.currentPrice;
    if (!price || price === 0) return null;

    const totalCallOI = calls.reduce((s, c) => s + (c.openInterest || 0), 0);
    const totalPutOI = puts.reduce((s, p) => s + (p.openInterest || 0), 0);
    const totalOI = totalCallOI + totalPutOI;

    // Max pain  - only meaningful when there's OI data
    let maxPainStrike = price;
    if (totalOI > 0) {
      const strikeSet = new Set(Array.from(calls.map(c => c.strike)).concat(puts.map(p => p.strike)));
      const strikes = Array.from(strikeSet).sort((a, b) => a - b);
      let minPain = Infinity;
      for (const s of strikes) {
        let pain = 0;
        for (const c of calls) {
          if (s > c.strike) pain += (s - c.strike) * (c.openInterest || 0);
        }
        for (const p of puts) {
          if (s < p.strike) pain += (p.strike - s) * (p.openInterest || 0);
        }
        if (pain < minPain) { minPain = pain; maxPainStrike = s; }
      }
    }

    const pcRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : null;
    const totalVol = calls.reduce((s, c) => s + (c.volume || 0), 0) + puts.reduce((s, p) => s + (p.volume || 0), 0);

    return { maxPainStrike, pcRatio, totalVol, totalCallOI, totalPutOI, totalOI, price };
  }, [chain, expiry]);

  if (!stats) return null;

  const sentimentLabel = stats.pcRatio == null ? "No OI data" : stats.pcRatio > 1.2 ? "Bearish" : stats.pcRatio > 0.8 ? "Neutral" : "Bullish";
  const sentimentColor = stats.pcRatio == null ? "text-zinc-600" : stats.pcRatio > 1.2 ? "text-loss" : stats.pcRatio > 0.8 ? "text-zinc-400" : "text-gain";

  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricBox
        label="Max Pain"
        value={stats.totalOI > 0 ? `$${stats.maxPainStrike.toFixed(0)}` : " -"}
        sub={stats.totalOI > 0
          ? stats.maxPainStrike > stats.price
            ? `${((stats.maxPainStrike / stats.price - 1) * 100).toFixed(1)}% above spot`
            : `${((1 - stats.maxPainStrike / stats.price) * 100).toFixed(1)}% below spot`
          : "Insufficient OI"}
      />
      <MetricBox
        label="Put/Call OI"
        value={stats.pcRatio != null ? stats.pcRatio.toFixed(2) : " -"}
        sub={sentimentLabel}
        subColor={sentimentColor}
      />
      <MetricBox
        label="Volume"
        value={stats.totalVol >= 1000 ? `${(stats.totalVol / 1000).toFixed(1)}k` : stats.totalVol.toLocaleString()}
        sub="contracts today"
      />
    </div>
  );
}

function MetricBox({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold tabular text-zinc-100">{value}</p>
      <p className={`text-[10px] mt-0.5 ${subColor || "text-zinc-600"}`}>{sub}</p>
    </div>
  );
}

// ── OI by Strike Chart ───────────────────────────────────────────────────

function OptionsOIChart({ chain, expiry }: { chain: OptionsChain; expiry: string }) {
  const [activeStrike, setActiveStrike] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const calls = chain.chains[expiry]?.calls || [];
    const puts = chain.chains[expiry]?.puts || [];
    const price = chain.currentPrice || 0;

    const strikeMap = new Map<number, { strike: number; callOI: number; putOI: number }>();

    for (const c of calls) {
      if (!c.strike) continue;
      const existing = strikeMap.get(c.strike) || { strike: c.strike, callOI: 0, putOI: 0 };
      existing.callOI = c.openInterest || 0;
      strikeMap.set(c.strike, existing);
    }
    for (const p of puts) {
      if (!p.strike) continue;
      const existing = strikeMap.get(p.strike) || { strike: p.strike, callOI: 0, putOI: 0 };
      existing.putOI = p.openInterest || 0;
      strikeMap.set(p.strike, existing);
    }

    const lo = price * 0.85;
    const hi = price * 1.15;
    return Array.from(strikeMap.values())
      .filter(d => d.strike >= lo && d.strike <= hi)
      .sort((a, b) => a.strike - b.strike);
  }, [chain, expiry]);

  if (chartData.length === 0) return null;

  const price = chain.currentPrice || 0;

  return (
    <div>
      <h4 className="text-xs text-zinc-400 font-medium mb-2">Open Interest by Strike</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barGap={0}
            barCategoryGap="10%"
            onMouseLeave={() => setActiveStrike(null)}
          >
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              width={36}
            />
            <Tooltip cursor={false}
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#a1a1aa", fontSize: 10 }}
              formatter={(value: number, name: string) => [
                value.toLocaleString(),
                name === "callOI" ? "Call OI" : "Put OI",
              ]}
              labelFormatter={(label: number) => `Strike $${label}`}
            />
            <ReferenceLine x={Number(chartData.reduce((best, d) => Math.abs(d.strike - price) < Math.abs(best - price) ? d.strike : best, chartData[0].strike))} stroke="#14b8a6" strokeDasharray="3 3" strokeWidth={1} />
            <Bar
              dataKey="callOI"
              name="callOI"
              radius={[2, 2, 0, 0]}
              activeBar={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onMouseEnter={(data: any) => setActiveStrike(data?.strike ?? null)}
            >
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.strike === activeStrike
                      ? "rgba(20, 184, 166, 0.85)"
                      : d.strike <= price ? "rgba(52, 211, 153, 0.6)" : "rgba(52, 211, 153, 0.3)"
                  }
                />
              ))}
            </Bar>
            <Bar
              dataKey="putOI"
              name="putOI"
              radius={[2, 2, 0, 0]}
              activeBar={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onMouseEnter={(data: any) => setActiveStrike(data?.strike ?? null)}
            >
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.strike === activeStrike
                      ? "rgba(20, 184, 166, 0.85)"
                      : d.strike >= price ? "rgba(244, 63, 94, 0.6)" : "rgba(244, 63, 94, 0.3)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1.5">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-gain/60" /> Calls
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-loss/60" /> Puts
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-vela-teal" /> Spot price
        </span>
      </div>
    </div>
  );
}

// ── IV by Strike (smile/skew) ──────────────────────────────────────────────

function IVByStrike({ chain, expiry }: { chain: OptionsChain; expiry: string }) {
  const data = useMemo(() => {
    const calls = chain.chains[expiry]?.calls || [];
    const price = chain.currentPrice || 0;
    const lo = price * 0.85;
    const hi = price * 1.15;

    return calls
      .filter(c => c.strike >= lo && c.strike <= hi && c.impliedVolatility != null && c.impliedVolatility > 0 && c.impliedVolatility < 5)
      .map(c => ({
        strike: c.strike,
        iv: Math.round((c.impliedVolatility || 0) * 100),
      }))
      .sort((a, b) => a.strike - b.strike);
  }, [chain, expiry]);

  if (data.length < 3) return null;

  return (
    <div>
      <h4 className="text-xs text-zinc-400 font-medium mb-2">IV Skew by Strike</h4>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="15%">
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickFormatter={(v: number) => `${v}%`}
              width={36}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip cursor={false}
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }}
              formatter={(value: number) => [`${value}%`, "IV"]}
              labelFormatter={(label: number) => `Strike $${label}`}
            />
            <Bar dataKey="iv" fill="rgba(20, 184, 166, 0.5)" activeBar={{ fill: "rgba(20, 184, 166, 0.85)" }} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-zinc-600 mt-1">
        Higher IV at lower strikes = put skew (downside protection is expensive). Typical for equities.
      </p>
    </div>
  );
}

// ── Raw Chain Section ──────────────────────────────────────────────────────

function RawChainSection({ chain, expiry }: { chain: OptionsChain; expiry: string }) {
  const [tableSide, setTableSide] = useState<"calls" | "puts">("calls");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-zinc-400 font-medium">Full Chain</h4>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          {(["calls", "puts"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTableSide(s)}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                tableSide === s
                  ? s === "calls" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s === "calls" ? "Calls" : "Puts"}
            </button>
          ))}
        </div>
      </div>
      <RawChainTable contracts={chain.chains[expiry]?.[tableSide] || []} side={tableSide} />
    </div>
  );
}

function RawChainTable({ contracts, side }: { contracts: OptionContract[]; side: "calls" | "puts" }) {
  if (contracts.length === 0) {
    return <p className="text-xs text-zinc-500">No {side} for this expiry.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 border-b border-vela-border">
            <th className="text-left py-2 font-medium">Strike</th>
            <th className="text-right py-2 font-medium">Last</th>
            <th className="text-right py-2 font-medium">Bid</th>
            <th className="text-right py-2 font-medium">Ask</th>
            <th className="text-right py-2 font-medium">IV</th>
            <th className="text-right py-2 font-medium">OI</th>
            <th className="text-right py-2 font-medium">Vol</th>
          </tr>
        </thead>
        <tbody>
          {contracts.slice(0, 30).map((c, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-1.5 tabular text-zinc-100 font-medium">{c.strike?.toFixed(2)}</td>
              <td className="py-1.5 tabular text-right text-zinc-200">{c.lastPrice?.toFixed(2) ?? " -"}</td>
              <td className="py-1.5 tabular text-right text-zinc-400">{c.bid?.toFixed(2) ?? " -"}</td>
              <td className="py-1.5 tabular text-right text-zinc-400">{c.ask?.toFixed(2) ?? " -"}</td>
              <td className="py-1.5 tabular text-right text-vela-teal">
                {c.impliedVolatility != null ? `${(c.impliedVolatility * 100).toFixed(1)}%` : " -"}
              </td>
              <td className="py-1.5 tabular text-right text-zinc-400">
                {c.openInterest?.toLocaleString() ?? " -"}
              </td>
              <td className="py-1.5 tabular text-right text-zinc-400">
                {c.volume?.toLocaleString() ?? " -"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {contracts.length > 30 && (
        <p className="text-[10px] text-zinc-600 mt-2">
          Showing 30 of {contracts.length} contracts
        </p>
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-zinc-100 tabular">{value ?? " -"}</p>
      <p className="text-[11px] text-zinc-600 mt-0.5">{hint}</p>
    </div>
  );
}

// ── 52-Week Range Bar ──────────────────────────────────────────────────────

function RangeBar({ low, high }: { low: number; high: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-loss">
        <TrendingDown className="w-3 h-3" />
        <span className="text-xs tabular">{formatCurrency(low)}</span>
      </div>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-loss via-zinc-400 to-gain rounded-full" />
      </div>
      <div className="flex items-center gap-1 text-gain">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs tabular">{formatCurrency(high)}</span>
      </div>
    </div>
  );
}

// ── Margin Bar ─────────────────────────────────────────────────────────────

function MarginBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? "bg-gain" : "bg-loss"}`}
          style={{ width: `${Math.abs(pct)}%` }}
        />
      </div>
      <span className={`text-xs tabular w-12 text-right ${isPositive ? "text-gain" : "text-loss"}`}>
        {formatPercent(pct, false)}
      </span>
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <Dialog.Title className="sr-only">Loading ticker details</Dialog.Title>
      <div>
        <div className="skeleton h-6 w-48 mb-2" />
        <div className="flex gap-2">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-5 w-28 rounded-full" />
        </div>
      </div>
      <div>
        <div className="skeleton h-3 w-32 mb-3" />
        <div className="skeleton h-4 w-full mb-1.5" />
        <div className="skeleton h-4 w-full mb-1.5" />
        <div className="skeleton h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
            <div className="skeleton h-3 w-16 mb-1.5" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Error State ────────────────────────────────────────────────────────────

function ErrorState({ ticker, onClose }: { ticker: string | null; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-vela-border">
        <Dialog.Title className="text-lg font-semibold text-zinc-100">
          {ticker || "Unknown"}
        </Dialog.Title>
        <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
          <X className="w-4 h-4" />
        </Dialog.Close>
      </div>
      <div className="p-5 text-center py-12">
        <p className="text-sm text-zinc-400 mb-1">
          Detailed info isn&apos;t available for this ticker.
        </p>
        <p className="text-xs text-zinc-600">
          This may be an index, fund, or newly listed security.
        </p>
      </div>
    </>
  );
}
