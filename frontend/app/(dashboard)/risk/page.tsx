"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import type { RiskMetrics } from "@/hooks/useRiskMetrics";
import type { Holding } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Eyebrow,
  Prose,
} from "@/components/instrument";

// ── Risk grading ─────────────────────────────────────────────────────

type Grade = "A" | "B" | "C" | "D" | "F";

interface GradeInfo {
  grade: Grade;
  label: string;
  /** Literal Tailwind text class. Never build these dynamically. */
  color: string;
  /** Literal Tailwind background class for the score bar. */
  bar: string;
}

function gradeFromScore(score: number): GradeInfo {
  if (score >= 80) return { grade: "A", label: "Steady", color: "text-gain", bar: "bg-gain" };
  if (score >= 65) return { grade: "B", label: "Contained", color: "text-gain", bar: "bg-gain/70" };
  if (score >= 50) return { grade: "C", label: "Moderate", color: "text-amber-400", bar: "bg-amber-400" };
  if (score >= 35) return { grade: "D", label: "Elevated", color: "text-orange-400", bar: "bg-orange-400" };
  return { grade: "F", label: "Wide", color: "text-loss", bar: "bg-loss" };
}

/** Fill width for the per-metric score bar, keyed off the grade letter. */
function gradeWidth(grade: Grade): number {
  return grade === "A" ? 95 : grade === "B" ? 75 : grade === "C" ? 55 : grade === "D" ? 35 : 15;
}

// ── Metric definitions ───────────────────────────────────────────────

interface MetricDef {
  key: keyof RiskMetrics;
  label: string;
  description: string;
  format: (v: number) => string;
  grade: (v: number) => GradeInfo;
  idealRange: string;
}

const METRICS: MetricDef[] = [
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    description: "Return per unit of volatility taken over the measured period.",
    format: (v) => v.toFixed(2),
    grade: (v) => {
      if (v >= 1.5) return gradeFromScore(90);
      if (v >= 1.0) return gradeFromScore(75);
      if (v >= 0.5) return gradeFromScore(55);
      if (v >= 0) return gradeFromScore(40);
      return gradeFromScore(15);
    },
    idealRange: "> 1.0",
  },
  {
    key: "annualized_volatility",
    label: "Annualized Volatility",
    description: "Standard deviation of returns, annualized. How widely the book swings.",
    format: (v) => `${v.toFixed(1)}%`,
    grade: (v) => {
      // v is already a percentage (e.g., 15.0 = 15%)
      if (v < 10) return gradeFromScore(90);
      if (v < 15) return gradeFromScore(75);
      if (v < 20) return gradeFromScore(55);
      if (v < 30) return gradeFromScore(40);
      return gradeFromScore(15);
    },
    idealRange: "< 15%",
  },
  {
    key: "max_drawdown",
    label: "Max Drawdown",
    description: "Largest peak to trough decline recorded in the period.",
    format: (v) => `${v.toFixed(1)}%`,
    grade: (v) => {
      // v is already a percentage (e.g., -12.3 = -12.3%)
      const abs = Math.abs(v);
      if (abs < 5) return gradeFromScore(90);
      if (abs < 10) return gradeFromScore(75);
      if (abs < 20) return gradeFromScore(55);
      if (abs < 35) return gradeFromScore(40);
      return gradeFromScore(15);
    },
    idealRange: "> -20%",
  },
  {
    key: "beta",
    label: "Portfolio Beta",
    description: "Sensitivity to the broad market. 1.00 moves in line with the index.",
    format: (v) => v.toFixed(2),
    grade: (v) => {
      const diff = Math.abs(v - 1);
      if (diff < 0.15) return gradeFromScore(80);
      if (v < 1 && v > 0.7) return gradeFromScore(85);
      if (v > 1.3) return gradeFromScore(45);
      if (v > 1.5) return gradeFromScore(25);
      return gradeFromScore(60);
    },
    idealRange: "0.7 to 1.2",
  },
];

// ── Concentration analysis ───────────────────────────────────────────

interface ConcentrationResult {
  topHolding: { ticker: string; pct: number } | null;
  top3Pct: number;
  hhi: number; // Herfindahl-Hirschman Index
  grade: GradeInfo;
  warning: string | null;
}

function analyzeConcentration(holdings: Holding[]): ConcentrationResult {
  const total = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  if (total === 0) {
    return { topHolding: null, top3Pct: 0, hhi: 0, grade: gradeFromScore(50), warning: null };
  }

  const weights = holdings
    .map((h) => ({ ticker: h.ticker, pct: ((h.market_value ?? 0) / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const topHolding = weights[0] ?? null;
  const top3Pct = weights.slice(0, 3).reduce((s, w) => s + w.pct, 0);
  const hhi = weights.reduce((s, w) => s + (w.pct / 100) ** 2, 0);

  // Grade based on HHI (lower = more diversified)
  let score: number;
  if (hhi < 0.06) score = 90;
  else if (hhi < 0.10) score = 75;
  else if (hhi < 0.15) score = 55;
  else if (hhi < 0.25) score = 40;
  else score = 20;

  let warning: string | null = null;
  if (topHolding && topHolding.pct > 30) {
    warning = `${topHolding.ticker} accounts for ${topHolding.pct.toFixed(0)}% of the book`;
  } else if (top3Pct > 60) {
    warning = `The three largest positions account for ${top3Pct.toFixed(0)}% of the book`;
  }

  return { topHolding, top3Pct, hhi, grade: gradeFromScore(score), warning };
}

// ── Composite risk score ─────────────────────────────────────────────

function computeOverallScore(risk: RiskMetrics, holdings: Holding[]): number {
  let total = 0;
  let weights = 0;

  // Sharpe (weight 30)
  if (risk.sharpe_ratio != null) {
    const s = risk.sharpe_ratio;
    const score = s >= 1.5 ? 90 : s >= 1 ? 75 : s >= 0.5 ? 55 : s >= 0 ? 40 : 15;
    total += score * 30;
    weights += 30;
  }

  // Volatility (weight 25)
  if (risk.annualized_volatility != null) {
    const v = risk.annualized_volatility;
    const score = v < 0.1 ? 90 : v < 0.15 ? 75 : v < 0.2 ? 55 : v < 0.3 ? 40 : 15;
    total += score * 25;
    weights += 25;
  }

  // Drawdown (weight 25)
  if (risk.max_drawdown != null) {
    const d = Math.abs(risk.max_drawdown);
    const score = d < 0.05 ? 90 : d < 0.1 ? 75 : d < 0.2 ? 55 : d < 0.35 ? 40 : 15;
    total += score * 25;
    weights += 25;
  }

  // Concentration (weight 20)
  const conc = analyzeConcentration(holdings);
  total += (conc.grade.grade === "A" ? 90 : conc.grade.grade === "B" ? 75 : conc.grade.grade === "C" ? 55 : conc.grade.grade === "D" ? 40 : 15) * 20;
  weights += 20;

  return weights > 0 ? Math.round(total / weights) : 50;
}

// ── Observations ─────────────────────────────────────────────────────

interface Observation {
  tone: "gain" | "caution" | "neutral";
  text: string;
}

function generateInsights(risk: RiskMetrics, holdings: Holding[]): Observation[] {
  const insights: Observation[] = [];
  const conc = analyzeConcentration(holdings);

  if (risk.sharpe_ratio != null) {
    if (risk.sharpe_ratio >= 1.0) {
      insights.push({
        tone: "gain",
        text: `Sharpe of ${risk.sharpe_ratio.toFixed(2)} means the period's return was large relative to the volatility recorded alongside it.`,
      });
    } else if (risk.sharpe_ratio < 0.5) {
      insights.push({
        tone: "caution",
        text: "Sharpe below 0.50 means the period's return was small relative to the volatility recorded alongside it.",
      });
    }
  }

  if (risk.annualized_volatility != null) {
    if (risk.annualized_volatility > 25) {
      insights.push({
        tone: "caution",
        text: `Annualized volatility of ${risk.annualized_volatility.toFixed(0)}% sits in the upper band for an equity book. Day to day swings are correspondingly wide.`,
      });
    } else if (risk.annualized_volatility < 12) {
      insights.push({
        tone: "gain",
        text: "Annualized volatility is under 12%, a narrow band for an equity book over this window.",
      });
    }
  }

  if (risk.max_drawdown != null && Math.abs(risk.max_drawdown) > 20) {
    insights.push({
      tone: "caution",
      text: `The deepest peak to trough decline in the period was ${Math.abs(risk.max_drawdown).toFixed(0)}%. That is the size of drop this book has already carried.`,
    });
  }

  if (risk.beta != null) {
    if (risk.beta > 1.3) {
      insights.push({
        tone: "neutral",
        text: `Beta of ${risk.beta.toFixed(2)} means index moves have historically translated into moves about ${((risk.beta - 1) * 100).toFixed(0)}% larger here, in both directions.`,
      });
    } else if (risk.beta < 0.7) {
      insights.push({
        tone: "neutral",
        text: `Beta of ${risk.beta.toFixed(2)} means index moves have historically translated into smaller moves here, in both directions.`,
      });
    }
  }

  if (conc.warning) {
    insights.push({
      tone: "caution",
      text: `${conc.warning}, so the book's outcome is closely tied to that weight.`,
    });
  }

  if (holdings.length < 5) {
    insights.push({
      tone: "caution",
      text: `${holdings.length} position${holdings.length === 1 ? "" : "s"} on the book, so single name moves carry a large share of the result.`,
    });
  } else if (holdings.length >= 15) {
    insights.push({
      tone: "gain",
      text: `${holdings.length} positions on the book, so no single name dominates the weighting by construction.`,
    });
  }

  if (risk.annualized_return != null && risk.annualized_volatility != null) {
    const efficiency = risk.annualized_return / risk.annualized_volatility;
    if (efficiency > 0.8) {
      insights.push({
        tone: "gain",
        text: "Annualized return exceeded 80% of annualized volatility over the window measured.",
      });
    }
  }

  return insights;
}

// ── Composite scale ──────────────────────────────────────────────────

/** Linear 0-100 scale with the composite marked on it. */
function ScoreScale({ score, grade }: { score: number; grade: GradeInfo }) {
  return (
    <div>
      <div className="h-2 w-full border border-vela-border bg-vela-card">
        <div className={`h-full ${grade.bar}`} style={{ width: `${score}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-vela-muted">
        <span>0</span>
        <span>35</span>
        <span>50</span>
        <span>65</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ── Metric row ───────────────────────────────────────────────────────

function MetricRow({ def, value }: { def: MetricDef; value: number | null }) {
  if (value == null) {
    return (
      <div className="py-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <Eyebrow>{def.label}</Eyebrow>
          <span className="font-mono text-[13px] text-vela-muted">insufficient data</span>
        </div>
      </div>
    );
  }

  const grade = def.grade(value);

  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Eyebrow>{def.label}</Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-vela-muted">
          reference {def.idealRange}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-3">
        <span className="font-mono text-xl md:text-[22px] font-semibold tabular-nums leading-none text-zinc-100">
          {def.format(value)}
        </span>
        <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${grade.color}`}>
          {grade.grade} · {grade.label}
        </span>
      </div>

      <div className="mt-2.5 h-1 w-full max-w-[320px] bg-vela-card">
        <div
          className={`h-full ${grade.bar}`}
          style={{ width: `${gradeWidth(grade.grade)}%` }}
        />
      </div>

      <p className="mt-2 text-[13px] leading-[1.55] text-vela-body max-w-[460px]">
        {def.description}
      </p>
    </div>
  );
}

// ── Concentration ────────────────────────────────────────────────────

function WeightBars({ holdings }: { holdings: Holding[] }) {
  const total = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const sorted = [...holdings]
    .map((h) => ({ ticker: h.ticker, pct: total > 0 ? ((h.market_value ?? 0) / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px] max-w-[640px] space-y-2.5">
        {sorted.map((h) => (
          <div key={h.ticker} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[11px] tracking-[0.02em] text-vela-teal">
              {h.ticker}
            </span>
            <div className="h-4 flex-1 border border-vela-border bg-vela-card">
              <div
                className={`h-full ${
                  h.pct > 25 ? "bg-loss/60" : h.pct > 15 ? "bg-amber-400/60" : "bg-vela-teal/35"
                }`}
                style={{ width: `${Math.min(h.pct, 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-vela-body">
              {h.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyRisk() {
  return (
    <div className="mt-8">
      <Panel className="px-6 py-14 text-center">
        <Eyebrow>Not enough history</Eyebrow>
        <Prose className="mx-auto mt-3 max-w-[420px]">
          Risk metrics need a run of daily marks to compute. Record trades on the book and let the
          history build, and volatility, drawdown and beta will land here.
        </Prose>
        <Link
          href="/portfolio"
          className="mt-5 inline-flex items-center gap-1.5 rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5
            font-mono text-[10px] uppercase tracking-wider text-vela-teal
            hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
        >
          Go to positions
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </Panel>
    </div>
  );
}

// ── Cross links ──────────────────────────────────────────────────────

const RELATED = [
  { href: "/correlation", label: "Diversification", desc: "How much the holdings repeat each other" },
  { href: "/stress-index", label: "Stress Index", desc: "Composite reading across the whole picture" },
  { href: "/rebalance", label: "Rebalance", desc: "Drift against your stated target weights" },
];

// ── Main page ────────────────────────────────────────────────────────

export default function RiskDashboardPage() {
  const { portfolio, summary, loading, hasHoldings, error: portfolioError } = useDefaultPortfolio();
  const { data: risk, isLoading: riskLoading, error: riskError } = useRiskMetrics(portfolio?.id);

  const overallScore = useMemo(() => {
    if (!risk || !summary) return null;
    return computeOverallScore(risk, summary.holdings);
  }, [risk, summary]);

  const insights = useMemo(() => {
    if (!risk || !summary) return [];
    return generateInsights(risk, summary.holdings);
  }, [risk, summary]);

  const concentration = useMemo(() => {
    if (!summary) return null;
    return analyzeConcentration(summary.holdings);
  }, [summary]);

  if (loading || riskLoading) return <DashboardSkeleton />;

  if (portfolioError || riskError)
    return <ErrorState message="Failed to load risk metrics." onRetry={() => window.location.reload()} />;

  const noData = !hasHoldings || !risk || risk.data_points < 2;
  const compositeGrade = overallScore != null ? gradeFromScore(overallScore) : null;
  const returnPositive = (risk?.annualized_return ?? 0) >= 0;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Risk" }]}
        note={
          noData
            ? "not enough history yet"
            : `${risk.data_points} daily marks · measured, not forecast`
        }
      />

      <PageHero
        title="Risk"
        meta="Volatility, drawdown and concentration on the book"
        figure={overallScore != null ? String(overallScore) : undefined}
        figureSub={compositeGrade ? `${compositeGrade.grade} · ${compositeGrade.label}` : undefined}
        figureSubClass={compositeGrade ? compositeGrade.color : "text-vela-body"}
      />

      <Prose className="mt-5 max-w-[560px]">
        Four measured metrics plus a concentration reading, folded into one composite out of 100. All
        of it looks backwards at the history on record. None of it is a prediction or a
        recommendation.
      </Prose>

      {noData ? (
        <EmptyRisk />
      ) : (
        <>
          <StatStrip className="mt-6">
            <StatCell
              label="Annualized return"
              value={risk.annualized_return != null ? `${risk.annualized_return.toFixed(1)}%` : "—"}
              valueClass={
                risk.annualized_return == null
                  ? "text-vela-muted"
                  : returnPositive
                    ? "text-gain"
                    : "text-loss"
              }
              sub="over the measured window"
            />
            <StatCell
              label="Volatility"
              value={
                risk.annualized_volatility != null
                  ? `${risk.annualized_volatility.toFixed(1)}%`
                  : "—"
              }
              sub="annualized"
            />
            <StatCell
              label="Max drawdown"
              value={risk.max_drawdown != null ? `${risk.max_drawdown.toFixed(1)}%` : "—"}
              valueClass={risk.max_drawdown != null ? "text-loss" : "text-vela-muted"}
              sub="deepest peak to trough"
            />
            <StatCell
              label="Positions"
              value={String(summary?.holdings.length ?? 0)}
              sub={`${risk.data_points} daily marks`}
            />
          </StatStrip>

          {/* Composite */}
          {overallScore != null && compositeGrade && (
            <Section
              label="Composite"
              prose="One number weighting Sharpe at 30, volatility at 25, drawdown at 25 and concentration at 20. It describes the record, it does not rank the book against anyone else's."
            >
              <div className="max-w-[640px]">
                <ScoreScale score={overallScore} grade={compositeGrade} />
                <Prose className="mt-4">
                  {overallScore >= 70
                    ? "The composite sits in the upper part of its range for this window. Readings move as the underlying history extends."
                    : overallScore >= 50
                      ? "The composite sits mid range for this window. The breakdown below shows which inputs carry it."
                      : "The composite sits in the lower part of its range for this window. The breakdown below shows which inputs carry it."}
                </Prose>
              </div>
            </Section>
          )}

          {/* Metrics */}
          <Section
            label="Metrics"
            prose="Each figure is computed from the daily marks on record. The reference band next to it is a conventional range, not a target set for you."
          >
            <div className="border-y border-vela-border divide-y divide-vela-border">
              {METRICS.map((def) => (
                <MetricRow key={def.key} def={def} value={risk?.[def.key] as number | null} />
              ))}
            </div>
          </Section>

          {/* Concentration */}
          {summary && concentration && (
            <Section
              label="Concentration"
              labelAside={`grade ${concentration.grade.grade}`}
              prose="How the book's value is spread across names. The Herfindahl index squares every weight and sums them, so a single dominant position pushes it up sharply."
            >
              <WeightBars holdings={summary.holdings} />

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 border-t border-vela-border pt-4">
                <div className="min-w-0">
                  <Eyebrow>Top holding</Eyebrow>
                  <p className="mt-1.5 font-mono text-[15px] tabular-nums text-zinc-100 truncate">
                    {concentration.topHolding
                      ? `${concentration.topHolding.ticker} ${concentration.topHolding.pct.toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <Eyebrow>Top three</Eyebrow>
                  <p className="mt-1.5 font-mono text-[15px] tabular-nums text-zinc-100">
                    {concentration.top3Pct.toFixed(0)}%
                  </p>
                </div>
                <div className="min-w-0">
                  <Eyebrow>HHI</Eyebrow>
                  <p className="mt-1.5 font-mono text-[15px] tabular-nums text-zinc-100">
                    {(concentration.hhi * 10000).toFixed(0)}
                  </p>
                </div>
                <div className="min-w-0">
                  <Eyebrow>Positions</Eyebrow>
                  <p className="mt-1.5 font-mono text-[15px] tabular-nums text-zinc-100">
                    {summary.holdings.length}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Observations */}
          <Section
            label="Observations"
            prose="Plain readings of the figures above. Descriptive only, with no view on what any position should do next."
          >
            {insights.length === 0 ? (
              <p className="font-mono text-[11px] text-vela-muted">
                Not enough history for observations yet.
              </p>
            ) : (
              <div className="border-y border-vela-border divide-y divide-vela-border max-w-[720px]">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className={`mt-[5px] w-[7px] h-[7px] rotate-45 shrink-0 ${
                        ins.tone === "gain"
                          ? "bg-gain"
                          : ins.tone === "caution"
                            ? "bg-amber-400"
                            : "bg-vela-teal"
                      }`}
                    />
                    <p className="text-[13.5px] leading-[1.55] text-vela-body">{ins.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Related */}
          <Section label="Elsewhere">
            <div className="border-y border-vela-border divide-y divide-vela-border">
              {RELATED.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-4 py-3.5 transition-colors"
                >
                  <span className="w-40 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted group-hover:text-vela-teal transition-colors">
                    {link.label}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] text-vela-body truncate">
                    {link.desc}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-vela-muted group-hover:text-vela-teal transition-colors" />
                </Link>
              ))}
            </div>
          </Section>

          <p className="mt-8 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
            Metrics are computed from the price history on record and describe what already happened.
            They carry no view on any individual holding and are not investment advice.
          </p>
        </>
      )}
    </PageTransition>
  );
}
