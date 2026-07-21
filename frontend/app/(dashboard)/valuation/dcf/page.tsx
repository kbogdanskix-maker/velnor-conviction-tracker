"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import {
  TopBar, PageHero, StatStrip, StatCell, Section, Eyebrow, Prose, Legend,
} from "@/components/instrument";

// ── Types ───────────────────────────────────────────────────────────────────

interface DCFInputs {
  ticker: string;
  currentFCF: number;
  growthRateY1_5: number | null;
  growthRateY6_10: number | null;
  discountRate: number;
  terminalGrowthRate: number;
  sharesOutstanding: number;
  currentPrice: number;
  netDebt: number;
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

// ── DCF Math ────────────────────────────────────────────────────────────────

interface DCFResult {
  projectedFCF: { year: number; fcf: number; pv: number }[];
  totalPVofFCF: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  intrinsicPrice: number;
  marginOfSafety: number;
}

function runDCF(inputs: DCFInputs): DCFResult {
  const {
    currentFCF, growthRateY1_5, growthRateY6_10,
    discountRate, terminalGrowthRate, sharesOutstanding, currentPrice, netDebt,
  } = inputs;

  const r = discountRate / 100;
  const g1 = (growthRateY1_5 ?? 0) / 100;
  const g2 = (growthRateY6_10 ?? 0) / 100;
  const tg = terminalGrowthRate / 100;

  const projected: { year: number; fcf: number; pv: number }[] = [];
  let fcf = currentFCF;

  for (let y = 1; y <= 10; y++) {
    const growth = y <= 5 ? g1 : g2;
    fcf = fcf * (1 + growth);
    const pv = fcf / Math.pow(1 + r, y);
    projected.push({ year: y, fcf: Math.round(fcf), pv: Math.round(pv) });
  }

  const totalPV = projected.reduce((s, p) => s + p.pv, 0);
  const terminalFCF = projected[projected.length - 1].fcf * (1 + tg);
  const terminalValue = r > tg ? terminalFCF / (r - tg) : 0;
  const pvTerminal = terminalValue / Math.pow(1 + r, 10);
  const enterpriseValue = totalPV + pvTerminal;
  const equityValue = enterpriseValue - netDebt;
  const intrinsicPrice = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;
  const marginOfSafety = currentPrice > 0
    ? ((intrinsicPrice - currentPrice) / currentPrice) * 100
    : 0;

  return {
    projectedFCF: projected,
    totalPVofFCF: Math.round(totalPV),
    terminalValue: Math.round(terminalValue),
    pvTerminalValue: Math.round(pvTerminal),
    enterpriseValue: Math.round(enterpriseValue),
    equityValue: Math.round(equityValue),
    intrinsicPrice,
    marginOfSafety,
  };
}

function sensitivityTable(
  inputs: DCFInputs,
  growthSteps: number[],
  discountSteps: number[],
): number[][] {
  return discountSteps.map((dr) =>
    growthSteps.map((gr) => {
      const result = runDCF({ ...inputs, growthRateY1_5: gr, discountRate: dr });
      return result.intrinsicPrice;
    }),
  );
}

// ── Defaults ────────────────────────────────────────────────────────────────

const EMPTY_INPUTS: DCFInputs = {
  ticker: "",
  currentFCF: 0,
  growthRateY1_5: null,
  growthRateY6_10: null,
  discountRate: 10,
  terminalGrowthRate: 3,
  sharesOutstanding: 0,
  currentPrice: 0,
  netDebt: 0,
};

// ── Shared class strings ────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded bg-vela-card border border-vela-border px-2.5 py-1.5 " +
  "font-mono text-[13px] tabular-nums text-zinc-100 placeholder-vela-muted " +
  "outline-none transition-colors focus:border-vela-teal/60";

// ── Page ────────────────────────────────────────────────────────────────────

export default function DCFPage() {
  const [inputs, setInputs] = useState<DCFInputs>(EMPTY_INPUTS);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function set<K extends keyof DCFInputs>(key: K, value: DCFInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const loadTicker = useCallback(async (ticker: string) => {
    if (!ticker || ticker.length < 1) return;
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

      // Estimate growth: use revenue growth if available, else default 8%
      const growthEstimate = data.revenue_growth ?? 8;
      // Estimate discount rate from beta
      const riskFreeRate = 4.5; // approximate 10Y treasury
      const marketPremium = 5.5;
      const beta = data.beta ?? 1;
      const wacc = Math.round((riskFreeRate + beta * marketPremium) * 10) / 10;

      setInputs({
        ticker: data.ticker,
        currentFCF: data.fcf ?? 0,
        growthRateY1_5: null,
        growthRateY6_10: null,
        discountRate: Math.max(wacc, 7),
        terminalGrowthRate: 3,
        sharesOutstanding: data.shares_outstanding ?? 0,
        currentPrice: data.price ?? 0,
        netDebt: -(data.net_cash ?? 0),
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

  const result = useMemo(() => {
    if (inputs.currentFCF === 0 || inputs.sharesOutstanding === 0) return null;
    if (inputs.growthRateY1_5 == null || inputs.growthRateY6_10 == null) return null;
    return runDCF(inputs as DCFInputs & { growthRateY1_5: number; growthRateY6_10: number });
  }, [inputs]);

  const baseGrowth = inputs.growthRateY1_5 ?? 10;
  const growthSteps = [baseGrowth - 4, baseGrowth - 2, baseGrowth, baseGrowth + 2, baseGrowth + 4];
  const discountSteps = [
    inputs.discountRate - 2,
    inputs.discountRate - 1,
    inputs.discountRate,
    inputs.discountRate + 1,
    inputs.discountRate + 2,
  ];

  const sensitivityData = useMemo(
    () => result ? sensitivityTable(inputs, growthSteps, discountSteps) : null,
    [inputs, result],
  );

  const upside = result ? result.marginOfSafety >= 0 : false;

  const fcfChartData = result ? [
    { year: "Now", fcf: inputs.currentFCF / 1000, pv: inputs.currentFCF / 1000 },
    ...result.projectedFCF.map((p) => ({
      year: `Y${p.year}`,
      fcf: p.fcf / 1000,
      pv: p.pv / 1000,
    })),
  ] : [];

  const hasData = inputs.currentFCF !== 0 && inputs.sharesOutstanding !== 0;
  const missingGrowth =
    (inputs.growthRateY1_5 == null || inputs.growthRateY6_10 == null) && inputs.currentFCF !== 0;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "DCF" }]}
        note={
          loading
            ? "loading fundamentals"
            : hasData
              ? `${inputs.ticker} · 10 year forecast`
              : "no ticker loaded"
        }
      />

      <PageHero
        title="DCF"
        name={fundamentals?.name ?? undefined}
        meta={
          hasData
            ? `${inputs.ticker} · discounted cash flow`
            : "Discounted cash flow"
        }
        figure={result ? `$${result.intrinsicPrice.toFixed(2)}` : undefined}
        figureSub={
          result
            ? `${result.marginOfSafety >= 0 ? "+" : ""}${result.marginOfSafety.toFixed(1)}% vs market price`
            : undefined
        }
        figureSubClass={upside ? "text-gain" : "text-loss"}
      />

      {/* ── Ticker ───────────────────────────────────────────────────────── */}

      <Section
        label="Ticker"
        prose="Load a company and the model fills in price, free cash flow, share count and net debt from live data. Every assumption stays editable."
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
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
              <FundCell label="Market cap" value={fundamentals.market_cap ? `$${(fundamentals.market_cap / 1000).toFixed(0)}B` : "—"} />
              <FundCell label="FCF (TTM)" value={fundamentals.fcf ? `$${(fundamentals.fcf / 1000).toFixed(1)}B` : "N/A"} warn={!fundamentals.fcf} />
              <FundCell label="Shares" value={fundamentals.shares_outstanding ? `${fundamentals.shares_outstanding.toFixed(1)}M` : "—"} />
              <FundCell label="Rev growth" value={fundamentals.revenue_growth != null ? `${fundamentals.revenue_growth.toFixed(1)}%` : "—"} />
              <FundCell label="Cash" value={fundamentals.total_cash != null ? `$${(fundamentals.total_cash / 1000).toFixed(1)}B` : "—"} />
              <FundCell label="Total debt" value={fundamentals.total_debt != null ? `$${(fundamentals.total_debt / 1000).toFixed(1)}B` : "—"} />
              <FundCell
                label={fundamentals.net_cash != null && fundamentals.net_cash >= 0 ? "Net cash" : "Net debt"}
                value={fundamentals.net_cash != null ? `$${(Math.abs(fundamentals.net_cash) / 1000).toFixed(1)}B` : "—"}
                warn={fundamentals.net_cash != null && fundamentals.net_cash < 0}
              />
              <FundCell label="P/E (TTM)" value={fundamentals.trailing_pe ? `${fundamentals.trailing_pe.toFixed(1)}x` : "—"} />
              <FundCell label="Beta" value={fundamentals.beta ? `${fundamentals.beta.toFixed(2)}` : "—"} />
              <FundCell label="Op. margin" value={fundamentals.operating_margins ? `${fundamentals.operating_margins.toFixed(1)}%` : "—"} />
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
              Enter a ticker above to begin. Price, free cash flow, shares and other fundamentals load
              automatically, and you can adjust any of them afterwards.
            </Prose>
          </div>
        )}
      </Section>

      {hasData && (
        <>
          {/* ── Assumptions ──────────────────────────────────────────────── */}

          <Section
            label="Assumptions"
            prose="These are the inputs the model runs on. Change any of them and every figure below recalculates."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
              <InputField label="Current FCF ($M)" value={inputs.currentFCF} onChange={(v) => set("currentFCF", Number(v))} step={1000} />
              <NullableInputField
                label="Growth Y1-5 (%)"
                value={inputs.growthRateY1_5}
                onChange={(v) => set("growthRateY1_5", v)}
                placeholder="Your estimate"
                step={0.5} min={-50} max={100}
              />
              <NullableInputField
                label="Growth Y6-10 (%)"
                value={inputs.growthRateY6_10}
                onChange={(v) => set("growthRateY6_10", v)}
                placeholder="Your estimate"
                step={0.5} min={-50} max={100}
              />
              <InputField label="Discount rate / WACC (%)" value={inputs.discountRate} onChange={(v) => set("discountRate", Number(v))} step={0.5} min={1} max={30} />
              <InputField label="Terminal growth (%)" value={inputs.terminalGrowthRate} onChange={(v) => set("terminalGrowthRate", Number(v))} step={0.5} min={0} max={5} />
              <InputField label="Shares outstanding (M)" value={inputs.sharesOutstanding} onChange={(v) => set("sharesOutstanding", Number(v))} step={100} min={1} />
              <InputField label="Current price ($)" value={inputs.currentPrice} onChange={(v) => set("currentPrice", Number(v))} step={1} min={0} />
              <InputField label="Net debt ($M)" value={inputs.netDebt} onChange={(v) => set("netDebt", Number(v))} step={100} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="font-mono text-[11px] text-vela-muted">
                Net debt = total debt − cash. A negative figure is net cash and adds to equity value.
              </p>
              <p className="font-mono text-[11px] text-vela-muted">
                Loaded from {inputs.ticker}
              </p>
            </div>

            {missingGrowth && (
              <p className="mt-4 border border-amber-400/25 px-3 py-2 font-mono text-[11px] text-amber-400">
                Enter both growth rates to see the valuation.
              </p>
            )}
          </Section>

          {result && (
            <>
              {/* ── Model output ─────────────────────────────────────────── */}

              <Section
                label="Model output"
                prose="What the assumptions above add up to, in present value terms."
              >
                <StatStrip>
                  <StatCell
                    label="PV of future FCF"
                    value={`$${(result.totalPVofFCF / 1000).toFixed(0)}B`}
                    sub="years 1 to 10"
                  />
                  <StatCell
                    label="PV of terminal"
                    value={`$${(result.pvTerminalValue / 1000).toFixed(0)}B`}
                    sub="beyond year 10"
                  />
                  <StatCell
                    label="Enterprise value"
                    value={`$${(result.enterpriseValue / 1000).toFixed(0)}B`}
                    sub="before net debt"
                  />
                  <StatCell
                    label="Equity value"
                    value={`$${(result.equityValue / 1000).toFixed(0)}B`}
                    sub={`$${result.intrinsicPrice.toFixed(2)} per share`}
                  />
                </StatStrip>

                <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[11px] tabular-nums text-vela-muted">
                  <span>
                    Market price{" "}
                    <span className="text-zinc-100">${inputs.currentPrice.toFixed(2)}</span>
                  </span>
                  <span aria-hidden="true" className="text-vela-subtle">/</span>
                  <span>
                    Model output{" "}
                    <span className="text-zinc-100">${result.intrinsicPrice.toFixed(2)}</span>
                  </span>
                  <span aria-hidden="true" className="text-vela-subtle">/</span>
                  <span>
                    Gap{" "}
                    <span className={upside ? "text-gain" : "text-loss"}>
                      {result.marginOfSafety >= 0 ? "+" : ""}{result.marginOfSafety.toFixed(1)}%
                    </span>
                  </span>
                </div>
              </Section>

              {/* ── Projection ───────────────────────────────────────────── */}

              <Section
                label="Projection"
                prose="Forecast free cash flow against the same cash flow discounted back to today."
              >
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fcfChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradFCF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1AA8BB" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#1AA8BB" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8A97AC" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#8A97AC" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="year" tick={{ fill: "#8A97AC", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "#8A97AC", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}B`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0B1322", border: "1px solid #1B2638", borderRadius: "4px", fontSize: "0.75rem" }}
                        formatter={(v: number, name: string) => [`$${v.toFixed(1)}B`, name === "fcf" ? "FCF" : "Present Value"]}
                        labelStyle={{ color: "#AEB9CC" }}
                      />
                      <Area type="monotone" dataKey="pv" stroke="#8A97AC" fill="url(#gradPV)" strokeWidth={1.5} strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="fcf" stroke="#1AA8BB" fill="url(#gradFCF)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Legend
                  items={[
                    {
                      glyph: <span aria-hidden="true" className="w-2.5 h-[2px] bg-vela-teal inline-block" />,
                      label: "Free cash flow",
                    },
                    {
                      glyph: <span aria-hidden="true" className="w-2.5 h-[2px] bg-vela-muted inline-block" />,
                      label: "Present value",
                    },
                  ]}
                  hint="figures in $B"
                />
              </Section>

              {/* ── Sensitivity ──────────────────────────────────────────── */}

              <Section
                label="Sensitivity"
                prose="How the per share output moves as the two assumptions it is most exposed to change."
                controls={
                  <button
                    onClick={() => setShowSensitivity(!showSensitivity)}
                    aria-expanded={showSensitivity}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border
                      font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      showSensitivity
                        ? "bg-vela-teal/10 border-vela-teal/30 text-vela-teal"
                        : "border-vela-border text-vela-muted hover:text-zinc-100 hover:border-vela-teal/40"
                    }`}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${showSensitivity ? "" : "-rotate-90"}`}
                    />
                    {showSensitivity ? "Hide grid" : "Show grid"}
                  </button>
                }
              >
                {showSensitivity && sensitivityData && (
                  <>
                    <div className="overflow-x-auto border border-vela-border rounded">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="border-b border-vela-border">
                            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-vela-muted">
                              WACC ↓ / growth →
                            </th>
                            {growthSteps.map((g) => (
                              <th
                                key={g}
                                className={`px-3 py-2.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] tabular-nums ${
                                  g === inputs.growthRateY1_5 ? "text-vela-teal" : "text-vela-muted"
                                }`}
                              >
                                {g.toFixed(1)}%
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {discountSteps.map((dr, ri) => (
                            <tr key={dr} className="border-b border-vela-border last:border-0">
                              <td
                                className={`px-3 py-2.5 font-mono text-[11px] tabular-nums ${
                                  dr === inputs.discountRate ? "text-vela-teal" : "text-vela-muted"
                                }`}
                              >
                                {dr.toFixed(1)}%
                              </td>
                              {sensitivityData[ri].map((price, ci) => {
                                const isBase = dr === inputs.discountRate && growthSteps[ci] === baseGrowth;
                                const upsideCell = price > inputs.currentPrice;
                                return (
                                  <td
                                    key={ci}
                                    className={`px-3 py-2.5 text-center font-mono text-[12px] tabular-nums ${
                                      isBase
                                        ? "bg-vela-teal/10 text-vela-teal"
                                        : upsideCell ? "text-gain" : "text-loss"
                                    }`}
                                  >
                                    ${price.toFixed(0)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 font-mono text-[11px] text-vela-muted">
                      Green sits above the market price, red below it. The highlighted cell is your base case.
                    </p>
                  </>
                )}
              </Section>

              {/* ── Insights ─────────────────────────────────────────────── */}

              <DCFInsights result={result} inputs={inputs} fundamentals={fundamentals} />

              <p className="mt-9 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
                This DCF uses simplified assumptions. Real valuations require audited financials,
                sector-specific adjustments and professional judgement. Not investment advice.
              </p>
            </>
          )}
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

function InputField({
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

function NullableInputField({
  label, value, onChange, placeholder, step, min, max,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block min-w-0">
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        step={step}
        min={min}
        max={max}
        className={fieldClass}
      />
    </label>
  );
}


// ── Dynamic insight panel ───────────────────────────────────────────────────

function DCFInsights({ result, inputs, fundamentals }: {
  result: DCFResult;
  inputs: DCFInputs;
  fundamentals: Fundamentals | null;
}) {
  const terminalPct = result.enterpriseValue > 0
    ? (result.pvTerminalValue / result.enterpriseValue) * 100
    : 0;
  const upside = result.marginOfSafety >= 0;
  const bigUpside = result.marginOfSafety > 40;

  const insights: { title: string; body: string }[] = [];

  // 1. Main reading
  if (upside && result.marginOfSafety > 5) {
    insights.push({
      title: `Model output sits ${result.marginOfSafety.toFixed(0)}% above market price`,
      body: `On your assumptions, the model's per share figure lands above ${inputs.ticker}'s current price. `
        + `Free cash flow would have to compound at ${inputs.growthRateY1_5 ?? 0}% for five years to justify $${result.intrinsicPrice.toFixed(0)}. `
        + (fundamentals?.trailing_pe
          ? `The trailing P/E of ${fundamentals.trailing_pe}x ${fundamentals.trailing_pe < 20 ? "sits below the broad market average" : "sits above the broad market average"}, and the sensitivity grid shows how much that reading depends on the inputs.`
          : `The sensitivity grid shows how much that reading depends on the inputs.`),
    });
  } else if (!upside) {
    insights.push({
      title: "Model output sits below market price",
      body: `A DCF values cash flows only. It carries no brand premium, no M&A speculation and no momentum. `
        + `A ${Math.abs(result.marginOfSafety).toFixed(0)}% gap can mean the market prices in more than your assumptions do, or that those assumptions are conservative. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > (inputs.growthRateY1_5 ?? 0)
          ? `Recent revenue growth of ${fundamentals.revenue_growth}% runs ahead of your Y1-5 assumption of ${inputs.growthRateY1_5 ?? 0}%, which is worth reconciling.`
          : `Adjusting the growth or discount rate shows where the breakeven sits.`),
    });
  }

  // 2. Large gap sanity check
  if (bigUpside) {
    insights.push({
      title: "Large gap to market price, verify the assumptions",
      body: `Gaps above 40% are rare in liquid markets. Three checks: is the FCF figure normalized rather than a one-off peak, `
        + `is the growth rate sustainable for five full years, and are there unmodeled risks such as regulation, competition or cyclicality?`,
    });
  }

  // 3. Terminal value weight
  if (terminalPct > 65) {
    insights.push({
      title: `${terminalPct.toFixed(0)}% of value sits in the terminal figure`,
      body: `A 0.5% change in terminal growth would move the output by roughly 10 to 20%. `
        + `That much weight past year 10 makes the model highly sensitive to a number nobody can observe. Stress it at 2 to 2.5%.`,
    });
  }

  // 4. WACC context
  if (inputs.discountRate >= 12) {
    insights.push({
      title: `${inputs.discountRate}% WACC is on the conservative side`,
      body: `Most published models sit between 8 and 11%. A higher rate builds in slack and compresses the output. `
        + (fundamentals?.beta ? `With ${inputs.ticker}'s beta of ${fundamentals.beta}, CAPM points to roughly ${(4.5 + fundamentals.beta * 5.5).toFixed(1)}%.` : ``),
    });
  } else if (inputs.discountRate <= 7) {
    insights.push({
      title: `${inputs.discountRate}% WACC is on the aggressive side`,
      body: `A rate this low inflates the output meaningfully. It tends to fit only low beta, stable cash flow businesses `
        + `such as utilities and consumer staples. Most equities are modelled at 9 to 11%.`,
    });
  }

  // 5. Growth reality check
  if ((inputs.growthRateY1_5 ?? 0) > 20) {
    insights.push({
      title: "20%+ growth for five years is historically rare",
      body: `Roughly one large cap in ten sustains 20%+ FCF growth over five years. Mean reversion is powerful, `
        + `so it is worth seeing whether the reading holds at a lower rate.`,
    });
  }

  insights.push({
    title: "One lens, not the full picture",
    body: `The Reverse DCF shows what growth the market is already pricing in, which is a useful cross-check against this output. `
      + `${upside ? "A gap between model and market can persist for years, so this reading says nothing on its own about timing." : "An output below the market price is an observation about your assumptions, not a signal."}`,
  });

  return (
    <Section
      label="What this means"
      prose="Plain reading of the numbers above. Descriptive only, not a recommendation."
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
