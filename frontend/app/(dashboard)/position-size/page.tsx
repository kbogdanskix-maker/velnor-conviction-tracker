"use client";

import { useState, useMemo } from "react";
import {
  Calculator, AlertTriangle, CheckCircle2, Target,
  TrendingDown, DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Page ────────────────────────────────────────────────────────────────────

export default function PositionSizePage() {
  const { summary } = useDefaultPortfolio();
  const portfolioValue = summary?.total_value ?? 0;

  const [accountSize, setAccountSize] = useState(portfolioValue > 0 ? Math.round(portfolioValue) : 50000);
  const [riskPct, setRiskPct] = useState(2); // % of portfolio risked per trade
  const [entryPrice, setEntryPrice] = useState(150);
  const [stopLoss, setStopLoss] = useState(140);
  const [targetPrice, setTargetPrice] = useState(180);

  const analysis = useMemo(() => {
    const riskPerTrade = accountSize * (riskPct / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const shares = riskPerShare > 0 ? Math.floor(riskPerTrade / riskPerShare) : 0;
    const positionValue = shares * entryPrice;
    const positionPct = accountSize > 0 ? (positionValue / accountSize) * 100 : 0;

    const maxLoss = shares * riskPerShare;
    const potentialGain = shares * (targetPrice - entryPrice);
    const riskReward = riskPerShare > 0 ? (targetPrice - entryPrice) / riskPerShare : 0;

    const stopLossPct = entryPrice > 0 ? ((entryPrice - stopLoss) / entryPrice) * 100 : 0;
    const targetPct = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0;

    // Kelly Criterion (simplified): assumes 50% win rate
    const winRate = 0.5;
    const kellyPct = riskReward > 0 ? ((winRate * riskReward - (1 - winRate)) / riskReward) * 100 : 0;
    const kellyShares = kellyPct > 0 && riskPerShare > 0
      ? Math.floor((accountSize * kellyPct / 100) / entryPrice)
      : 0;

    return {
      riskPerTrade, riskPerShare, shares, positionValue, positionPct,
      maxLoss, potentialGain, riskReward, stopLossPct, targetPct,
      kellyPct: Math.max(0, kellyPct), kellyShares,
    };
  }, [accountSize, riskPct, entryPrice, stopLoss, targetPrice]);

  // Risk level assessment
  const riskLevel = analysis.positionPct > 25 ? "high" : analysis.positionPct > 10 ? "moderate" : "conservative";

  // Scenario analysis at different risk levels
  const scenarios = [1, 2, 3, 5].map((pct) => {
    const risk = accountSize * (pct / 100);
    const rps = Math.abs(entryPrice - stopLoss);
    const shares = rps > 0 ? Math.floor(risk / rps) : 0;
    return { pct, risk, shares, value: shares * entryPrice, portfolioPct: accountSize > 0 ? (shares * entryPrice / accountSize) * 100 : 0 };
  });

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Position Size Calculator</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Determine the right number of shares to buy based on your risk tolerance
        </p>
      </div>

      {/* Inputs + Result */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="lg:col-span-2 vela-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Trade Parameters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Account Size</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                <input type="number" value={accountSize || ""} onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Risk per Trade</label>
              <div className="relative">
                <input type="number" value={riskPct || ""} onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)} step="0.5"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Entry Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                <input type="number" value={entryPrice || ""} onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)} step="0.01"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Stop Loss</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                <input type="number" value={stopLoss || ""} onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)} step="0.01"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{analysis.stopLossPct.toFixed(1)}% below entry</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Target Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                <input type="number" value={targetPrice || ""} onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)} step="0.01"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal" />
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{analysis.targetPct.toFixed(1)}% above entry</p>
            </div>
          </div>

          {/* Risk preset buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[10px] text-zinc-600 self-center mr-1">Risk:</span>
            {[0.5, 1, 2, 3, 5].map((r) => (
              <button
                key={r}
                onClick={() => setRiskPct(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${riskPct === r ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <div className="vela-card p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Shares to Buy</p>
            <p className="text-4xl font-bold text-vela-teal tabular-nums mt-1">{analysis.shares}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Position: {formatCurrency(analysis.positionValue)} ({analysis.positionPct.toFixed(1)}% of account)
            </p>
          </div>

          <div className="vela-card p-5">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Max Loss</span>
                <span className="text-sm font-medium text-loss tabular-nums">−{formatCurrency(analysis.maxLoss)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Potential Gain</span>
                <span className="text-sm font-medium text-gain tabular-nums">+{formatCurrency(analysis.potentialGain)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-400">Risk/Reward</span>
                <span className={`text-sm font-bold tabular-nums ${analysis.riskReward >= 2 ? "text-gain" : analysis.riskReward >= 1 ? "text-amber-400" : "text-loss"}`}>
                  1:{analysis.riskReward.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Risk assessment */}
          <div className={`vela-card p-4 border-l-4 ${riskLevel === "conservative" ? "border-l-gain" : riskLevel === "moderate" ? "border-l-amber-400" : "border-l-loss"}`}>
            <div className="flex items-center gap-2 mb-1">
              {riskLevel === "conservative" ? <CheckCircle2 className="w-4 h-4 text-gain" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <span className={`text-sm font-semibold ${riskLevel === "conservative" ? "text-gain" : riskLevel === "moderate" ? "text-amber-400" : "text-loss"}`}>
                {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Position
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {riskLevel === "conservative"
                ? "Good risk management. Position is under 10% of your account."
                : riskLevel === "moderate"
                  ? "Moderate concentration. Worth knowing how this sits against your overall strategy."
                  : "High concentration. A position this size ties a large share of your outcome to one name."}
            </p>
          </div>
        </div>
      </div>

      {/* Scenario comparison */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Risk Level Scenarios</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {scenarios.map((s) => (
            <div key={s.pct} className={`p-4 rounded-lg border transition-colors ${s.pct === riskPct ? "border-vela-teal/50 bg-vela-teal/5" : "border-zinc-800 bg-zinc-800/30"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${s.pct === riskPct ? "text-vela-teal" : "text-zinc-500"}`}>
                {s.pct}% Risk
              </p>
              <p className="text-lg font-bold text-zinc-100 tabular-nums">{s.shares} shares</p>
              <p className="text-xs text-zinc-400 tabular-nums">{formatCurrency(s.value)}</p>
              <p className="text-xs text-zinc-500 tabular-nums">{s.portfolioPct.toFixed(1)}% of account</p>
              <p className="text-xs text-loss tabular-nums">Max loss: {formatCurrency(s.risk)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Position Sizing Rules</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p><span className="text-zinc-200 font-medium">1-2% Rule</span>  - never risk more than 1-2% of your total account on a single trade. Professional traders often use 0.5-1%.</p>
          <p><span className="text-zinc-200 font-medium">Risk/Reward minimum</span>  - aim for at least 1:2 risk/reward ratio. A 1:3 or better ratio means you can be wrong 60%+ of the time and still profit.</p>
          <p><span className="text-zinc-200 font-medium">Position concentration</span>  - keep individual positions under 5-10% of your portfolio to avoid catastrophic losses from single stocks.</p>
          <p><span className="text-zinc-200 font-medium">Correlation matters</span>  - if you hold multiple correlated positions, your true risk is higher than individual position sizes suggest.</p>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}
