"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Calculator, Info, TrendingUp, TrendingDown,
  ChevronDown, Lightbulb, AlertTriangle, BookOpen, Loader2, Search,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { api } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

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

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-vela-teal" />
          DCF Valuation
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Discounted Cash Flow model  - estimate what a stock is really worth
        </p>
      </div>

      {/* Ticker search bar */}
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

      {/* Loaded fundamentals info */}
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
            <FundRow label="FCF (TTM)" value={fundamentals.fcf ? `$${(fundamentals.fcf / 1000).toFixed(1)}B` : "N/A"} highlight={!fundamentals.fcf} />
            <FundRow label="Shares" value={fundamentals.shares_outstanding ? `${fundamentals.shares_outstanding.toFixed(1)}M` : " -"} />
            <FundRow label="Rev Growth" value={fundamentals.revenue_growth != null ? `${fundamentals.revenue_growth.toFixed(1)}%` : " -"} />
            <FundRow label="Cash" value={fundamentals.total_cash != null ? `$${(fundamentals.total_cash / 1000).toFixed(1)}B` : " -"} />
            <FundRow label="Total Debt" value={fundamentals.total_debt != null ? `$${(fundamentals.total_debt / 1000).toFixed(1)}B` : " -"} />
            <FundRow
              label={fundamentals.net_cash != null && fundamentals.net_cash >= 0 ? "Net Cash" : "Net Debt"}
              value={fundamentals.net_cash != null ? `$${(Math.abs(fundamentals.net_cash) / 1000).toFixed(1)}B` : " -"}
              highlight={fundamentals.net_cash != null && fundamentals.net_cash < 0}
            />
            <FundRow label="P/E (TTM)" value={fundamentals.trailing_pe ? `${fundamentals.trailing_pe.toFixed(1)}x` : " -"} />
            <FundRow label="Beta" value={fundamentals.beta ? `${fundamentals.beta.toFixed(2)}` : " -"} />
            <FundRow label="Op. Margin" value={fundamentals.operating_margins ? `${fundamentals.operating_margins.toFixed(1)}%` : " -"} />
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
          <Calculator className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 font-medium">Enter a ticker to begin</p>
          <p className="text-zinc-500 text-sm mt-1">
            We&apos;ll auto-load price, FCF, shares, and other fundamentals from live data.
            You can adjust any input after loading.
          </p>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Inputs panel ──────────────────────────────────────────── */}
          <div className="vela-card space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Model Inputs</h2>

            <InputField label="Current FCF ($M)" value={inputs.currentFCF} onChange={(v) => set("currentFCF", Number(v))} step={1000} />
            <NullableInputField
              label="Growth Y1–5 (%)"
              value={inputs.growthRateY1_5}
              onChange={(v) => set("growthRateY1_5", v)}
              placeholder="Enter your estimate"
              step={0.5} min={-50} max={100}
            />
            <NullableInputField
              label="Growth Y6–10 (%)"
              value={inputs.growthRateY6_10}
              onChange={(v) => set("growthRateY6_10", v)}
              placeholder="Enter your estimate"
              step={0.5} min={-50} max={100}
            />
            <InputField label="Discount Rate / WACC (%)" value={inputs.discountRate} onChange={(v) => set("discountRate", Number(v))} step={0.5} min={1} max={30} />
            <InputField label="Terminal Growth (%)" value={inputs.terminalGrowthRate} onChange={(v) => set("terminalGrowthRate", Number(v))} step={0.5} min={0} max={5} />
            <InputField label="Shares Outstanding (M)" value={inputs.sharesOutstanding} onChange={(v) => set("sharesOutstanding", Number(v))} step={100} min={1} />
            <InputField label="Current Price ($)" value={inputs.currentPrice} onChange={(v) => set("currentPrice", Number(v))} step={1} min={0} />
            <InputField label="Net Debt ($M)" value={inputs.netDebt} onChange={(v) => set("netDebt", Number(v))} step={100} />

            <p className="text-[10px] text-zinc-600">Net Debt = Total Debt − Cash. Negative means net cash (adds to equity value).</p>
            {(inputs.growthRateY1_5 == null || inputs.growthRateY6_10 == null) && inputs.currentFCF !== 0 && (
              <p className="text-[10px] text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                Enter growth rates above to see the valuation.
              </p>
            )}
            <p className="text-[10px] text-zinc-600">
              All values auto-loaded from {inputs.ticker}. Adjust as needed for your thesis.
            </p>
          </div>

          {/* ── Results ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {result && (
              <>
                {/* Verdict card */}
                <div className={`vela-card border ${upside ? "border-gain/30" : "border-loss/30"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                        {inputs.ticker} Fair Value
                      </p>
                      <p className="text-3xl font-bold tabular text-zinc-100">
                        ${result.intrinsicPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Market price: ${inputs.currentPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
                      upside ? "bg-gain/10" : "bg-loss/10"
                    }`}>
                      {upside ? <TrendingUp className="w-5 h-5 text-gain" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                      <div>
                        <p className={`text-lg font-bold tabular ${upside ? "text-gain" : "text-loss"}`}>
                          {result.marginOfSafety >= 0 ? "+" : ""}{result.marginOfSafety.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {upside ? "Upside" : "Downside"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="PV of Future FCF" value={`$${(result.totalPVofFCF / 1000).toFixed(0)}B`} />
                  <MetricCard label="PV of Terminal" value={`$${(result.pvTerminalValue / 1000).toFixed(0)}B`} />
                  <MetricCard label="Enterprise Value" value={`$${(result.enterpriseValue / 1000).toFixed(0)}B`} />
                  <MetricCard label="Equity Value" value={`$${(result.equityValue / 1000).toFixed(0)}B`} />
                </div>

                {/* FCF projection chart */}
                <div className="vela-card">
                  <h3 className="text-sm font-medium text-zinc-300 mb-4">
                    Projected Free Cash Flow ($B)
                  </h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fcfChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradFCF" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0CB5C9" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#0CB5C9" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradPV" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#71717a" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#71717a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}B`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem", fontSize: "0.75rem" }}
                          formatter={(v: number, name: string) => [`$${v.toFixed(1)}B`, name === "fcf" ? "FCF" : "Present Value"]}
                          labelStyle={{ color: "#a1a1aa" }}
                        />
                        <Area type="monotone" dataKey="pv" stroke="#71717a" fill="url(#gradPV)" strokeWidth={1.5} strokeDasharray="4 4" />
                        <Area type="monotone" dataKey="fcf" stroke="#0CB5C9" fill="url(#gradFCF)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-vela-teal" /> FCF</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Present Value</span>
                  </div>
                </div>

                {/* Sensitivity toggle */}
                <button
                  onClick={() => setShowSensitivity(!showSensitivity)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSensitivity ? "" : "-rotate-90"}`} />
                  Sensitivity Analysis
                </button>

                {/* Sensitivity table */}
                {showSensitivity && sensitivityData && (
                  <div className="vela-card overflow-x-auto">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">
                      Fair Value by Growth Rate vs. Discount Rate
                    </h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-zinc-500 pb-2 pr-3">WACC ↓ / Growth →</th>
                          {growthSteps.map((g) => (
                            <th key={g} className={`text-center pb-2 px-2 tabular ${g === inputs.growthRateY1_5 ? "text-vela-teal" : "text-zinc-500"}`}>
                              {g.toFixed(1)}%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {discountSteps.map((dr, ri) => (
                          <tr key={dr} className="border-t border-vela-border">
                            <td className={`py-2 pr-3 tabular ${dr === inputs.discountRate ? "text-vela-teal font-medium" : "text-zinc-500"}`}>
                              {dr.toFixed(1)}%
                            </td>
                            {sensitivityData[ri].map((price, ci) => {
                              const isBase = dr === inputs.discountRate && growthSteps[ci] === baseGrowth;
                              const upsideCell = price > inputs.currentPrice;
                              return (
                                <td
                                  key={ci}
                                  className={`py-2 px-2 text-center tabular font-medium ${
                                    isBase
                                      ? "bg-vela-teal/10 text-vela-teal rounded"
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
                    <p className="text-[10px] text-zinc-600 mt-3">
                      Green = above market price (upside), Red = below market price (downside). Highlighted cell = your base case.
                    </p>
                  </div>
                )}

                {/* Insights */}
                <DCFInsights result={result} inputs={inputs} fundamentals={fundamentals} />

                {/* Disclaimer */}
                <div className="flex items-start gap-2 text-[10px] text-zinc-600">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    This DCF model uses simplified assumptions. Real valuations require audited financials,
                    sector-specific adjustments, and professional judgement. Not investment advice.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageTransition>
    </TierGate>
  );
}


// ── Helpers ──────────────────────────────────────────────────────────────────

function FundRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={highlight ? "text-rose-400 font-medium tabular" : "text-zinc-300 font-medium tabular"}>{value}</span>
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
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
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
        className="input-field w-full tabular placeholder:text-zinc-600"
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/50 p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold text-zinc-200 tabular">{value}</p>
    </div>
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

  const insights: { icon: React.ReactNode; title: string; body: string; color: string }[] = [];

  // 1. Main verdict
  if (upside && result.marginOfSafety > 5) {
    insights.push({
      icon: <TrendingUp className="w-4 h-4" />,
      title: `${result.marginOfSafety.toFixed(0)}% upside to fair value`,
      body: `Based on your assumptions, ${inputs.ticker} appears undervalued. `
        + `The market would need to grow FCF at ${inputs.growthRateY1_5 ?? 0}% for 5 years to justify a $${result.intrinsicPrice.toFixed(0)} price. `
        + (fundamentals?.trailing_pe
          ? `Current P/E of ${fundamentals.trailing_pe}x ${fundamentals.trailing_pe < 20 ? "suggests reasonable valuation" : "is above average"}  - cross-check with the sensitivity table.`
          : `Use the sensitivity table to stress-test different growth scenarios.`),
      color: "text-emerald-400",
    });
  } else if (!upside) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Fair value below market price",
      body: `DCF only values actual cash flows  - it ignores brand premium, M&A speculation, and momentum. `
        + `A ${Math.abs(result.marginOfSafety).toFixed(0)}% gap could mean the stock is overvalued, or that your growth assumptions are conservative. `
        + (fundamentals?.revenue_growth && fundamentals.revenue_growth > (inputs.growthRateY1_5 ?? 0)
          ? `Note: recent revenue growth (${fundamentals.revenue_growth}%) is higher than your Y1-5 assumption (${inputs.growthRateY1_5 ?? 0}%)  - consider whether this pace is sustainable.`
          : `Try adjusting growth rates or discount rate to see where the breakeven is.`),
      color: "text-amber-400",
    });
  }

  // 2. Big upside sanity check
  if (bigUpside) {
    insights.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "Large mispricing  - verify your assumptions",
      body: `40%+ gaps are rare in liquid markets. Check: is the FCF figure normalized (not a one-time peak)? `
        + `Is the growth rate sustainable for 5 full years? Are there unmodeled risks (regulation, competition, cyclicality)?`,
      color: "text-amber-400",
    });
  }

  // 3. Terminal value weight
  if (terminalPct > 65) {
    insights.push({
      icon: <BookOpen className="w-4 h-4" />,
      title: `${terminalPct.toFixed(0)}% of value from terminal  - high sensitivity`,
      body: `A 0.5% change in terminal growth rate would swing fair value 10-20%. `
        + `This means the model is betting heavily on what happens after year 10. Stress-test with 2-2.5% terminal growth.`,
      color: "text-zinc-400",
    });
  }

  // 4. WACC context
  if (inputs.discountRate >= 12) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      title: `${inputs.discountRate}% WACC  - conservative`,
      body: `Most analysts use 8-11%. A higher rate builds in safety but compresses fair value. `
        + (fundamentals?.beta ? `With ${inputs.ticker}'s beta of ${fundamentals.beta}, CAPM suggests ~${(4.5 + fundamentals.beta * 5.5).toFixed(1)}% WACC.` : ``),
      color: "text-zinc-400",
    });
  } else if (inputs.discountRate <= 7) {
    insights.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      title: `${inputs.discountRate}% WACC  - aggressive`,
      body: `This inflates fair value meaningfully. Only justified for low-beta, `
        + `stable-cashflow businesses (utilities, consumer staples). Most equities warrant 9-11%.`,
      color: "text-amber-400",
    });
  }

  // 5. Growth reality check
  if ((inputs.growthRateY1_5 ?? 0) > 20) {
    insights.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "20%+ growth for 5 years  - historically rare",
      body: `Only ~10% of large caps sustain 20%+ FCF growth over 5 years. `
        + `Mean reversion is powerful. Try a lower rate to see if the thesis still holds.`,
      color: "text-amber-400",
    });
  }

  insights.push({
    icon: <BookOpen className="w-4 h-4" />,
    title: "One lens, not the full picture",
    body: `Cross-check with the Reverse DCF (what growth the market is pricing in) and your own qualitative thesis. `
      + `${upside ? "Undervalued stocks can stay cheap  - match conviction to position size." : "Overvaluation doesn't mean sell  - but revisit whether your thesis has changed."}`,
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
