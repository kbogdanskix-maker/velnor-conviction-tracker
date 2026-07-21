"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useCorrelation } from "@/hooks/useCorrelation";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  PillGroup,
  Legend,
  Eyebrow,
  Prose,
} from "@/components/instrument";

// ── Types & Helpers ─────────────────────────────────────────────────────────

type PeriodKey = "3mo" | "6mo" | "1y" | "2y" | "5y";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "5y", label: "5Y" },
];

const PERIOD_WORDS: Record<PeriodKey, string> = {
  "3mo": "3-month",
  "6mo": "6-month",
  "1y": "1-year",
  "2y": "2-year",
  "5y": "5-year",
};

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
  /** Literal Tailwind text class. Never assembled at runtime. */
  color: string;
}

function computeDivScore(avgCorr: number, highPairs: number, negativePairs: number, totalPairs: number): DivScore {
  // Score: 100 = perfectly diversified, 0 = all identical
  // Penalize high average correlation, reward negative correlations
  let score = 100;
  score -= avgCorr * 60; // avg corr of 1.0 = -60 points
  score -= (highPairs / Math.max(totalPairs, 1)) * 30; // high-corr pairs penalty
  score += Math.min(negativePairs * 5, 15); // bonus for negative correlations (max +15)
  score = Math.max(0, Math.min(100, score));

  if (score >= 80)
    return {
      grade: "A",
      score,
      summary: "Holdings have moved largely independently of one another over this window.",
      color: "text-gain",
    };
  if (score >= 65)
    return {
      grade: "B",
      score,
      summary: "Most holdings moved independently, with a few pairs tracking each other closely.",
      color: "text-gain",
    };
  if (score >= 50)
    return {
      grade: "C",
      score,
      summary: "Several holdings moved together over this window, so their return paths repeat.",
      color: "text-amber-400",
    };
  if (score >= 35)
    return {
      grade: "D",
      score,
      summary:
        "Most pairs moved together over this window, so a broad move in the group reached most of the book at once.",
      color: "text-orange-400",
    };
  return {
    grade: "F",
    score,
    summary:
      "The book behaved close to a single position over this window. One shared move reached nearly everything.",
    color: "text-loss",
  };
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
          ? `These ${group.length} names moved closely together over the window, so their return paths largely repeat.`
          : "These two names moved in the same direction over the window.",
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
        explanation = "Nearly identical movement. The two return paths repeat each other.";
      } else if (corr >= 0.7) {
        severity = "warning";
        explanation = "Strong overlap. These two typically rose and fell together over the window.";
      } else {
        severity = "ok";
        explanation = corr < -0.2
          ? "These two moved in opposite directions over the window."
          : "Low overlap. Their return paths were largely independent over the window.";
      }

      pairs.push({ t1: tickers[i], t2: tickers[j], correlation: corr, severity, explanation });
    }
  }
  // Show most concerning first
  pairs.sort((a, b) => b.correlation - a.correlation);
  return pairs;
}

/** Neutral readings of what the overlap figures describe. No instruments named, no actions implied. */
function getSuggestions(avgCorr: number, clusters: RiskCluster[], negPairs: number): string[] {
  const tips: string[] = [];

  if (avgCorr > 0.6) {
    tips.push("Average pairwise overlap sits above 0.60. Overlap at that level generally reflects shared return drivers across the names held, for example a common sector, factor or currency exposure.");
  }
  if (clusters.length > 0) {
    tips.push("Tightly correlated groups appear above. Inside a cluster the names contributed a similar return path over the window rather than distinct ones.");
  }
  if (avgCorr > 0.4 && negPairs === 0) {
    tips.push("No pair in the book showed negative overlap over this window. Negative overlap arises where return drivers differ, which is more common between asset classes than between names inside one of them.");
  }
  if (avgCorr > 0.3) {
    tips.push("Overlap is measured on daily returns and is not fixed. Correlations across equities have historically risen during broad selloffs, so a calm-period reading is usually the lower one.");
  }
  if (tips.length === 0) {
    tips.push("Overlap across this book is low for the window measured. Correlations shift over time and have historically risen during broad selloffs.");
  }
  return tips.slice(0, 3);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CorrelationPage() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = (summary?.holdings?.length ?? 0) >= 2;

  const [period, setPeriod] = useState<PeriodKey>("1y");
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

  const periodControl = hasHoldings ? (
    <PillGroup
      options={PERIODS}
      value={period}
      onChange={setPeriod}
      ariaLabel="Measurement window"
    />
  ) : null;

  return (
    <TierGate requiredTier="navigator">
      <PageTransition>
        <TopBar
          trail={[{ label: "Lab" }, { label: "Diversification" }]}
          note={
            analysis
              ? `${correlation?.tickers.length ?? 0} holdings · ${PERIOD_WORDS[period]} daily returns`
              : "needs at least two holdings"
          }
        />

        <PageHero
          title="Diversification"
          meta="How much your holdings repeat one another"
          figure={analysis ? analysis.divScore.score.toFixed(0) : undefined}
          figureSub={analysis ? `grade ${analysis.divScore.grade} · out of 100` : undefined}
          figureSubClass={analysis ? analysis.divScore.color : "text-vela-body"}
        />

        <Prose className="mt-5 max-w-[560px]">
          Overlap is the correlation of daily returns between two holdings. A high reading means the
          two price paths repeated each other over the window. This page describes what the returns
          did, not what any position should do next.
        </Prose>

        {hasHoldings && <div className="mt-6">{periodControl}</div>}

        {error ? (
          <div className="mt-8">
            <ErrorState
              message="Failed to load correlation data."
              onRetry={() => window.location.reload()}
            />
          </div>
        ) : loading ? (
          <div className="mt-8 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 border border-vela-border bg-vela-card animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="mt-8">
            <Panel className="px-6 py-14 text-center">
              <Eyebrow>Needs at least two holdings</Eyebrow>
              <Prose className="mx-auto mt-3 max-w-[400px]">
                Overlap is measured between pairs, so a second position has to be on the book before
                anything can be computed here.
              </Prose>
            </Panel>
          </div>
        ) : analysis ? (
          <>
            <StatStrip className="mt-6">
              <StatCell
                label="Average overlap"
                value={analysis.avgCorr.toFixed(2)}
                valueClass={analysis.avgCorr > 0.5 ? "text-amber-400" : "text-gain"}
                sub="across every pair"
              />
              <StatCell
                label="Overlap above 0.70"
                value={String(analysis.highPairs)}
                valueClass={analysis.highPairs > 0 ? "text-amber-400" : "text-zinc-100"}
                sub={analysis.highPairs === 1 ? "pair" : "pairs"}
              />
              <StatCell
                label="Opposite moving"
                value={String(analysis.negativePairs)}
                sub="pairs below -0.20"
              />
              <StatCell
                label="Window"
                value={PERIOD_WORDS[period].replace("-", " ")}
                sub="daily returns"
              />
            </StatStrip>

            <Section
              label="Score"
              prose="The score starts at 100 and is reduced by average overlap and by the share of pairs above 0.70, then credited for pairs that move in opposite directions."
            >
              <Panel className="px-5 py-4 max-w-[640px]">
                <div className="flex items-baseline gap-3">
                  <span
                    className={`font-display text-[34px] font-bold leading-none ${analysis.divScore.color}`}
                  >
                    {analysis.divScore.grade}
                  </span>
                  <span className="font-mono text-[15px] tabular-nums text-zinc-100">
                    {analysis.divScore.score.toFixed(0)} / 100
                  </span>
                </div>
                <Prose className="mt-3">{analysis.divScore.summary}</Prose>
              </Panel>
            </Section>

            {/* Clusters */}
            {analysis.clusters.length > 0 && (
              <Section
                label="Clusters"
                prose="Groups where every pairwise overlap sits at 0.60 or above. Inside a group the return paths largely repeat."
              >
                <div className="border-y border-vela-border divide-y divide-vela-border max-w-[720px]">
                  {analysis.clusters.map((cluster, i) => (
                    <div key={i} className="py-3.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-[13px] tracking-[0.02em] text-vela-teal">
                          {cluster.tickers.join(" · ")}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-vela-muted">
                          avg {(cluster.avgCorrelation * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.55] text-vela-body">
                        {cluster.label}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Pairs */}
            <Section
              label="Pairs"
              prose="Every combination of two holdings, ranked by how closely their daily returns tracked each other."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
                <div>
                  <Eyebrow>Highest overlap</Eyebrow>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-vela-body">
                    The pairs whose returns tracked each other most closely over the window.
                  </p>
                  <div className="mt-3 border-y border-vela-border divide-y divide-vela-border">
                    {analysis.pairs
                      .filter((p) => p.severity !== "ok")
                      .slice(0, 5)
                      .map((p) => (
                        <PairRow key={`${p.t1}-${p.t2}`} pair={p} />
                      ))}
                    {analysis.pairs.filter((p) => p.severity !== "ok").length === 0 && (
                      <p className="py-4 font-mono text-[11px] text-vela-muted">
                        No pair reached 0.70 over this window.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Eyebrow>Lowest overlap</Eyebrow>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-vela-body">
                    The pairs whose returns tracked each other least closely. Negative values mean
                    they moved in opposite directions.
                  </p>
                  <div className="mt-3 border-y border-vela-border divide-y divide-vela-border">
                    {analysis.pairs
                      .slice()
                      .sort((a, b) => a.correlation - b.correlation)
                      .slice(0, 5)
                      .map((p) => (
                        <PairRow key={`low-${p.t1}-${p.t2}`} pair={p} />
                      ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Constellation map */}
            {correlation && correlation.tickers.length >= 3 && (
              <Section
                label="Map"
                prose="Each holding is a node on the ring. A line is drawn where overlap reaches 0.40, and it thickens at 0.70."
              >
                <ConstellationViz
                  tickers={correlation.tickers}
                  matrix={correlation.matrix}
                  holdingAvgs={analysis.holdingAvgs}
                />
                <Legend
                  items={[
                    {
                      glyph: <span aria-hidden="true" className="inline-block w-4 h-px bg-[#f59e0b]" />,
                      label: "overlap 0.40 to 0.70",
                    },
                    {
                      glyph: <span aria-hidden="true" className="inline-block w-4 h-[2px] bg-[#ef4444]" />,
                      label: "overlap above 0.70",
                    },
                  ]}
                  hint="node size tracks average overlap"
                />
              </Section>
            )}

            {/* Per-holding bar chart */}
            {analysis.holdingAvgs.length > 0 && (
              <Section
                label="By holding"
                prose="Each name's average overlap with the rest of the book. Taller bars mean that name's daily returns tracked the others more closely."
              >
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.holdingAvgs} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="ticker"
                        tick={{ fill: "#8A97AC", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[-0.2, 1]}
                        tick={{ fill: "#8A97AC", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                        width={40}
                      />
                      <Tooltip cursor={false}
                        contentStyle={{ backgroundColor: "#0B1322", border: "1px solid #1B2638", borderRadius: 4, fontSize: 12, color: "#EAEEF5" }}
                        itemStyle={{ color: "#EAEEF5" }}
                        labelStyle={{ color: "#AEB9CC" }}
                        formatter={(val: number) => [`${(val * 100).toFixed(1)}% avg overlap`, "Overlap"]}
                      />
                      <Bar dataKey="avg" radius={[2, 2, 0, 0]}>
                        {analysis.holdingAvgs.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Legend
                  items={[
                    {
                      glyph: <span aria-hidden="true" className="inline-block w-2.5 h-2.5 bg-[#34d399]" />,
                      label: "under 0.40",
                    },
                    {
                      glyph: <span aria-hidden="true" className="inline-block w-2.5 h-2.5 bg-[#f59e0b]" />,
                      label: "0.40 to 0.60",
                    },
                    {
                      glyph: <span aria-hidden="true" className="inline-block w-2.5 h-2.5 bg-[#ef4444]" />,
                      label: "above 0.60",
                    },
                  ]}
                />
              </Section>
            )}

            {/* Reading notes */}
            <Section
              label="What the reading describes"
              prose="Context on the figures above. Observational only, with no view on any individual holding."
            >
              <div className="border-y border-vela-border divide-y divide-vela-border max-w-[720px]">
                {analysis.suggestions.map((tip, i) => (
                  <div key={i} className="flex gap-3 py-3">
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-vela-muted pt-[3px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13.5px] leading-[1.55] text-vela-body">{tip}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Definitions */}
            <Section label="Definitions">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 max-w-[820px]">
                <div>
                  <Eyebrow>Diversification</Eyebrow>
                  <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                    When holdings do not all move together, a weak day for one name can coincide with
                    a strong day for another. The less the price paths repeat, the narrower the swing
                    in the combined book.
                  </p>
                </div>
                <div>
                  <Eyebrow>Overlap</Eyebrow>
                  <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                    The correlation of two holdings&apos; daily returns, shown here as a percentage.
                    0% is fully independent movement, 100% is identical movement. Readings above 70%
                    mean the two return paths are close to interchangeable.
                  </p>
                </div>
              </div>
            </Section>

            <p className="mt-8 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
              Computed from {PERIOD_WORDS[period]} daily returns. Correlations are not stable and have
              historically risen during market stress. Descriptive only, not investment advice.
            </p>
          </>
        ) : null}
      </PageTransition>
    </TierGate>
  );
}

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

  // Map avg correlation to node size
  const avgMap = new Map(holdingAvgs.map((h) => [h.ticker, h]));

  return (
    <div className="border border-vela-border px-2 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-80" preserveAspectRatio="xMidYMid meet">
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

        {/* Nodes */}
        {tickers.map((ticker, i) => {
          const pos = positions[i];
          const holding = avgMap.get(ticker);
          const avgCorr = holding?.avg ?? 0;
          const nodeSize = 4 + avgCorr * 4; // 4-8px based on average overlap
          const nodeColor = holding?.color ?? "#1AA8BB";

          return (
            <g key={ticker}>
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={nodeSize}
                fill={nodeColor}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.text
                x={pos.x}
                y={pos.y + nodeSize + 14}
                textAnchor="middle"
                fill="#AEB9CC"
                fontSize="10"
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

// ── Pair row ─────────────────────────────────────────────────────────────────

function PairRow({ pair }: { pair: OverlapPair }) {
  const overlapPct = pair.correlation * 100;
  const barClass =
    pair.severity === "danger" ? "bg-loss/60" :
    pair.severity === "warning" ? "bg-amber-400/60" :
    pair.correlation < -0.2 ? "bg-vela-teal/40" :
    "bg-gain/50";
  const textClass =
    pair.severity === "danger" ? "text-loss" :
    pair.severity === "warning" ? "text-amber-400" :
    pair.correlation < -0.2 ? "text-vela-teal" :
    "text-gain";

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[13px] tracking-[0.02em] text-zinc-100">
          {pair.t1} <span className="text-vela-muted">/</span> {pair.t2}
        </span>
        <span className={`shrink-0 font-mono text-[13px] tabular-nums ${textClass}`}>
          {overlapPct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full bg-vela-card">
        <div
          className={`h-full ${barClass}`}
          style={{ width: `${Math.max(Math.abs(overlapPct), 3)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-vela-body">{pair.explanation}</p>
    </div>
  );
}
