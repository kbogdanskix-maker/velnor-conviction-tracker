"use client";

import { useState, useMemo } from "react";
import { Scale, ArrowUpRight, ArrowDownRight, Minus, Info, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { calculateRebalance } from "@/lib/rebalance-calc";
import type { Strategy, HoldingAllocation } from "@/lib/rebalance-calc";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

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
      <PageTransition className="space-y-6">
        <Header />
        <div className="vela-card text-center py-16 space-y-3">
          <Scale className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-medium">No holdings to rebalance</p>
          <p className="text-zinc-500 text-sm">Add positions to your portfolio first.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {/* Controls */}
      <div className="vela-card space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Strategy & Settings</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Strategy */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5">Strategy</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStrategy("equal")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  strategy === "equal"
                    ? "text-vela-teal border-vela-teal/40 bg-vela-teal/10"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Equal Weight
              </button>
              <button
                onClick={() => setStrategy("custom")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  strategy === "custom"
                    ? "text-vela-teal border-vela-teal/40 bg-vela-teal/10"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Drift threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-500">Drift Threshold</label>
              <span className="text-xs font-medium tabular text-zinc-200">{driftThreshold}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={driftThreshold}
              onChange={(e) => setDriftThreshold(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Cash to invest */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5">Additional Cash</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="number"
                value={cashToInvest || ""}
                onChange={(e) => setCashToInvest(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none tabular"
              />
            </div>
          </div>
        </div>

        {/* Custom weight sliders */}
        {strategy === "custom" && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Set target weights — effective targets shown in teal</p>
              <span className={`text-xs tabular font-medium px-2 py-0.5 rounded ${
                Math.abs(rawInputSum - 100) < 1
                  ? "text-zinc-500"
                  : "text-amber-400 bg-amber-400/10"
              }`}>
                Sum: {rawInputSum}%{Math.abs(rawInputSum - 100) >= 1 ? " → normalized" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {holdings.map((h) => {
                const ticker = h.ticker;
                const val = effectiveCustom[ticker] ?? 0;
                const effective = normalizedTargets[ticker] ?? 0;
                const showNormalized = Math.abs(rawInputSum - 100) >= 1;
                return (
                  <div key={ticker} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-300 w-12 font-medium">{ticker}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={val}
                        onChange={(e) => setCustomTargets((prev) => ({ ...prev, [ticker]: Number(e.target.value) }))}
                        className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                          [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <span className="text-xs tabular text-zinc-400 w-10 text-right">{val}%</span>
                      {showNormalized && (
                        <span className="text-xs tabular text-teal-400 w-12 text-right">→ {effective}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {Math.abs(rawInputSum - 100) >= 1 && (
              <p className="text-[11px] text-amber-400/70">
                Inputs don&apos;t sum to 100% — teal values show effective targets after normalization.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="vela-card text-center py-3">
          <p className={`text-2xl font-bold tabular ${result.isBalanced ? "text-emerald-400" : "text-amber-400"}`}>
            {isNaN(result.maxDrift) ? "0.0" : result.maxDrift.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-500">Max Drift</p>
        </div>
        <div className="vela-card text-center py-3">
          <p className="text-2xl font-bold tabular text-zinc-100">{result.numTrades}</p>
          <p className="text-xs text-zinc-500">Trades Needed</p>
        </div>
        <div className="vela-card text-center py-3">
          <p className="text-2xl font-bold tabular text-emerald-400">{fmtCurrency(result.totalBuys)}</p>
          <p className="text-xs text-zinc-500">Total Buys</p>
        </div>
        <div className="vela-card text-center py-3">
          <p className="text-2xl font-bold tabular text-rose-400">{fmtCurrency(result.totalSells)}</p>
          <p className="text-xs text-zinc-500">Total Sells</p>
        </div>
      </div>

      {/* Capital deployment note — explains why buys ≈ sells */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-600">
        <span>
          Buys − Sells ={" "}
          <span className={cashToInvest > 0 ? "text-teal-400 font-medium" : "text-zinc-500"}>
            {cashToInvest > 0 ? fmtCurrency(cashToInvest) : "$0"}
          </span>
          {cashToInvest === 0 && (
            <span className="ml-1 text-zinc-700">
              — sells fund the buys; add cash above to deploy new capital
            </span>
          )}
        </span>
        <span className="text-zinc-700 tabular">
          Net: {fmtCurrency(result.totalBuys - result.totalSells)}
        </span>
      </div>

      {result.isBalanced && (
        <div className="vela-card border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-emerald-400 font-medium">
            Portfolio is balanced. All positions are within the {driftThreshold}% drift threshold.
          </p>
        </div>
      )}

      {/* Drift chart */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Current vs Target Allocation</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="ticker"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={45}
              />
              <Tooltip cursor={false}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number, name: string) => [
                  `${val.toFixed(1)}%`,
                  name === "current" ? "Current" : "Target",
                ]}
              />
              <Bar dataKey="current" fill="#71717a" radius={[4, 4, 0, 0]} name="current" />
              <Bar dataKey="target" fill="rgb(26, 168, 187)" radius={[4, 4, 0, 0]} name="target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-zinc-500" />
            <span className="text-[10px] text-zinc-400">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
            <span className="text-[10px] text-zinc-400">Target</span>
          </div>
        </div>
      </div>

      {/* Trade list */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Suggested Trades</h2>
        <div className="space-y-2">
          {result.holdings.map((h) => {
            const needsTrade = Math.abs(h.drift) > driftThreshold;
            const isBuy = h.tradeAmount > 0;
            return (
              <div
                key={h.ticker}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  needsTrade ? "bg-zinc-800/50" : "opacity-50"
                }`}
              >
                {/* Direction icon */}
                <div className={`p-1 rounded ${
                  !needsTrade ? "bg-zinc-800 text-zinc-600" :
                  isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {!needsTrade ? <Minus className="w-3.5 h-3.5" /> :
                   isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                </div>

                {/* Ticker */}
                <span className="text-sm font-semibold text-zinc-100 w-14">{h.ticker}</span>

                {/* Current -> Target */}
                <span className="text-xs text-zinc-500 tabular">
                  {(h.currentWeight * 100).toFixed(1)}%
                  <span className="mx-1.5 text-zinc-600">→</span>
                  <span className="text-zinc-300">{(h.targetWeight * 100).toFixed(1)}%</span>
                </span>

                {/* Drift badge */}
                <span className={`text-[10px] font-medium tabular px-1.5 py-0.5 rounded ${
                  Math.abs(h.drift) > driftThreshold
                    ? h.drift > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}>
                  {fmtPct(h.drift)}
                </span>

                {/* Trade amount */}
                <span className={`ml-auto text-xs font-medium tabular ${
                  !needsTrade ? "text-zinc-600" :
                  isBuy ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {needsTrade ? fmtCurrency(h.tradeAmount) : "OK"}
                </span>

                {/* Shares */}
                {needsTrade && h.tradeShares !== 0 && (
                  <span className="text-[10px] text-zinc-500 tabular w-16 text-right">
                    {h.tradeShares > 0 ? "+" : ""}{h.tradeShares} shr
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="vela-card border-zinc-700">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">About Rebalancing</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Rebalancing keeps your portfolio aligned with your target allocation. The drift
              threshold determines when a position is far enough from target to warrant a trade.
              Consider tax implications before executing sells.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Trade suggestions are based on weight targets only. Consider commissions, taxes, and
          minimum lot sizes before executing. Not financial advice.
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <Scale className="w-7 h-7 text-vela-teal" />
        Rebalance
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Align your portfolio to target weights with suggested trades.
      </p>
    </div>
  );
}
