"use client";

import { useMemo, useState } from "react";
import { Shield, AlertTriangle, CheckCircle, TrendingDown, Info } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useCorrelation } from "@/hooks/useCorrelation";
import { formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import FloatingCard from "@/components/celestial/FloatingCard";
import GlowBorder from "@/components/celestial/GlowBorder";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import ErrorState from "@/components/shared/ErrorState";

// ── Types & Helpers ─────────────────────────────────────────────────────────

const PERIODS = [
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
  { value: "5y", label: "5Y" },
];

interface RiskCluster {
  tickers: string[];
  avgCorrelation: number;
  label: string;
}

interface OverlapPair {
  t1: string;
  t2: string;
  correlation: number;
  severity: "danger" | "warning" | "ok";
  explanation: string;
}

interface DivScore {
  grade: "A" | "B" | "C" | "D" | "F";
  score: number; // 0-100
  summary: string;
  color: string;
  bgColor: string;
}

function computeDivScore(avgCorr: number, highPairs: number, negativePairs: number, totalPairs: number): DivScore {
  // Score: 100 = perfectly diversified, 0 = all identical
  // Penalize high average correlation, reward negative correlations
  let score = 100;
  score -= avgCorr * 60; // avg corr of 1.0 = -60 points
  score -= (highPairs / Math.max(totalPairs, 1)) * 30; // high-corr pairs penalty
  score += Math.min(negativePairs * 5, 15); // bonus for negative correlations (max +15)
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { grade: "A", score, summary: "Excellent diversification. Your holdings move independently, reducing risk effectively.", color: "text-emerald-400", bgColor: "bg-emerald-500" };
  if (score >= 65) return { grade: "B", score, summary: "Good diversification. Most holdings provide genuine risk reduction, with some room to improve.", color: "text-emerald-400", bgColor: "bg-emerald-500" };
  if (score >= 50) return { grade: "C", score, summary: "Average diversification. Several holdings move together, limiting risk reduction benefits.", color: "text-amber-400", bgColor: "bg-amber-500" };
  if (score >= 35) return { grade: "D", score, summary: "Weak diversification. Many holdings are highly correlated  - a broad downturn would hit most of your portfolio simultaneously.", color: "text-orange-400", bgColor: "bg-orange-500" };
  return { grade: "F", score, summary: "Poor diversification. Your portfolio essentially behaves like one or two stocks. A single sector move could affect everything.", color: "text-rose-400", bgColor: "bg-rose-500" };
}

function findClusters(tickers: string[], matrix: number[][]): RiskCluster[] {
  // Simple clustering: group tickers where all pairwise correlations > 0.6
  const n = tickers.length;
  const visited = new Set<number>();
  const clusters: RiskCluster[] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    const group = [i];
    visited.add(i);

    for (let j = i + 1; j < n; j++) {
      if (visited.has(j)) continue;
      // Check if j is correlated with ALL members of the group
      const allCorrelated = group.every((g) => matrix[g][j] >= 0.6);
      if (allCorrelated) {
        group.push(j);
        visited.add(j);
      }
    }

    if (group.length >= 2) {
      let total = 0;
      let count = 0;
      for (let a = 0; a < group.length; a++) {
        for (let b = a + 1; b < group.length; b++) {
          total += matrix[group[a]][group[b]];
          count++;
        }
      }
      clusters.push({
        tickers: group.map((i) => tickers[i]),
        avgCorrelation: count > 0 ? total / count : 0,
        label: group.length >= 3
          ? `These ${group.length} stocks move closely together  - holding all of them doesn't add much diversification`
          : "These two stocks tend to move in the same direction",
      });
    }
  }

  clusters.sort((a, b) => b.tickers.length - a.tickers.length);
  return clusters;
}

function buildOverlapPairs(tickers: string[], matrix: number[][]): OverlapPair[] {
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const corr = matrix[i][j];
      let severity: OverlapPair["severity"];
      let explanation: string;

      if (corr >= 0.85) {
        severity = "danger";
        explanation = `Nearly identical movement  - holding both barely adds diversification. Consider keeping only one.`;
      } else if (corr >= 0.7) {
        severity = "warning";
        explanation = `Strong overlap  - these stocks usually rise and fall together. You're doubling down on similar risk.`;
      } else {
        severity = "ok";
        explanation = corr < -0.2
          ? "Natural hedge  - these move in opposite directions, which helps protect your portfolio."
          : "Low overlap  - these provide genuine diversification benefit.";
      }

      pairs.push({ t1: tickers[i], t2: tickers[j], correlation: corr, severity, explanation });
    }
  }
  // Show most concerning first
  pairs.sort((a, b) => b.correlation - a.correlation);
  return pairs;
}

// What an investor can actually DO about it
function getSuggestions(avgCorr: number, clusters: RiskCluster[], negPairs: number): string[] {
  const tips: string[] = [];

  if (avgCorr > 0.6) {
    tips.push("Consider adding bonds (BND, AGG) or treasuries (TLT)  - they often move opposite to stocks during crashes.");
  }
  if (clusters.length > 0) {
    tips.push("You have tightly correlated groups. Selling one stock from each cluster and rotating into a different sector would improve diversification without reducing your number of holdings.");
  }
  if (avgCorr > 0.4 && negPairs === 0) {
    tips.push("Adding international stocks (VXUS, EFA) or commodities (GLD, GSG) could introduce valuable low-correlation exposure.");
  }
  if (avgCorr > 0.3) {
    tips.push("REITs (VNQ) and utilities (XLU) often have lower correlation with growth stocks  - worth considering for balance.");
  }
  if (tips.length === 0) {
    tips.push("Your diversification looks solid. Continue monitoring as correlations can shift during market crises.");
  }
  return tips.slice(0, 3);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CorrelationPage() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = (summary?.holdings?.length ?? 0) >= 2;

  const [period, setPeriod] = useState("1y");
  const { correlation, loading, error } = useCorrelation(hasHoldings ? portfolioId : null, period);

  // Compute everything
  const analysis = useMemo(() => {
    if (!correlation?.matrix || correlation.tickers.length < 2) return null;

    const { tickers, matrix } = correlation;
    const pairs = buildOverlapPairs(tickers, matrix);
    const clusters = findClusters(tickers, matrix);

    const allCorrs = pairs.map((p) => p.correlation);
    const avgCorr = allCorrs.reduce((s, v) => s + v, 0) / allCorrs.length;
    const highPairs = pairs.filter((p) => p.correlation >= 0.7).length;
    const negativePairs = pairs.filter((p) => p.correlation < -0.2).length;
    const divScore = computeDivScore(avgCorr, highPairs, negativePairs, pairs.length);
    const suggestions = getSuggestions(avgCorr, clusters, negativePairs);

    // For the bar chart: each holding's avg correlation with others
    const holdingAvgs = tickers.map((ticker, i) => {
      const corrs = tickers
        .map((_, j) => (i !== j ? matrix[i][j] : null))
        .filter((v): v is number => v !== null);
      const avg = corrs.reduce((s, v) => s + v, 0) / corrs.length;
      return { ticker, avg, color: avg > 0.6 ? "#ef4444" : avg > 0.4 ? "#f59e0b" : "#34d399" };
    }).sort((a, b) => b.avg - a.avg);

    return { pairs, clusters, avgCorr, highPairs, negativePairs, divScore, suggestions, holdingAvgs };
  }, [correlation]);

  const isEmpty = !loading && (!hasHoldings || !correlation || correlation.tickers.length < 2);

  return (
    <TierGate requiredTier="navigator">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Shield className="w-7 h-7 text-vela-teal" />
          Diversification Score
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          How well your holdings protect you when markets move. Higher score = less risk from concentration.
        </p>
      </div>

      {/* Period selector */}
      {hasHoldings && (
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                period === p.value
                  ? "bg-vela-teal/20 text-vela-teal"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState message="Failed to load correlation data." onRetry={() => window.location.reload()} />
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="vela-card animate-pulse h-24" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Shield className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">Need at least 2 holdings</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add more stocks to your portfolio to see your diversification score.
            </p>
          </div>
        </div>
      ) : analysis && (
        <>
          {/* Big Grade Card  - wrapped in GlowBorder */}
          <GlowBorder speed={4}>
            <div className="py-8 text-center px-6">
              <motion.div
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-zinc-700 mb-3"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className={`text-5xl font-black ${analysis.divScore.color}`}>
                  {analysis.divScore.grade}
                </span>
              </motion.div>
              <div className="max-w-md mx-auto">
                <p className={`text-lg font-semibold ${analysis.divScore.color}`}>
                  {analysis.divScore.score.toFixed(0)}/100
                </p>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  {analysis.divScore.summary}
                </p>
              </div>
            </div>
          </GlowBorder>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <FloatingCard delay={0.1}>
              <div className="text-center py-3 px-3">
                <p className={`text-2xl font-bold tabular ${analysis.avgCorr > 0.5 ? "text-amber-400" : "text-emerald-400"}`}>
                  {analysis.avgCorr.toFixed(2)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Avg Overlap
                </p>
              </div>
            </FloatingCard>
            <FloatingCard delay={0.18}>
              <div className="text-center py-3 px-3">
                <p className={`text-2xl font-bold tabular ${analysis.highPairs > 0 ? "text-rose-400" : "text-zinc-100"}`}>
                  {analysis.highPairs}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  High-Overlap Pairs
                </p>
              </div>
            </FloatingCard>
            <FloatingCard delay={0.26}>
              <div className="text-center py-3 px-3">
                <p className="text-2xl font-bold tabular text-vela-teal">{analysis.negativePairs}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Natural Hedges
                </p>
              </div>
            </FloatingCard>
          </div>

          {/* Risk Clusters */}
          {analysis.clusters.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Risk Clusters
              </h2>
              <p className="text-xs text-zinc-500 -mt-1">
                Stocks that move together act like a single bet  - if one drops, they all likely will.
              </p>
              {analysis.clusters.map((cluster, i) => (
                <div key={i} className="vela-card border-amber-500/10">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {cluster.tickers.map((t) => (
                          <span key={t} className="px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-200 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-400">{cluster.label}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Average overlap: {(cluster.avgCorrelation * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Most Overlapping & Best Hedges */}
          <RevealOnScroll>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Most overlapping */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Most Overlapping</h2>
              <p className="text-xs text-zinc-500 -mt-1">
                These pairs move in sync  - consider if you really need both.
              </p>
              {analysis.pairs
                .filter((p) => p.severity !== "ok")
                .slice(0, 5)
                .map((p) => (
                  <PairCard key={`${p.t1}-${p.t2}`} pair={p} />
                ))}
              {analysis.pairs.filter((p) => p.severity !== "ok").length === 0 && (
                <div className="vela-card py-4 text-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs text-zinc-400">No concerning overlap detected</p>
                </div>
              )}
            </div>

            {/* Best hedges */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Best Hedges</h2>
              <p className="text-xs text-zinc-500 -mt-1">
                Low or negative overlap = one may rise when the other falls.
              </p>
              {analysis.pairs
                .slice()
                .sort((a, b) => a.correlation - b.correlation)
                .slice(0, 5)
                .map((p) => (
                  <PairCard key={`hedge-${p.t1}-${p.t2}`} pair={p} />
                ))}
            </div>
          </div>
          </RevealOnScroll>

          {/* Constellation cluster visualization */}
          {correlation && correlation.tickers.length >= 3 && (
            <RevealOnScroll delay={0.05}>
              <div className="vela-card overflow-hidden">
                <h2 className="text-sm font-medium text-zinc-300 mb-1">Constellation Map</h2>
                <p className="text-xs text-zinc-500 mb-4">Holdings as stars  - connected lines show high overlap. Brighter connections = stronger overlap.</p>
                <ConstellationViz
                  tickers={correlation.tickers}
                  matrix={correlation.matrix}
                  holdingAvgs={analysis.holdingAvgs}
                />
              </div>
            </RevealOnScroll>
          )}

          {/* Per-holding bar chart: who's the least diversified? */}
          {analysis.holdingAvgs.length > 0 && (
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-1">Overlap Score by Holding</h2>
              <p className="text-xs text-zinc-500 mb-4">
                Higher bars = more overlap with the rest of your portfolio. Consider replacing the highest-overlap holdings for better diversification.
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.holdingAvgs} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="ticker"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[-0.2, 1]}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      width={40}
                    />
                    <Tooltip cursor={false}
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number) => [`${(val * 100).toFixed(1)}% avg overlap`, "Overlap"]}
                    />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {analysis.holdingAvgs.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Actionable suggestions */}
          <RevealOnScroll delay={0.1}>
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-vela-teal" />
              How to Improve
            </h2>
            {analysis.suggestions.map((tip, i) => (
              <div key={i} className="vela-card py-3 px-4 border-vela-teal/5">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <span className="text-vela-teal font-medium">{i + 1}.</span> {tip}
                </p>
              </div>
            ))}
          </div>
          </RevealOnScroll>

          {/* Educational note */}
          <div className="vela-card px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div className="text-xs text-zinc-500 leading-relaxed space-y-1">
                <p>
                  <span className="text-zinc-300 font-medium">What is diversification?</span>{" "}
                  When your investments don&apos;t all move together, bad days for one stock can be offset by good days for another.
                  The less your holdings overlap, the smoother your portfolio&apos;s ride.
                </p>
                <p>
                  <span className="text-zinc-300 font-medium">Overlap score</span>{" "}
                  measures how much two stocks move in sync (0% = completely independent, 100% = identical movement).
                  Scores above 70% mean the stocks offer very little diversification from each other.
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Based on {period === "3mo" ? "3-month" : period === "6mo" ? "6-month" : period === "2y" ? "2-year" : period === "5y" ? "5-year" : "1-year"} daily
              returns. Correlations shift during market crises. Not financial advice.
            </p>
          </div>
        </>
      )}
    </PageTransition>
    </TierGate>
  );
}

// ── Pair Card ────────────────────────────────────────────────────────────────

// ── Constellation Visualization ──────────────────────────────────────────────

function ConstellationViz({
  tickers,
  matrix,
  holdingAvgs,
}: {
  tickers: string[];
  matrix: number[][];
  holdingAvgs: { ticker: string; avg: number; color: string }[];
}) {
  const n = tickers.length;
  const W = 600;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.36;

  // Position each ticker in a circle
  const positions = tickers.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });

  // Build lines for correlated pairs
  const lines: { x1: number; y1: number; x2: number; y2: number; corr: number; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = matrix[i][j];
      if (corr >= 0.4) {
        const opacity = Math.min((corr - 0.4) / 0.6, 1);
        const color = corr >= 0.7 ? `rgba(239, 68, 68, ${opacity * 0.7})` : `rgba(251, 191, 36, ${opacity * 0.5})`;
        lines.push({
          x1: positions[i].x, y1: positions[i].y,
          x2: positions[j].x, y2: positions[j].y,
          corr, color,
        });
      }
    }
  }

  // Map avg correlation to star size
  const avgMap = new Map(holdingAvgs.map((h) => [h.ticker, h]));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-80" preserveAspectRatio="xMidYMid meet">
        {/* Defs for glow filter */}
        <defs>
          <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {lines.map((line, i) => (
          <motion.line
            key={i}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke={line.color}
            strokeWidth={line.corr >= 0.7 ? 2 : 1}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.03, duration: 0.6 }}
          />
        ))}

        {/* Star nodes */}
        {tickers.map((ticker, i) => {
          const pos = positions[i];
          const holding = avgMap.get(ticker);
          const avgCorr = holding?.avg ?? 0;
          const starSize = 4 + avgCorr * 4; // 4-8px based on how correlated
          const starColor = holding?.color ?? "#1AA8BB";

          return (
            <g key={ticker}>
              {/* Glow circle */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={starSize + 4}
                fill={starColor}
                opacity={0.15}
                filter="url(#starGlow)"
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ delay: 0.5 + i * 0.05, duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Core star */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={starSize}
                fill={starColor}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Label */}
              <motion.text
                x={pos.x}
                y={pos.y + starSize + 14}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="10"
                fontWeight="500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.05, duration: 0.3 }}
              >
                {ticker}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Pair Card ────────────────────────────────────────────────────────────────

function PairCard({ pair }: { pair: OverlapPair }) {
  const overlapPct = pair.correlation * 100;
  const barColor =
    pair.severity === "danger" ? "bg-rose-500" :
    pair.severity === "warning" ? "bg-amber-500" :
    pair.correlation < -0.2 ? "bg-zinc-500" :
    "bg-emerald-500";
  const textColor =
    pair.severity === "danger" ? "text-rose-400" :
    pair.severity === "warning" ? "text-amber-400" :
    pair.correlation < -0.2 ? "text-zinc-400" :
    "text-emerald-400";

  return (
    <div className="vela-card py-2.5 px-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200">{pair.t1}</span>
          <span className="text-[10px] text-zinc-600">&amp;</span>
          <span className="text-xs font-medium text-zinc-200">{pair.t2}</span>
        </div>
        <span className={`text-sm font-bold tabular ${textColor}`}>
          {overlapPct.toFixed(0)}%
        </span>
      </div>
      {/* Overlap bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.max(Math.abs(overlapPct), 3)}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-500">{pair.explanation}</p>
    </div>
  );
}
