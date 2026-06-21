"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { RotateCcw, Info, TrendingUp, AlertTriangle, Lightbulb, BookOpen, Search, Loader2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { api } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Reverse DCF: What growth rate does the current price imply? ─────────────

interface ReverseDCFInputs {
  ticker: string;
  currentPrice: number;
  sharesOutstanding: number;
  currentFCF: number;
  discountRate: number;
  terminalGrowthRate: number;
  netCash: number;
}

interface Fundamentals {
  ticker: string;
  name: string | null;
  price: number | null;
  shares_outstanding: number | null;
  market_cap: number | null;
  fcf: number | null;
  total_cash: number | null;
  total_debt: number | null;
  net_cash: number | null;
  revenue_growth: number | null;
  earnings_growth: number | null;
  profit_margins: number | null;
  operating_margins: number | null;
  trailing_pe: number | null;
  forward_pe: number | null;
  beta: number | null;
}

function solveImpliedGrowth(inputs: ReverseDCFInputs): number {
  const { currentPrice, sharesOutstanding, currentFCF, discountRate, terminalGrowthRate, netCash } = inputs;
  const targetEV = currentPrice * sharesOutstanding - netCash;
  const r = discountRate / 100;
  const tg = terminalGrowthRate / 100;

  function evForGrowth(growthPct: number): number {
    const g = growthPct / 100;
    let fcf = currentFCF;
    let totalPV = 0;

    for (let y = 1; y <= 10; y++) {
      fcf = fcf * (1 + g);
      totalPV += fcf / Math.pow(1 + r, y);
    }

    const terminalFCF = fcf * (1 + tg);
    const terminalValue = r > tg ? terminalFCF / (r - tg) : 0;
    const pvTerminal = terminalValue / Math.pow(1 + r, 10);

    return totalPV + pvTerminal;
  }

  let lo = -30, hi = 60;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const ev = evForGrowth(mid);
    if (ev < targetEV) lo = mid;
    else hi = mid;
    if (Math.abs(hi - lo) < 0.01) break;
  }

  return (lo + hi) / 2;
}

const BENCHMARKS = [
  { label: "GDP growth", value: 2.5 },
  { label: "S&P 500 avg earnings growth", value: 7 },
  { label: "Tech sector avg", value: 12 },
  { label: "Hyper-growth", value: 25 },
];

const EMPTY_INPUTS: ReverseDCFInputs = {
  ticker: "",
  currentPrice: 0,
  sharesOutstanding: 0,
  currentFCF: 0,
  discountRate: 10,
  terminalGrowthRate: 3,
  netCash: 0,
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReverseDCFPage() {
  const [inputs, setInputs] = useState(EMPTY_INPUTS);
  const [tickerInput, setTickerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function set<K extends keyof ReverseDCFInputs>(key: K, value: ReverseDCFInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const loadTicker = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setLoading(true);
    setLoadError(null);

    try {
      const data: Fundamentals & { error?: string } = await api.get(`/markets/fundamentals/${ticker.toUpperCase()}`);
      if (data.error) {
        setLoadError(`Could not find data for ${ticker.toUpperCase()}`);
        setLoading(false);
        return;
      }

      setFundamentals(data);

      const riskFreeRate = 4.5;
      const marketPremium = 5.5;
      const beta = data.beta ?? 1;
      const wacc = Math.round((riskFreeRate + beta * marketPremium) * 10) / 10;

      setInputs({
        ticker: data.ticker,
        currentPrice: data.price ?? 0,
        sharesOutstanding: data.shares_outstanding ?? 0,
        currentFCF: data.fcf ?? 0,
        discountRate: Math.max(wacc, 7),
        terminalGrowthRate: 3,
        netCash: data.net_cash ?? 0,
      });
    } catch {
      setLoadError(`Failed to load data for ${ticker.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTickerChange(value: string) {
    setTickerInput(value);
    clearTimeout(debounceRef.current);
    if (value.length >= 1) {
      debounceRef.current = setTimeout(() => loadTicker(value), 800);
    }
  }

  function handleTickerSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    if (tickerInput) loadTicker(tickerInput);
  }

  const hasData = inputs.currentFCF !== 0 && inputs.sharesOutstanding !== 0 && inputs.currentPrice !== 0;

  const impliedGrowth = useMemo(() => {
    if (!hasData) return 0;
    return solveImpliedGrowth(inputs);
  }, [inputs, hasData]);

  const isReasonable = impliedGrowth >= 0 && impliedGrowth <= 15;
  const isAggressive = impliedGrowth > 15 && impliedGrowth <= 30;
  const isUnrealistic = impliedGrowth > 30 || impliedGrowth < -10;

  let verdictColor = "text-gain";
  let verdictBg = "bg-gain/10";
  let verdictLabel = "Reasonable";
  let verdictDesc = "The market expects modest, achievable growth";
  if (isAggressive) {
    verdictColor = "text-amber-400";
    verdictBg = "bg-amber-400/10";
    verdictLabel = "Aggressive";
    verdictDesc = "The market is pricing in high growth  - any slowdown means downside";
  }
  if (isUnrealistic) {
    verdictColor = "text-loss";
    verdictBg = "bg-loss/10";
    verdictLabel = impliedGrowth > 30 ? "Extremely aggressive" : "Market expects decline";
    verdictDesc = impliedGrowth > 30
      ? "Current price implies near-impossible sustained growth"
      : "The market is pricing in declining free cash flow";
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <RotateCcw className="w-6 h-6 text-vela-teal" />
          Reverse DCF
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          What growth rate is the market pricing in? Work backwards from the current stock price.
        </p>
      </div>

      {/* Ticker search */}
      <form onSubmit={handleTickerSubmit} className="vela-card flex items-center gap-3">
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={tickerInput}
          onChange={(e) => handleTickerChange(e.target.value.toUpperCase())}
          placeholder="Enter ticker symbol (e.g. AAPL, MSFT, NVDA)"
          className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 outline-none text-sm"
          autoFocus
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-vela-teal animate-spin" />
        ) : (
          <button type="submit" className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors">
            Load
          </button>
        )}
      </form>

      {loadError && (
        <div className="vela-card px-4 py-2 border-rose-500/20">
          <p className="text-xs text-rose-400">{loadError}</p>
        </div>
      )}

      {/* Loaded fundamentals */}
      {fundamentals && !loadError && (
        <div className="vela-card px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-zinc-100">{fundamentals.name}</p>
              <p className="text-xs text-zinc-500">{fundamentals.ticker}</p>
            </div>
            <p className="text-lg font-bold tabular text-zinc-100">
              ${fundamentals.price?.toFixed(2) ?? " -"}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
            <FundRow label="Market Cap" value={fundamentals.market_cap ? `$${(fundamentals.market_cap / 1000).toFixed(0)}B` : " -"} />
            <FundRow label="FCF (TTM)" value={fundamentals.fcf ? `$${(fundamentals.fcf / 1000).toFixed(1)}B` : "N/A"} warn={!fundamentals.fcf} />
            <FundRow label="Shares" value={fundamentals.shares_outstanding ? `${(fundamentals.shares_outstanding / 1000).toFixed(1)}B` : " -"} />
            <FundRow label="Rev Growth" value={fundamentals.revenue_growth != null ? `${fundamentals.revenue_growth.toFixed(1)}%` : " -"} />
          </div>
          {!fundamentals.fcf && (
            <p className="text-[10px] text-amber-400 mt-2">
              FCF data not available  - enter it manually below.
            </p>
          )}
        </div>
      )}

      {!hasData && !loading && (
        <div className="vela-card text-center py-12">
          <RotateCcw className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 font-medium">Enter a ticker to begin</p>
          <p className="text-zinc-500 text-sm mt-1">
            We&apos;ll auto-load price, FCF, shares, and calculate the implied growth rate the market expects.
          </p>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Inputs ────────────────────────────────────────────────── */}
          <div className="vela-card space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Inputs</h2>

            <Field label="Current Price ($)" value={inputs.currentPrice} onChange={(v) => set("currentPrice", Number(v))} step={1} />
            <Field label="Shares Outstanding (M)" value={inputs.sharesOutstanding} onChange={(v) => set("sharesOutstanding", Number(v))} step={100} />
            <Field label="Current FCF ($M)" value={inputs.currentFCF} onChange={(v) => set("currentFCF", Number(v))} step={1000} />
            <Field label="Discount Rate (%)" value={inputs.discountRate} onChange={(v) => set("discountRate", Number(v))} step={0.5} min={1} max={30} />
            <Field label="Terminal Growth (%)" value={inputs.terminalGrowthRate} onChange={(v) => set("terminalGrowthRate", Number(v))} step={0.5} min={0} max={5} />
            <Field label="Net Cash ($M)" value={inputs.netCash} onChange={(v) => set("netCash", Number(v))} step={1000} />

            <p className="text-[10px] text-zinc-600">
              Auto-loaded from {inputs.ticker}. Adjust as needed.
            </p>
          </div>

          {/* ── Results ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Implied growth */}
            <div className={`vela-card border ${isReasonable ? "border-gain/30" : isAggressive ? "border-amber-400/30" : "border-loss/30"}`}>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                {inputs.ticker}  - Implied FCF Growth Rate
              </p>
              <div className="flex items-center gap-4">
                <p className={`text-4xl font-bold tabular ${verdictColor}`}>
                  {impliedGrowth.toFixed(1)}%
                </p>
                <div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${verdictBg} ${verdictColor}`}>
                    {verdictLabel}
                  </span>
                  <p className="text-xs text-zinc-500 mt-1">{verdictDesc}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-3">
                At a {inputs.discountRate}% discount rate and {inputs.terminalGrowthRate}% terminal growth,
                the current price of ${inputs.currentPrice.toFixed(2)} implies {inputs.ticker} must grow
                FCF at {impliedGrowth.toFixed(1)}% annually for the next 10 years.
              </p>
              {fundamentals?.revenue_growth != null && (
                <p className="text-xs mt-2">
                  <span className="text-zinc-500">Recent revenue growth: </span>
                  <span className={`font-medium ${
                    fundamentals.revenue_growth > impliedGrowth ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {fundamentals.revenue_growth.toFixed(1)}%
                  </span>
                  <span className="text-zinc-600">
                    {fundamentals.revenue_growth > impliedGrowth
                      ? "  - currently outpacing what the market requires"
                      : "  - below what the market is pricing in"}
                  </span>
                </p>
              )}
            </div>

            {/* Benchmark comparison */}
            <div className="vela-card">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">How does that compare?</h3>
              <div className="space-y-3">
                {BENCHMARKS.map((b) => {
                  const pct = Math.min(100, Math.max(0, (b.value / 35) * 100));
                  const impliedPct = Math.min(100, Math.max(0, (impliedGrowth / 35) * 100));
                  return (
                    <div key={b.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-400">{b.label}</span>
                        <span className="tabular text-zinc-500">{b.value}%</span>
                      </div>
                      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="absolute h-full rounded-full bg-zinc-700"
                          style={{ width: `${pct}%` }}
                        />
                        <div
                          className={`absolute top-0 w-0.5 h-full ${verdictColor.replace("text-", "bg-")}`}
                          style={{ left: `${impliedPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-2">
                  <div className={`w-2 h-2 rounded-full ${verdictColor.replace("text-", "bg-")}`} />
                  <span>Implied growth for {inputs.ticker} ({impliedGrowth.toFixed(1)}%)</span>
                </div>
              </div>
            </div>

            {/* Insights */}
            <ReverseDCFInsights inputs={inputs} impliedGrowth={impliedGrowth} fundamentals={fundamentals} />

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-[10px] text-zinc-600">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Implied growth is a simplified estimate assuming constant growth and a single discount rate.
                Real-world valuations are more nuanced. Not investment advice.
              </span>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
    </TierGate>
  );
}


// ── Helpers ──────────────────────────────────────────────────────────────────

function FundRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={warn ? "text-amber-400 font-medium" : "text-zinc-300 font-medium tabular"}>{value}</span>
    </div>
  );
}

function Field({
  label, value, onChange, type = "number", step, min, max,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className="input-field w-full tabular"
      />
    </div>
  );
}


// ── Dynamic insight panel ───────────────────────────────────────────────────

function ReverseDCFInsights({ inputs, impliedGrowth, fundamentals }: {
  inputs: ReverseDCFInputs;
  impliedGrowth: number;
  fundamentals: Fundamentals | null;
}) {
  const insights: { icon: React.ReactNode; title: string; body: string; color: string }[] = [];

  // Reasonable growth
  if (impliedGrowth >= 0 && impliedGrowth <= 8) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Low expectations priced in",
      body: `${impliedGrowth.toFixed(1)}% is around or below S&P 500 average  - typical for mature businesses. `
        + `If ${inputs.ticker} can outperform through new products or expansion, there's upside potential. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > impliedGrowth
          ? `Current revenue growth of ${fundamentals.revenue_growth.toFixed(1)}% already exceeds what the market requires.`
          : `Low bar means less risk on misses.`),
      color: "text-emerald-400",
    });
  }

  // Moderate 8-15%
  if (impliedGrowth > 8 && impliedGrowth <= 15) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Above-average growth expected",
      body: `${impliedGrowth.toFixed(1)}% for 10 years is achievable with strong moats. `
        + `Companies like MSFT, V, and GOOG have sustained this pace. `
        + `The key question: does ${inputs.ticker} have durable competitive advantages? `
        + (fundamentals?.trailing_pe
          ? `Current P/E of ${fundamentals.trailing_pe}x ${fundamentals.trailing_pe > 30 ? "is elevated" : "seems reasonable"} for this growth expectation.`
          : ``),
      color: "text-zinc-400",
    });
  }

  // Aggressive 15-30%
  if (impliedGrowth > 15 && impliedGrowth <= 30) {
    insights.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "High growth priced in  - elevated risk",
      body: `<5% of large caps sustain ${impliedGrowth.toFixed(0)}%+ FCF growth for a decade. `
        + `If growth comes in at 12% instead of ${impliedGrowth.toFixed(0)}%, corrections tend to be sharp (20-30%+). `
        + `Position sizing should reflect this risk.`,
      color: "text-amber-400",
    });
  }

  // Extreme >30%
  if (impliedGrowth > 30) {
    insights.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "Near-perfect execution required",
      body: `${impliedGrowth.toFixed(0)}%+ for a decade is almost unheard of at scale. `
        + `Needs market expansion, margin improvement, and no competitive disruption  - simultaneously. `
        + `One bad quarter can trigger 20-30% drawdowns at this valuation.`,
      color: "text-loss",
    });
  }

  // Negative
  if (impliedGrowth < 0) {
    insights.push({
      icon: <BookOpen className="w-4 h-4" />,
      title: "Decline priced in  - potential contrarian opportunity",
      body: `Market expects ${inputs.ticker}'s cash flows to shrink. `
        + `Could be rational (secular decline) or an overreaction. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > 0
          ? `Interesting: revenue is actually growing at ${fundamentals.revenue_growth.toFixed(1)}%  - the market may be pricing in a reversal that hasn't happened yet.`
          : `Understand the bear case before considering a position.`),
      color: "text-zinc-400",
    });
  }

  // Portfolio context
  insights.push({
    icon: <BookOpen className="w-4 h-4" />,
    title: "How to use this",
    body: `Run Reverse DCF on all your holdings. If most require 15%+ growth, your portfolio is growth-heavy  - `
      + `strong in bull markets, exposed in corrections. Mix low-implied-growth (5-8%) with moderate growth (10-15%) `
      + `to balance risk. Compare with the forward DCF to form your own view.`,
    color: "text-zinc-400",
  });

  return (
    <div className="vela-card bg-zinc-900/50 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-vela-teal" />
        What this means
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 ${insight.color}`}>{insight.icon}</div>
            <div>
              <p className="text-xs font-medium text-zinc-300">{insight.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
