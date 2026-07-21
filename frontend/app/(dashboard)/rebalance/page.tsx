"use client";

import { useState, useMemo } from "react";
import { Minus, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { calculateRebalance } from "@/lib/rebalance-calc";
import type { Strategy } from "@/lib/rebalance-calc";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar, PageHero, StatStrip, StatCell, Section,
  PillGroup, Panel, Eyebrow, Prose, Legend,
} from "@/components/instrument";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : v > 0 ? "+" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const STRATEGY_OPTIONS: { key: Strategy; label: string }[] = [
  { key: "equal", label: "Equal weight" },
  { key: "custom", label: "Custom" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RebalancePage() {
  const { summary, loading, error } = useDefaultPortfolio();
  const holdings = summary?.holdings ?? [];
  const totalValue = summary?.total_value ?? 0;

  const [strategy, setStrategy] = useState<Strategy>("equal");
  const [driftThreshold, setDriftThreshold] = useState(5); // percent
  const [cashToInvest, setCashToInvest] = useState(0);
  const [customTargets, setCustomTargets] = useState<Record<string, number>>({});

  // Initialize custom targets from current weights when switching to custom.
  // Use currentTotal (not summary total_value) so defaults stay accurate when cashToInvest > 0.
  const currentTotal = useMemo(
    () => holdings.reduce((s, h) => s + (h.market_value ?? h.total_cost), 0),
    [holdings]
  );

  const effectiveCustom = useMemo(() => {
    if (strategy !== "custom") return {};
    const denominator = (currentTotal + cashToInvest) || totalValue || 1;
    const targets: Record<string, number> = {};
    for (const h of holdings) {
      const mv = h.market_value ?? h.total_cost;
      targets[h.ticker] = customTargets[h.ticker] ?? Math.round((mv / denominator) * 100);
    }
    return targets;
  }, [strategy, holdings, currentTotal, totalValue, cashToInvest, customTargets]);

  // Normalized effective weights for display (0-100 %)
  const normalizedTargets = useMemo(() => {
    const rawSum = Object.values(effectiveCustom).reduce((s, v) => s + v, 0);
    if (rawSum === 0) return effectiveCustom;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(effectiveCustom)) {
      result[k] = Math.round((v / rawSum) * 1000) / 10; // one decimal
    }
    return result;
  }, [effectiveCustom]);

  const rawInputSum = useMemo(
    () => Object.values(effectiveCustom).reduce((s, v) => s + v, 0),
    [effectiveCustom]
  );

  const result = useMemo(() => {
    return calculateRebalance({
      holdings: holdings.map((h) => ({
        ticker: h.ticker,
        marketValue: h.market_value ?? h.total_cost,
        currentPrice: h.current_price ?? h.avg_cost_basis,
        quantity: h.quantity,
      })),
      strategy,
      customTargets: strategy === "custom"
        ? Object.fromEntries(Object.entries(effectiveCustom).map(([k, v]) => [k, v / 100]))
        : undefined,
      driftThreshold: driftThreshold / 100,
      cashToInvest,
    });
  }, [holdings, strategy, effectiveCustom, driftThreshold, cashToInvest]);

  const chartData = result.holdings.map((h) => ({
    ticker: h.ticker,
    current: Math.round(h.currentWeight * 100 * 10) / 10,
    target: Math.round(h.targetWeight * 100 * 10) / 10,
    drift: Math.round(h.drift * 10) / 10,
  }));

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message="Failed to load portfolio data for rebalancing." onRetry={() => window.location.reload()} />;

  if (holdings.length === 0) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Rebalance" }]} note="no positions" />
        <PageHero title="Rebalance" meta="the gap between your weights and your targets" />
        <Panel className="mt-8 py-14 text-center">
          <Prose className="mx-auto max-w-sm">
            Add positions to your portfolio and this will show how far each one sits from the
            targets you set.
          </Prose>
        </Panel>
      </PageTransition>
    );
  }

  const offTarget = result.holdings.filter((h) => Math.abs(h.drift) > driftThreshold).length;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Rebalance" }]}
        note={`${holdings.length} positions · ${driftThreshold}% drift threshold`}
      />

      <PageHero
        title="Rebalance"
        meta="the gap between your weights and the targets you set"
        figure={isNaN(result.maxDrift) ? "0.0%" : `${result.maxDrift.toFixed(1)}%`}
        figureSub="widest drift from target"
        figureSubClass={result.isBalanced ? "text-vela-body" : "text-amber-400"}
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Widest drift"
          value={isNaN(result.maxDrift) ? "0.0%" : `${result.maxDrift.toFixed(1)}%`}
          valueClass={result.isBalanced ? "text-zinc-100" : "text-amber-400"}
          sub={`${driftThreshold}% threshold`}
        />
        <StatCell
          label="Off target"
          value={String(offTarget)}
          sub={`of ${result.holdings.length} positions`}
        />
        <StatCell
          label="Underweight total"
          value={fmtCurrency(result.totalBuys)}
          valueClass="text-gain"
          sub="below target, in aggregate"
        />
        <StatCell
          label="Overweight total"
          value={fmtCurrency(result.totalSells)}
          valueClass="text-loss"
          sub="above target, in aggregate"
        />
      </StatStrip>

      {/* ── Targets ─────────────────────────────────────────────────────── */}
      <Section
        label="Your targets"
        prose="Everything below is arithmetic on the weights you set here. Change a target and the gaps recalculate."
        controls={
          <PillGroup
            options={STRATEGY_OPTIONS}
            value={strategy}
            onChange={setStrategy}
            ariaLabel="Target weighting strategy"
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Drift threshold</Eyebrow>
              <span className="font-mono text-[12px] tabular-nums text-zinc-100">{driftThreshold}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={driftThreshold}
              onChange={(e) => setDriftThreshold(Number(e.target.value))}
              aria-label="Drift threshold percent"
              className="w-full h-1 bg-vela-border appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <p className="mt-2 font-mono text-[11px] text-vela-muted">
              How far a position must sit from target before it is listed below.
            </p>
          </div>

          <div>
            <Eyebrow className="mb-2">Additional cash</Eyebrow>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vela-muted" />
              <input
                type="number"
                value={cashToInvest || ""}
                onChange={(e) => setCashToInvest(Number(e.target.value) || 0)}
                placeholder="0"
                aria-label="Additional cash"
                className="w-full bg-vela-card border border-vela-border rounded pl-8 pr-3 py-2
                  font-mono text-sm text-zinc-100 tabular-nums focus:border-vela-teal outline-none"
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-vela-muted">
              Included in the denominator when the gaps are computed.
            </p>
          </div>
        </div>

        {strategy === "custom" && (
          <div className="mt-8 pt-6 border-t border-vela-border">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <Eyebrow>Target weight per position</Eyebrow>
              <span
                className={`font-mono text-[11px] tabular-nums px-2 py-0.5 rounded ${
                  Math.abs(rawInputSum - 100) < 1
                    ? "text-vela-muted"
                    : "text-amber-400 bg-amber-400/10"
                }`}
              >
                Sum: {rawInputSum}%{Math.abs(rawInputSum - 100) >= 1 ? " · normalized" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
              {holdings.map((h) => {
                const ticker = h.ticker;
                const val = effectiveCustom[ticker] ?? 0;
                const effective = normalizedTargets[ticker] ?? 0;
                const showNormalized = Math.abs(rawInputSum - 100) >= 1;
                return (
                  <div key={ticker} className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-zinc-100 w-12 shrink-0">{ticker}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={val}
                      onChange={(e) => setCustomTargets((prev) => ({ ...prev, [ticker]: Number(e.target.value) }))}
                      aria-label={`${ticker} target weight`}
                      className="flex-1 h-1 bg-vela-border appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                        [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <span className="font-mono text-[11px] tabular-nums text-vela-body w-10 text-right">{val}%</span>
                    {showNormalized && (
                      <span className="font-mono text-[11px] tabular-nums text-vela-teal w-12 text-right">
                        {effective}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {Math.abs(rawInputSum - 100) >= 1 && (
              <p className="mt-3 font-mono text-[11px] text-amber-400/80">
                Inputs do not sum to 100%. The teal figure is the effective target after normalization.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <Section label="Current vs target">
        <div className="overflow-x-auto">
          <div className="h-64 min-w-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="ticker" tick={{ fill: "#AEB9CC", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#8A97AC", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={45}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "#0B1322",
                    border: "1px solid #1B2638",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#EAEEF5",
                  }}
                  labelStyle={{ color: "#8A97AC" }}
                  itemStyle={{ color: "#EAEEF5" }}
                  formatter={(val: number, name: string) => [
                    `${val.toFixed(1)}%`,
                    name === "current" ? "Current" : "Target",
                  ]}
                />
                <Bar dataKey="current" fill="#8A97AC" name="current" />
                <Bar dataKey="target" fill="#1AA8BB" name="target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Legend
          items={[
            { glyph: <span className="inline-block w-3 h-[2px]" style={{ background: "#8A97AC" }} />, label: "current" },
            { glyph: <span className="inline-block w-3 h-[2px]" style={{ background: "#1AA8BB" }} />, label: "target" },
          ]}
        />
      </Section>

      {/* ── The gap ─────────────────────────────────────────────────────── */}
      <Section
        label="Gap to your targets"
        prose={
          result.isBalanced
            ? `Every position sits within your ${driftThreshold}% threshold.`
            : "What returning to the weights you set would require, position by position. This is arithmetic on your own targets, not a recommendation to trade."
        }
      >
        <div className="border-y border-vela-border">
          {result.holdings.map((h) => {
            const beyondThreshold = Math.abs(h.drift) > driftThreshold;
            const under = h.tradeAmount > 0;
            return (
              <div
                key={h.ticker}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 border-b border-vela-border last:border-b-0 ${
                  beyondThreshold ? "" : "opacity-55"
                }`}
              >
                <span aria-hidden="true" className="shrink-0">
                  {!beyondThreshold ? (
                    <Minus className="w-3.5 h-3.5 text-vela-muted" />
                  ) : under ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                  )}
                </span>

                <span className="font-mono text-[13px] font-semibold text-zinc-100 w-14 shrink-0">{h.ticker}</span>

                <span className="font-mono text-[12px] tabular-nums text-vela-muted shrink-0">
                  {(h.currentWeight * 100).toFixed(1)}%
                  <span className="mx-1.5 text-vela-subtle" aria-hidden="true">→</span>
                  <span className="text-vela-body">{(h.targetWeight * 100).toFixed(1)}%</span>
                </span>

                <span
                  className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                    beyondThreshold
                      ? h.drift > 0
                        ? "bg-gain/15 text-gain"
                        : "bg-loss/15 text-loss"
                      : "bg-vela-border/60 text-vela-muted"
                  }`}
                >
                  {fmtPct(h.drift)}
                </span>

                <span
                  className={`ml-auto font-mono text-[12px] tabular-nums ${
                    !beyondThreshold ? "text-vela-muted" : under ? "text-gain" : "text-loss"
                  }`}
                >
                  {beyondThreshold ? fmtCurrency(h.tradeAmount) : "on target"}
                </span>

                {beyondThreshold && h.tradeShares !== 0 && (
                  <span className="font-mono text-[11px] tabular-nums text-vela-muted w-16 text-right">
                    {h.tradeShares > 0 ? "+" : ""}{h.tradeShares} sh
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 font-mono text-[11px] text-vela-muted">
          <span>
            Underweight less overweight ={" "}
            <span className={cashToInvest > 0 ? "text-vela-teal" : "text-vela-body"}>
              {cashToInvest > 0 ? fmtCurrency(cashToInvest) : "$0"}
            </span>
            {cashToInvest === 0 && " · the two sides net out until you add cash above"}
          </span>
          <span className="tabular-nums">Net: {fmtCurrency(result.totalBuys - result.totalSells)}</span>
        </div>
      </Section>

      {/* ── Method ──────────────────────────────────────────────────────── */}
      <Section label="How this is computed">
        <Prose className="max-w-[640px]">
          Drift is the distance between a position&apos;s current weight and the target weight you
          set. The threshold decides how far it has to move before it is listed. The figures exclude
          commissions, taxes and minimum lot sizes, and realising a position can trigger capital
          gains, so the real cost of closing a gap is higher than the arithmetic shown here.
        </Prose>
        <p className="mt-4 font-mono text-[11px] text-vela-muted">
          Descriptive only, not investment advice.
        </p>
      </Section>
    </PageTransition>
    </TierGate>
  );
}
