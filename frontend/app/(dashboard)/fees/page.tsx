"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useCloudStore } from "@/hooks/useCloudStore";
import { api } from "@/lib/api";
import {
  analyzeFees, lookupExpenseRatio, KNOWN_EXPENSE_RATIOS,
} from "@/lib/fee-analyzer";
import type { FeeHolding, HoldingFeeDetail } from "@/lib/fee-analyzer";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Legend,
  Eyebrow,
  Prose,
} from "@/components/instrument";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (isNaN(v)) return "$0";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function fmtER(v: number): string {
  if (isNaN(v)) return "0.00%";
  return `${(v * 100).toFixed(2)}%`;
}

/**
 * Emphasis for a cost tier. Literal class strings only — never build a Tailwind
 * class name at runtime, the compiler cannot see it.
 */
const TIER_CLASS: Record<string, string> = {
  low: "text-vela-body",
  moderate: "text-vela-body",
  high: "text-zinc-100",
  "very-high": "text-amber-400",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const { summary } = useDefaultPortfolio();
  const holdings = summary?.holdings ?? [];

  // Persisted user overrides — survive page refresh
  const { data: savedOverrides, save: saveOverrides } =
    useCloudStore<Record<string, number>>("fee_overrides");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const kvSynced = useRef(false);

  // Sync from cloud KV on first load
  useEffect(() => {
    if (savedOverrides && !kvSynced.current) {
      setOverrides(savedOverrides);
      kvSynced.current = true;
    }
  }, [savedOverrides]);

  // Live ER from yfinance for tickers not in the static table
  const [liveERs, setLiveERs] = useState<Record<string, number | null>>({});
  const [fetchingLive, setFetchingLive] = useState(false);

  useEffect(() => {
    if (!holdings.length) return;
    const unknown = holdings
      .map((h) => h.ticker)
      .filter((t) => lookupExpenseRatio(t) === null);
    if (!unknown.length) return;

    setFetchingLive(true);
    api.get<Record<string, number | null>>(
      `/portfolios/expense-ratios?tickers=${unknown.join(",")}`
    )
      .then((data) => setLiveERs(data))
      .catch(() => {/* silent — falls back to 0 */})
      .finally(() => setFetchingLive(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.map((h) => h.ticker).join(",")]);

  function handleOverride(ticker: string, er: number) {
    const updated = { ...overrides, [ticker]: er };
    setOverrides(updated);
    saveOverrides(updated);
  }

  function handleResetOverride(ticker: string) {
    const updated = { ...overrides };
    delete updated[ticker];
    setOverrides(updated);
    saveOverrides(updated);
  }

  const feeHoldings: FeeHolding[] = useMemo(() => {
    return holdings.map((h) => {
      const known = lookupExpenseRatio(h.ticker);
      const live = liveERs[h.ticker] ?? null;
      const er = overrides[h.ticker] ?? known ?? live ?? 0;
      return {
        ticker: h.ticker,
        marketValue: h.market_value ?? h.total_cost ?? 0,
        expenseRatio: er,
        isETF: known !== null || live !== null,
      };
    });
  }, [holdings, overrides, liveERs]);

  const result = useMemo(() => analyzeFees(feeHoldings), [feeHoldings]);

  const unknownCount = feeHoldings.filter(
    (h) => lookupExpenseRatio(h.ticker) === null && liveERs[h.ticker] == null && !overrides[h.ticker]
  ).length;

  if (holdings.length === 0) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Fees" }]} note="no positions yet" />
        <PageHero title="Fees" meta="What the funds on the book charge each year" />
        <div className="mt-8">
          <Panel className="px-6 py-14 text-center">
            <Eyebrow>Nothing to price</Eyebrow>
            <Prose className="mx-auto mt-3 max-w-[380px]">
              There are no holdings on the book yet. Once positions are recorded, their expense
              ratios and the annual cost those ratios carry land here.
            </Prose>
            <Link
              href="/portfolio"
              className="mt-5 inline-flex items-center rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5
                font-mono text-[10px] uppercase tracking-wider text-vela-teal
                hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
            >
              Go to positions
            </Link>
          </Panel>
        </div>
      </PageTransition>
    );
  }

  return (
    <TierGate requiredTier="voyager">
      <PageTransition>
        <TopBar
          trail={[{ label: "Lab" }, { label: "Fees" }]}
          note={`${result.holdings.length} ${result.holdings.length === 1 ? "holding" : "holdings"} · blended ${fmtER(result.weightedExpenseRatio)}`}
        />

        <PageHero
          title="Fees"
          meta="What the funds on the book charge each year"
          figure={fmtER(result.weightedExpenseRatio)}
          figureSub={`${fmtCurrency(result.totalAnnualFees)} a year at current values`}
        />

        <StatStrip className="mt-6">
          <StatCell
            label="Fee grade"
            value={result.feeGrade}
            sub={result.feeGradeLabel}
            subClass="text-vela-muted"
          />
          <StatCell
            label="Blended expense ratio"
            value={fmtER(result.weightedExpenseRatio)}
            sub="weighted by market value"
          />
          <StatCell
            label="Annual fees"
            value={fmtCurrency(result.totalAnnualFees)}
            sub="at today's balances"
          />
          <StatCell
            label="30-year drag"
            value={fmtCurrency(result.thirtyYearFeeDrag)}
            sub="vs a 0.03% blended rate"
          />
        </StatStrip>

        {unknownCount > 0 && (
          <div className="mt-6 border-l-2 border-amber-400/50 pl-4 py-1">
            <p className="font-mono text-[11px] leading-relaxed text-amber-400">
              {unknownCount} holding{unknownCount > 1 ? "s" : ""} ha{unknownCount > 1 ? "ve" : "s"} no
              expense ratio on record.
            </p>
            <Prose className="mt-1 max-w-[560px]">
              Individual stocks carry no expense ratio, so 0% is correct for them. Funds do carry one,
              and any figure below can be edited by hand.
            </Prose>
          </div>
        )}

        {/* ── Fee impact over time ────────────────────────────────────────── */}

        <Section
          label="Impact over time"
          prose={`Two balances compounding at 8% a year: one carrying the blended ${fmtER(result.weightedExpenseRatio)} charged on the book, one carrying the ${fmtER(result.lowCostER)} of a low-cost index benchmark. The gap between the lines is the fee drag.`}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[420px] h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={result.projection.filter((_, i) => i % 2 === 0 || i === 30)}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2638" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#8A97AC", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}yr`}
                  />
                  <YAxis
                    tick={{ fill: "#8A97AC", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                      if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                      return `$${v}`;
                    }}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0B1322",
                      border: "1px solid #1B2638",
                      borderRadius: 4,
                      fontSize: 12,
                      color: "#EAEEF5",
                    }}
                    itemStyle={{ color: "#EAEEF5" }}
                    labelStyle={{ color: "#8A97AC" }}
                    formatter={(val: number, name: string) => [
                      `$${val.toLocaleString()}`,
                      name === "withLowFees" ? "Low-cost index" : "Fees on the book",
                    ]}
                    labelFormatter={(v) => `Year ${v}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="withLowFees"
                    stroke="#8A97AC"
                    fill="rgba(138, 151, 172, 0.06)"
                    strokeWidth={2}
                    name="withLowFees"
                  />
                  <Area
                    type="monotone"
                    dataKey="withCurrentFees"
                    stroke="#1AA8BB"
                    fill="rgba(26, 168, 187, 0.08)"
                    strokeWidth={2}
                    name="withCurrentFees"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Legend
            items={[
              {
                glyph: <span aria-hidden="true" className="w-2 h-2 bg-vela-teal inline-block" />,
                label: `Fees on the book (${fmtER(result.weightedExpenseRatio)})`,
              },
              {
                glyph: <span aria-hidden="true" className="w-2 h-2 bg-vela-muted inline-block" />,
                label: `Low-cost index benchmark (${fmtER(result.lowCostER)})`,
              },
            ]}
            hint="8% gross return assumed"
          />

          {result.potentialSavings30yr > 100 && (
            <Prose className="mt-5 max-w-[620px]">
              At a {fmtER(result.lowCostER)} blended rate the same balance would carry{" "}
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtCurrency(result.potentialSavings10yr)}
              </span>{" "}
              less in fees over ten years and{" "}
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtCurrency(result.potentialSavings30yr)}
              </span>{" "}
              less over thirty, on the same 8% gross return. That is arithmetic on the ratios, not a
              view on any fund.
            </Prose>
          )}
        </Section>

        {/* ── Holdings breakdown ──────────────────────────────────────────── */}

        <Section
          label="By holding"
          prose="Expense ratio on record for each position and what that ratio costs a year at current market value. Any figure can be edited if a prospectus says otherwise."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[520px] border-y border-vela-border divide-y divide-vela-border">
              {result.holdings.map((h) => (
                <HoldingRow
                  key={h.ticker}
                  holding={h}
                  onChangeER={(er) => handleOverride(h.ticker, er)}
                  onReset={() => handleResetOverride(h.ticker)}
                  hasOverride={h.ticker in overrides}
                  knownER={lookupExpenseRatio(h.ticker)}
                  liveER={liveERs[h.ticker] ?? null}
                  fetchingLive={fetchingLive}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ── Reference ───────────────────────────────────────────────────── */}

        <Section
          label="Reference"
          prose="Published expense ratios for widely held funds, for scale. Listed for comparison only."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-t border-vela-border pt-4">
            {[
              { ticker: "VOO", name: "S&P 500" },
              { ticker: "VTI", name: "Total Market" },
              { ticker: "QQQ", name: "Nasdaq 100" },
              { ticker: "ARKK", name: "ARK Innovation" },
              { ticker: "SPY", name: "SPDR S&P 500" },
              { ticker: "SCHD", name: "Schwab Dividend" },
              { ticker: "IWM", name: "Russell 2000" },
              { ticker: "GLD", name: "Gold" },
            ].map((fund) => {
              const er = KNOWN_EXPENSE_RATIOS[fund.ticker] ?? 0;
              const tier = er <= 0.002 ? "low" : er <= 0.005 ? "moderate" : er <= 0.01 ? "high" : "very-high";
              return (
                <div key={fund.ticker} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold tracking-[0.02em] text-zinc-100">
                      {fund.ticker}
                    </span>
                    <span className={`font-mono text-[12px] tabular-nums ${TIER_CLASS[tier]}`}>
                      {fmtER(er)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-vela-muted">
                    {fund.name}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-7 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
            An expense ratio is the annual charge a fund deducts from returns; individual stocks carry
            none. The projection assumes an 8% gross annual return and compares the blended rate on the
            book against a 0.03% benchmark. Ratios shown are approximate and may not match the current
            prospectus, and real fee impact also depends on contributions, withdrawals and market
            returns. Descriptive only, not investment advice.
          </p>
        </Section>
      </PageTransition>
    </TierGate>
  );
}

// ── Holding Row ──────────────────────────────────────────────────────────────

function HoldingRow({
  holding,
  onChangeER,
  onReset,
  hasOverride,
  knownER,
  liveER,
  fetchingLive,
}: {
  holding: HoldingFeeDetail;
  onChangeER: (er: number) => void;
  onReset: () => void;
  hasOverride: boolean;
  knownER: number | null;
  liveER: number | null;
  fetchingLive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(
    (holding.expenseRatio * 100).toFixed(2)
  );

  const handleSave = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onChangeER(parsed / 100);
    }
    setEditing(false);
  };

  // Source label shown next to ER
  const sourceLabel = hasOverride ? (
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-amber-400">edited</span>
  ) : knownER !== null ? (
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-vela-muted">on file</span>
  ) : liveER !== null ? (
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-vela-teal">live</span>
  ) : fetchingLive ? (
    <span className="font-mono text-[9px] text-vela-muted animate-pulse">…</span>
  ) : null;

  return (
    <div className="group flex items-center gap-3 py-2.5">
      <span className="w-14 shrink-0 font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
        {holding.ticker}
      </span>

      <span className="w-20 shrink-0 font-mono text-[11px] tabular-nums text-vela-muted">
        {fmtCurrency(holding.marketValue)}
      </span>

      {/* Expense ratio (editable) */}
      <div className="flex items-center gap-2 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleSave}
              autoFocus
              className="w-16 rounded border border-vela-teal/40 bg-vela-card px-1.5 py-0.5
                font-mono text-[12px] tabular-nums text-zinc-100 outline-none"
            />
            <span className="font-mono text-[10px] text-vela-muted">%</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setInputVal((holding.expenseRatio * 100).toFixed(2));
              setEditing(true);
            }}
            title="Click to edit expense ratio"
            className={`rounded border border-vela-border px-1.5 py-0.5 font-mono text-[12px] tabular-nums
              hover:border-vela-teal/40 transition-colors ${TIER_CLASS[holding.costTier]}`}
          >
            {fmtER(holding.expenseRatio)}
          </button>
        )}
        {sourceLabel}
        {hasOverride && (
          <button
            onClick={onReset}
            title="Reset to auto-detected value"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-vela-muted hover:text-zinc-100"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Annual fee */}
      <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums">
        {holding.annualFeeDollars > 0.5 ? (
          <span className="text-zinc-100">
            −${Math.round(holding.annualFeeDollars).toLocaleString()}/yr
          </span>
        ) : (
          <span className="text-vela-muted">$0/yr</span>
        )}
      </span>

      {/* 10yr drag */}
      <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-vela-muted">
        {holding.tenYearDrag > 1 ? `${fmtCurrency(holding.tenYearDrag)} 10yr` : "—"}
      </span>
    </div>
  );
}
