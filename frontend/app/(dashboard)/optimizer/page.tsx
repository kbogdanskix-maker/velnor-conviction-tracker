"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Crosshair,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import type { Holding } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────

type RiskProfile = "conservative" | "balanced" | "growth" | "aggressive";

interface ModelPortfolio {
  name: string;
  profile: RiskProfile;
  allocations: { label: string; pct: number; color: string }[];
  expectedReturn: number;
  expectedVol: number;
  sharpe: number;
  description: string;
}

// ── Model portfolios (academic benchmarks) ───────────────────────────

const MODEL_PORTFOLIOS: ModelPortfolio[] = [
  {
    name: "Capital Preservation",
    profile: "conservative",
    allocations: [
      { label: "US Bonds", pct: 50, color: "bg-blue-400" },
      { label: "TIPS", pct: 20, color: "bg-cyan-400" },
      { label: "US Equities", pct: 15, color: "bg-teal-400" },
      { label: "Intl Equities", pct: 10, color: "bg-emerald-400" },
      { label: "Cash", pct: 5, color: "bg-zinc-400" },
    ],
    expectedReturn: 4.5,
    expectedVol: 6.0,
    sharpe: 0.42,
    description: "Prioritizes capital preservation with modest returns. Suitable for near-retirees or risk-averse investors.",
  },
  {
    name: "Balanced Growth",
    profile: "balanced",
    allocations: [
      { label: "US Equities", pct: 35, color: "bg-teal-400" },
      { label: "Intl Equities", pct: 20, color: "bg-emerald-400" },
      { label: "US Bonds", pct: 25, color: "bg-blue-400" },
      { label: "REITs", pct: 10, color: "bg-purple-400" },
      { label: "Commodities", pct: 10, color: "bg-amber-400" },
    ],
    expectedReturn: 7.0,
    expectedVol: 11.0,
    sharpe: 0.45,
    description: "Classic 60/40-ish allocation with diversification across asset classes. Time-tested approach for moderate risk tolerance.",
  },
  {
    name: "Growth",
    profile: "growth",
    allocations: [
      { label: "US Equities", pct: 45, color: "bg-teal-400" },
      { label: "Intl Equities", pct: 25, color: "bg-emerald-400" },
      { label: "Small-Cap", pct: 10, color: "bg-green-400" },
      { label: "REITs", pct: 10, color: "bg-purple-400" },
      { label: "Bonds", pct: 10, color: "bg-blue-400" },
    ],
    expectedReturn: 9.0,
    expectedVol: 15.0,
    sharpe: 0.47,
    description: "Equity-heavy for long-term wealth building. Accepts higher volatility for potentially greater returns.",
  },
  {
    name: "Maximum Growth",
    profile: "aggressive",
    allocations: [
      { label: "US Equities", pct: 50, color: "bg-teal-400" },
      { label: "Intl Equities", pct: 20, color: "bg-emerald-400" },
      { label: "Small-Cap", pct: 15, color: "bg-green-400" },
      { label: "Emerging Mkts", pct: 10, color: "bg-orange-400" },
      { label: "REITs", pct: 5, color: "bg-purple-400" },
    ],
    expectedReturn: 10.5,
    expectedVol: 19.0,
    sharpe: 0.39,
    description: "All-equity portfolio tilted toward growth factors. High volatility but highest long-term return potential.",
  },
];

// ── Efficient frontier (simulated) ───────────────────────────────────

function generateFrontier(): { volatility: number; ret: number; label?: string }[] {
  const points: { volatility: number; ret: number; label?: string }[] = [];
  // Parabolic curve approximating the efficient frontier
  for (let vol = 4; vol <= 22; vol += 0.5) {
    const ret = -0.005 * vol * vol + 0.7 * vol - 1.5;
    points.push({ volatility: vol, ret: Math.max(ret, 1) });
  }
  // Add model portfolios as named points
  for (const mp of MODEL_PORTFOLIOS) {
    points.push({ volatility: mp.expectedVol, ret: mp.expectedReturn, label: mp.name });
  }
  return points;
}

// ── Profile colors ───────────────────────────────────────────────────

const PROFILE_COLORS: Record<RiskProfile, { border: string; bg: string; text: string }> = {
  conservative: { border: "border-blue-400/30", bg: "bg-blue-400/10", text: "text-blue-400" },
  balanced: { border: "border-teal-400/30", bg: "bg-teal-400/10", text: "text-teal-400" },
  growth: { border: "border-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-400" },
  aggressive: { border: "border-orange-400/30", bg: "bg-orange-400/10", text: "text-orange-400" },
};

// ── Chart tooltip ────────────────────────────────────────────────────

function FrontierTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { volatility: number; ret: number; label?: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {d.label && <p className="text-zinc-100 font-medium mb-1">{d.label}</p>}
      <p className="text-zinc-400">Volatility: {d.volatility.toFixed(1)}%</p>
      <p className="text-teal-400">Expected Return: {d.ret.toFixed(1)}%</p>
      {d.volatility > 0 && <p className="text-zinc-500">Sharpe: {(d.ret / d.volatility).toFixed(2)}</p>}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyOptimizer() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <Crosshair className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">No portfolio to optimize</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          Add holdings to your portfolio first. The optimizer needs your current allocation to suggest improvements.
        </p>
      </div>
      <Link href="/portfolio" className="inline-flex items-center gap-2 btn-primary text-sm">
        Go to Portfolio <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function OptimizerPage() {
  const { portfolio, summary, loading, hasHoldings } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);

  const [selectedProfile, setSelectedProfile] = useState<RiskProfile>("balanced");
  const selectedModel = MODEL_PORTFOLIOS.find((m) => m.profile === selectedProfile)!;

  const frontierData = useMemo(() => generateFrontier(), []);

  // Current portfolio position on frontier
  const currentPoint = useMemo(() => {
    if (!risk?.annualized_return || !risk?.annualized_volatility) return null;
    return {
      volatility: risk.annualized_volatility,
      ret: risk.annualized_return,
      label: "Your Portfolio",
    };
  }, [risk]);

  // Comparison vs selected model
  const comparison = useMemo(() => {
    if (!risk || !summary) return null;
    const yourReturn = risk.annualized_return ?? 0;
    const yourVol = risk.annualized_volatility ?? 0;
    const yourSharpe = risk.sharpe_ratio ?? 0;

    const returnGap = selectedModel.expectedReturn - yourReturn;
    const volGap = yourVol - selectedModel.expectedVol;
    const sharpeGap = selectedModel.sharpe - yourSharpe;

    return { returnGap, volGap, sharpeGap, yourReturn, yourVol, yourSharpe };
  }, [risk, summary, selectedModel]);

  // Holdings concentration
  const holdingWeights = useMemo(() => {
    if (!summary) return [];
    const total = summary.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    return summary.holdings
      .map((h) => ({ ticker: h.ticker, pct: total > 0 ? ((h.market_value ?? 0) / total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [summary]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Crosshair className="w-6 h-6 text-cyan-400" />
          Portfolio Optimizer
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Compare your portfolio against model allocations on the efficient frontier
        </p>
      </div>

      {!hasHoldings ? (
        <EmptyOptimizer />
      ) : (
        <>
          {/* Efficient frontier chart */}
          <FloatingCard glowColor="rgba(34, 211, 238, 0.08)" tilt={false}>
            <h2 className="section-heading mb-4">Efficient Frontier</h2>
            <div className="h-[300px] sm:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                  <XAxis
                    dataKey="volatility"
                    type="number"
                    domain={[0, 25]}
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Volatility (%)", position: "bottom", fill: "#52525b", fontSize: 11, offset: -5 }}
                  />
                  <YAxis
                    dataKey="ret"
                    type="number"
                    domain={[0, 14]}
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Return (%)", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip content={<FrontierTooltip />} />

                  {/* Frontier curve */}
                  <Scatter
                    data={frontierData.filter((d) => !d.label)}
                    fill="rgb(63, 63, 70)"
                    fillOpacity={0.4}
                    r={1.5}
                    isAnimationActive={false}
                  />

                  {/* Model portfolios */}
                  <Scatter
                    data={frontierData.filter((d) => d.label && d.label !== "Your Portfolio")}
                    fill="rgb(20, 184, 166)"
                    r={6}
                    stroke="rgb(20, 184, 166)"
                    strokeWidth={2}
                    fillOpacity={0.3}
                  />

                  {/* Current portfolio */}
                  {currentPoint && (
                    <Scatter
                      data={[currentPoint]}
                      fill="rgb(244, 63, 94)"
                      r={8}
                      stroke="rgb(244, 63, 94)"
                      strokeWidth={2}
                      fillOpacity={0.5}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-500 justify-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" /> Frontier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Model Portfolios
              </span>
              {currentPoint && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-loss" /> Your Portfolio
                </span>
              )}
            </div>
          </FloatingCard>

          {/* Model portfolio selector */}
          <RevealOnScroll>
            <div>
              <h2 className="section-heading mb-3">Model Portfolios</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {MODEL_PORTFOLIOS.map((mp) => {
                  const c = PROFILE_COLORS[mp.profile];
                  const isSelected = mp.profile === selectedProfile;
                  return (
                    <button
                      key={mp.profile}
                      onClick={() => setSelectedProfile(mp.profile)}
                      className={`vela-card text-left transition-all ${
                        isSelected ? `${c.border} border-2 ring-1 ring-inset ${c.border}` : "hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isSelected ? c.text : "text-zinc-300"}`}>
                          {mp.name}
                        </span>
                        {isSelected && <div className={`w-2 h-2 rounded-full ${c.bg.replace("/10", "")}`} />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>Return: <span className="text-zinc-300 tabular-nums">{mp.expectedReturn}%</span></span>
                        <span>Vol: <span className="text-zinc-300 tabular-nums">{mp.expectedVol}%</span></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </RevealOnScroll>

          {/* Selected model detail + comparison */}
          <RevealOnScroll delay={0.05}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Model allocation */}
              <div className="vela-card">
                <h3 className="text-sm font-medium text-zinc-200 mb-3">{selectedModel.name} Allocation</h3>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{selectedModel.description}</p>

                {/* Stacked bar */}
                <div className="flex h-3 rounded-full overflow-hidden mb-4">
                  {selectedModel.allocations.map((a) => (
                    <div
                      key={a.label}
                      className={`${a.color} transition-all duration-500`}
                      style={{ width: `${a.pct}%` }}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  {selectedModel.allocations.map((a) => (
                    <div key={a.label} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-sm ${a.color}`} />
                      <span className="text-xs text-zinc-400 flex-1">{a.label}</span>
                      <span className="text-xs font-medium text-zinc-200 tabular-nums">{a.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-[10px] text-zinc-500">Expected Return</p>
                    <p className="text-sm font-bold text-zinc-200 tabular-nums">{selectedModel.expectedReturn}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Volatility</p>
                    <p className="text-sm font-bold text-zinc-200 tabular-nums">{selectedModel.expectedVol}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Sharpe</p>
                    <p className="text-sm font-bold text-zinc-200 tabular-nums">{selectedModel.sharpe}</p>
                  </div>
                </div>
              </div>

              {/* Your portfolio vs model */}
              <div className="vela-card">
                <h3 className="text-sm font-medium text-zinc-200 mb-3">Your Portfolio vs {selectedModel.name}</h3>

                {comparison ? (
                  <div className="space-y-4">
                    {[
                      {
                        label: "Annual Return",
                        yours: `${comparison.yourReturn.toFixed(1)}%`,
                        model: `${selectedModel.expectedReturn}%`,
                        gap: comparison.returnGap,
                        goodIfPositive: true,
                      },
                      {
                        label: "Volatility",
                        yours: `${comparison.yourVol.toFixed(1)}%`,
                        model: `${selectedModel.expectedVol}%`,
                        gap: comparison.volGap,
                        goodIfPositive: true, // gap = model vol - yours, so positive = you're less volatile
                      },
                      {
                        label: "Sharpe Ratio",
                        yours: comparison.yourSharpe.toFixed(2),
                        model: selectedModel.sharpe.toFixed(2),
                        gap: comparison.sharpeGap,
                        goodIfPositive: true,
                      },
                    ].map((row) => {
                      const betterThanModel = row.gap < 0;
                      return (
                        <div key={row.label} className="flex items-center gap-4">
                          <span className="text-xs text-zinc-500 w-24">{row.label}</span>
                          <div className="flex-1 flex items-center gap-3">
                            <span className="text-sm font-medium text-zinc-200 tabular-nums w-16 text-right">{row.yours}</span>
                            <span className="text-xs text-zinc-600">vs</span>
                            <span className="text-sm font-medium text-zinc-400 tabular-nums w-16">{row.model}</span>
                          </div>
                          <span className={`text-xs font-medium ${betterThanModel ? "text-gain" : Math.abs(row.gap) < 0.5 ? "text-zinc-500" : "text-amber-400"}`}>
                            {betterThanModel ? "Better" : Math.abs(row.gap) < 0.5 ? "Similar" : "Below"}
                          </span>
                        </div>
                      );
                    })}

                    {/* Current holdings breakdown */}
                    <div className="pt-3 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-2">Your Current Holdings ({holdingWeights.length} positions)</p>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        {holdingWeights.slice(0, 10).map((h, i) => (
                          <div
                            key={h.ticker}
                            className="transition-all duration-500"
                            style={{
                              width: `${h.pct}%`,
                              backgroundColor: `hsl(${170 + i * 25}, 50%, ${55 - i * 3}%)`,
                            }}
                          />
                        ))}
                        {holdingWeights.length > 10 && (
                          <div
                            className="bg-zinc-700"
                            style={{ width: `${holdingWeights.slice(10).reduce((s, h) => s + h.pct, 0)}%` }}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {holdingWeights.slice(0, 6).map((h) => (
                          <span key={h.ticker} className="text-[10px] text-zinc-500">
                            {h.ticker} {h.pct.toFixed(0)}%
                          </span>
                        ))}
                        {holdingWeights.length > 6 && (
                          <span className="text-[10px] text-zinc-600">+{holdingWeights.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Info className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">
                      Need at least 30 days of data to compare against models.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </RevealOnScroll>

          {/* Optimization suggestions */}
          <RevealOnScroll delay={0.1}>
            <div className="vela-card">
              <h2 className="section-heading mb-3">Optimization Insights</h2>
              <div className="space-y-2">
                {(() => {
                  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];

                  if (holdingWeights.length < 5) {
                    insights.push({ type: "warning", text: `Only ${holdingWeights.length} positions — consider adding more holdings for better diversification and risk-adjusted returns.` });
                  }

                  if (holdingWeights[0] && holdingWeights[0].pct > 30) {
                    insights.push({ type: "warning", text: `${holdingWeights[0].ticker} is ${holdingWeights[0].pct.toFixed(0)}% of your portfolio. Consider trimming to reduce single-stock risk.` });
                  }

                  if (comparison && comparison.sharpeGap > 0.1) {
                    insights.push({ type: "info", text: `The ${selectedModel.name} model has a higher Sharpe ratio, suggesting better risk-adjusted returns. Consider rebalancing toward this allocation.` });
                  } else if (comparison && comparison.sharpeGap < -0.1) {
                    insights.push({ type: "success", text: `Your portfolio has a better Sharpe ratio than the ${selectedModel.name} model — your risk-adjusted returns are strong.` });
                  }

                  if (risk?.annualized_volatility && risk.annualized_volatility > 25) {
                    insights.push({ type: "warning", text: "High portfolio volatility. Adding bonds or low-correlation assets could reduce risk without proportionally reducing returns." });
                  }

                  if (holdingWeights.length >= 15) {
                    insights.push({ type: "success", text: `Well-diversified with ${holdingWeights.length} positions. Focus on quality over quantity from here.` });
                  }

                  insights.push({ type: "info", text: "Model portfolios use historical averages. Past performance doesn't guarantee future results. Consider your time horizon and risk tolerance." });

                  return insights.map((ins, i) => {
                    const Icon = ins.type === "success" ? CheckCircle2 : ins.type === "warning" ? AlertTriangle : Info;
                    const colors = ins.type === "success" ? "text-gain border-gain/20 bg-gain/5" : ins.type === "warning" ? "text-amber-400 border-amber-400/20 bg-amber-400/5" : "text-teal-400 border-teal-400/20 bg-teal-400/5";
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg border ${colors}`}>
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-zinc-300">{ins.text}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </RevealOnScroll>

          {/* Related pages */}
          <RevealOnScroll delay={0.15}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { href: "/rebalance", label: "Rebalance", desc: "Set target allocations", icon: Crosshair },
                { href: "/risk", label: "Risk Dashboard", desc: "Detailed risk metrics", icon: Shield },
                { href: "/correlation", label: "Diversification", desc: "Correlation analysis", icon: TrendingUp },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="vela-card group hover:border-zinc-600 transition-colors flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-cyan-500/10 transition-colors">
                    <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{link.label}</p>
                    <p className="text-xs text-zinc-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </Link>
              ))}
            </div>
          </RevealOnScroll>
        </>
      )}
    </PageTransition>
  );
}
