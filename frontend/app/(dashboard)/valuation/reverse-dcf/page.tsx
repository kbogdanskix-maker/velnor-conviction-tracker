"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import {
  TopBar, PageHero, StatStrip, StatCell, Section, Eyebrow, Prose,
} from "@/components/instrument";

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

// ── Shared class strings ────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded bg-vela-card border border-vela-border px-2.5 py-1.5 " +
  "font-mono text-[13px] tabular-nums text-zinc-100 placeholder-vela-muted " +
  "outline-none transition-colors focus:border-vela-teal/60";

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

  const isAggressive = impliedGrowth > 15 && impliedGrowth <= 30;
  const isUnrealistic = impliedGrowth > 30 || impliedGrowth < -10;

  let verdictColor = "text-gain";
  let verdictMarker = "bg-gain";
  let verdictLabel = "Reasonable";
  let verdictDesc = "The market expects modest, achievable growth";
  if (isAggressive) {
    verdictColor = "text-amber-400";
    verdictMarker = "bg-amber-400";
    verdictLabel = "Aggressive";
    verdictDesc = "The market is pricing in high growth, so any slowdown shows up in the price";
  }
  if (isUnrealistic) {
    verdictColor = "text-loss";
    verdictMarker = "bg-loss";
    verdictLabel = impliedGrowth > 30 ? "Extremely aggressive" : "Market expects decline";
    verdictDesc = impliedGrowth > 30
      ? "The current price implies near-impossible sustained growth"
      : "The market is pricing in declining free cash flow";
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "Reverse DCF" }]}
        note={
          loading
            ? "loading fundamentals"
            : hasData
              ? `${inputs.ticker} · 10 year horizon`
              : "no ticker loaded"
        }
      />

      <PageHero
        title="Reverse DCF"
        name={fundamentals?.name ?? undefined}
        meta={
          hasData
            ? `${inputs.ticker} · implied FCF growth`
            : "What growth is the price already pricing in?"
        }
        figure={hasData ? `${impliedGrowth.toFixed(1)}%` : undefined}
        figureSub={hasData ? verdictLabel : undefined}
        figureSubClass={verdictColor}
      />

      {/* ── Ticker ───────────────────────────────────────────────────────── */}

      <Section
        label="Ticker"
        prose="Load a company and the model works backwards from its market price to the free cash flow growth rate that price requires."
      >
        <form onSubmit={handleTickerSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vela-muted pointer-events-none" />
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => handleTickerChange(e.target.value.toUpperCase())}
              placeholder="Ticker symbol, e.g. AAPL"
              aria-label="Ticker symbol"
              className="w-full rounded bg-vela-card border border-vela-border pl-9 pr-24 py-2.5
                text-sm text-zinc-100 placeholder-vela-muted outline-none transition-colors
                focus:border-vela-teal/60"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="w-4 h-4 text-vela-teal animate-spin" />
              ) : (
                <button
                  type="submit"
                  className="font-mono text-[10px] uppercase tracking-wider text-vela-teal
                    hover:text-vela-teal-dim transition-colors"
                >
                  Load
                </button>
              )}
            </div>
          </div>
        </form>

        {loadError && (
          <p className="mt-2.5 font-mono text-[11px] text-loss">{loadError}</p>
        )}

        {/* Loaded fundamentals */}
        {fundamentals && !loadError && (
          <div className="mt-6 border-t border-vela-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <Eyebrow>{fundamentals.ticker} fundamentals</Eyebrow>
              <p className="font-mono text-[15px] tabular-nums text-zinc-100">
                ${fundamentals.price?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
              <FundCell label="Market cap" value={fundamentals.market_cap ? `$${(fundamentals.market_cap / 1000).toFixed(0)}B` : "—"} />
              <FundCell label="FCF (TTM)" value={fundamentals.fcf ? `$${(fundamentals.fcf / 1000).toFixed(1)}B` : "N/A"} warn={!fundamentals.fcf} />
              <FundCell label="Shares" value={fundamentals.shares_outstanding ? `${(fundamentals.shares_outstanding / 1000).toFixed(1)}B` : "—"} />
              <FundCell label="Rev growth" value={fundamentals.revenue_growth != null ? `${fundamentals.revenue_growth.toFixed(1)}%` : "—"} />
            </div>
            {!fundamentals.fcf && (
              <p className="mt-4 font-mono text-[11px] text-amber-400">
                No free cash flow figure came back. Enter it by hand below.
              </p>
            )}
          </div>
        )}

        {!hasData && !loading && (
          <div className="mt-6 border border-vela-border px-6 py-12 text-center">
            <Eyebrow>Nothing loaded</Eyebrow>
            <Prose className="mt-2.5 mx-auto max-w-[380px]">
              Enter a ticker above to begin. Price, free cash flow and share count load automatically,
              and the implied growth rate is solved from there.
            </Prose>
          </div>
        )}
      </Section>

      {hasData && (
        <>
          {/* ── Assumptions ──────────────────────────────────────────────── */}

          <Section
            label="Assumptions"
            prose="The inputs the solver runs on. Change any of them and the implied growth rate below recalculates."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
              <Field label="Current price ($)" value={inputs.currentPrice} onChange={(v) => set("currentPrice", Number(v))} step={1} />
              <Field label="Shares outstanding (M)" value={inputs.sharesOutstanding} onChange={(v) => set("sharesOutstanding", Number(v))} step={100} />
              <Field label="Current FCF ($M)" value={inputs.currentFCF} onChange={(v) => set("currentFCF", Number(v))} step={1000} />
              <Field label="Discount rate (%)" value={inputs.discountRate} onChange={(v) => set("discountRate", Number(v))} step={0.5} min={1} max={30} />
              <Field label="Terminal growth (%)" value={inputs.terminalGrowthRate} onChange={(v) => set("terminalGrowthRate", Number(v))} step={0.5} min={0} max={5} />
              <Field label="Net cash ($M)" value={inputs.netCash} onChange={(v) => set("netCash", Number(v))} step={1000} />
            </div>
            <p className="mt-5 font-mono text-[11px] text-vela-muted">
              Loaded from {inputs.ticker}
            </p>
          </Section>

          {/* ── Implied growth ───────────────────────────────────────────── */}

          <Section
            label="Implied growth"
            prose="The free cash flow growth rate that reconciles today's price with the assumptions above."
          >
            <StatStrip>
              <StatCell
                label="Implied FCF growth"
                value={`${impliedGrowth.toFixed(1)}%`}
                valueClass={verdictColor}
                sub={verdictLabel}
                subClass={verdictColor}
              />
              <StatCell
                label="Discount rate"
                value={`${inputs.discountRate}%`}
                sub="cost of capital"
              />
              <StatCell
                label="Terminal growth"
                value={`${inputs.terminalGrowthRate}%`}
                sub="beyond year 10"
              />
              <StatCell
                label="Recent rev growth"
                value={
                  fundamentals?.revenue_growth != null
                    ? `${fundamentals.revenue_growth.toFixed(1)}%`
                    : "—"
                }
                sub={
                  fundamentals?.revenue_growth != null
                    ? fundamentals.revenue_growth > impliedGrowth
                      ? "above the implied rate"
                      : "below the implied rate"
                    : "not reported"
                }
                subClass={
                  fundamentals?.revenue_growth != null
                    ? fundamentals.revenue_growth > impliedGrowth
                      ? "text-gain"
                      : "text-amber-400"
                    : "text-vela-body"
                }
              />
            </StatStrip>

            <Prose className="mt-5 max-w-[640px]">
              {verdictDesc}. At a {inputs.discountRate}% discount rate and {inputs.terminalGrowthRate}% terminal
              growth, the current price of ${inputs.currentPrice.toFixed(2)} implies {inputs.ticker} must grow
              free cash flow at {impliedGrowth.toFixed(1)}% a year for the next 10 years.
            </Prose>
          </Section>

          {/* ── Benchmarks ───────────────────────────────────────────────── */}

          <Section
            label="Benchmarks"
            prose="Where that implied rate falls against reference growth rates. The marker is the implied rate, the bar is the benchmark."
          >
            <div className="space-y-3">
              {BENCHMARKS.map((b) => {
                const pct = Math.min(100, Math.max(0, (b.value / 35) * 100));
                const impliedPct = Math.min(100, Math.max(0, (impliedGrowth / 35) * 100));
                return (
                  <div key={b.label}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-[13px] text-vela-body">{b.label}</span>
                      <span className="font-mono text-[11px] tabular-nums text-vela-muted">{b.value}%</span>
                    </div>
                    <div className="relative h-4 overflow-hidden rounded-sm border border-vela-border bg-vela-card">
                      <div
                        className="absolute h-full bg-vela-muted/20"
                        style={{ width: `${pct}%` }}
                      />
                      <div
                        className={`absolute top-0 w-0.5 h-full ${verdictMarker}`}
                        style={{ left: `${impliedPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-vela-muted">
              <span aria-hidden="true" className={`w-0.5 h-3 ${verdictMarker} inline-block`} />
              <span>Implied growth for {inputs.ticker} ({impliedGrowth.toFixed(1)}%)</span>
            </div>
          </Section>

          {/* ── Insights ─────────────────────────────────────────────────── */}

          <ReverseDCFInsights inputs={inputs} impliedGrowth={impliedGrowth} fundamentals={fundamentals} />

          <p className="mt-9 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
            Implied growth is a simplified estimate assuming constant growth and a single discount rate.
            Real-world valuations are more nuanced. Not investment advice.
          </p>
        </>
      )}
    </PageTransition>
    </TierGate>
  );
}


// ── Helpers ──────────────────────────────────────────────────────────────────

function FundCell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`mt-1 font-mono text-[13px] tabular-nums truncate ${
          warn ? "text-amber-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
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
    <label className="block min-w-0">
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className={fieldClass}
      />
    </label>
  );
}


// ── Dynamic insight panel ───────────────────────────────────────────────────

function ReverseDCFInsights({ inputs, impliedGrowth, fundamentals }: {
  inputs: ReverseDCFInputs;
  impliedGrowth: number;
  fundamentals: Fundamentals | null;
}) {
  const insights: { title: string; body: string }[] = [];

  // Reasonable growth
  if (impliedGrowth >= 0 && impliedGrowth <= 8) {
    insights.push({
      title: "Low expectations priced in",
      body: `${impliedGrowth.toFixed(1)}% sits around or below the S&P 500 average, which is typical for mature businesses. `
        + `Anything ${inputs.ticker} delivers above that pace is more than the current price requires. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > impliedGrowth
          ? `Revenue is currently growing at ${fundamentals.revenue_growth.toFixed(1)}%, ahead of what the price requires.`
          : `A lower bar leaves less distance to fall on a miss.`),
    });
  }

  // Moderate 8-15%
  if (impliedGrowth > 8 && impliedGrowth <= 15) {
    insights.push({
      title: "Above-average growth expected",
      body: `${impliedGrowth.toFixed(1)}% for 10 years is attainable for businesses with strong moats. `
        + `Names such as MSFT, V and GOOG have sustained that pace. `
        + `The open question is whether ${inputs.ticker} has comparably durable advantages. `
        + (fundamentals?.trailing_pe
          ? `The trailing P/E of ${fundamentals.trailing_pe}x ${fundamentals.trailing_pe > 30 ? "is elevated" : "is unremarkable"} against that expectation.`
          : ``),
    });
  }

  // Aggressive 15-30%
  if (impliedGrowth > 15 && impliedGrowth <= 30) {
    insights.push({
      title: "High growth priced in, elevated risk",
      body: `Fewer than 5% of large caps sustain ${impliedGrowth.toFixed(0)}%+ FCF growth for a decade. `
        + `If growth lands at 12% instead of ${impliedGrowth.toFixed(0)}%, repricings from this level have historically been sharp, often 20 to 30%. `
        + `That is the risk the current price carries.`,
    });
  }

  // Extreme >30%
  if (impliedGrowth > 30) {
    insights.push({
      title: "Near-perfect execution required",
      body: `${impliedGrowth.toFixed(0)}%+ for a decade is almost unheard of at scale. `
        + `It needs market expansion, margin improvement and no competitive disruption, all at once. `
        + `At this valuation a single weak quarter has historically triggered drawdowns of 20 to 30%.`,
    });
  }

  // Negative
  if (impliedGrowth < 0) {
    insights.push({
      title: "Decline priced in",
      body: `The market expects ${inputs.ticker}'s cash flows to shrink. `
        + `That can be rational, as in secular decline, or an overreaction. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > 0
          ? `Worth noting: revenue is still growing at ${fundamentals.revenue_growth.toFixed(1)}%, so the price reflects a reversal that has not shown up in the numbers yet.`
          : `The bear case is what the current price already reflects.`),
    });
  }

  // Portfolio context
  insights.push({
    title: "How to read this",
    body: `Running the same model across your holdings shows the shape of what you own. A book where most names `
      + `require 15%+ growth behaves differently from one spread across low and moderate implied rates: stronger in `
      + `bull markets, more exposed in corrections. The forward DCF is the other half of the picture.`,
  });

  return (
    <Section
      label="What this means"
      prose="Plain reading of the implied rate above. Descriptive only, not a recommendation."
    >
      <div className="border-y border-vela-border divide-y divide-vela-border">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 py-4">
            <span
              aria-hidden="true"
              className="mt-[7px] w-[7px] h-[7px] rotate-45 bg-vela-teal shrink-0"
            />
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-100">
                {insight.title}
              </p>
              <Prose className="mt-1.5 max-w-[640px]">{insight.body}</Prose>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
