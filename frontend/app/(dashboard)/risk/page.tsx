"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  TrendingDown,
  Activity,
  Gauge,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import type { RiskMetrics } from "@/hooks/useRiskMetrics";
import type { Holding } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

// ── Risk grading ─────────────────────────────────────────────────────

type Grade = "A" | "B" | "C" | "D" | "F";

interface GradeInfo {
  grade: Grade;
  label: string;
  color: string;
  bg: string;
}

function gradeFromScore(score: number): GradeInfo {
  if (score >= 80) return { grade: "A", label: "Excellent", color: "text-gain", bg: "bg-gain/15" };
  if (score >= 65) return { grade: "B", label: "Good", color: "text-teal-400", bg: "bg-teal-400/15" };
  if (score >= 50) return { grade: "C", label: "Moderate", color: "text-amber-400", bg: "bg-amber-400/15" };
  if (score >= 35) return { grade: "D", label: "Elevated", color: "text-orange-400", bg: "bg-orange-400/15" };
  return { grade: "F", label: "High Risk", color: "text-loss", bg: "bg-loss/15" };
}

// ── Metric definitions ───────────────────────────────────────────────

interface MetricDef {
  key: keyof RiskMetrics;
  label: string;
  description: string;
  format: (v: number) => string;
  grade: (v: number) => GradeInfo;
  icon: typeof Shield;
  idealRange: string;
}

const METRICS: MetricDef[] = [
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    description: "Risk-adjusted return  - higher means better returns per unit of risk taken",
    format: (v) => v.toFixed(2),
    grade: (v) => {
      if (v >= 1.5) return gradeFromScore(90);
      if (v >= 1.0) return gradeFromScore(75);
      if (v >= 0.5) return gradeFromScore(55);
      if (v >= 0) return gradeFromScore(40);
      return gradeFromScore(15);
    },
    icon: Gauge,
    idealRange: "> 1.0",
  },
  {
    key: "annualized_volatility",
    label: "Annualized Volatility",
    description: "Standard deviation of returns  - measures how much your portfolio swings",
    format: (v) => `${v.toFixed(1)}%`,
    grade: (v) => {
      // v is already a percentage (e.g., 15.0 = 15%)
      if (v < 10) return gradeFromScore(90);
      if (v < 15) return gradeFromScore(75);
      if (v < 20) return gradeFromScore(55);
      if (v < 30) return gradeFromScore(40);
      return gradeFromScore(15);
    },
    icon: Activity,
    idealRange: "< 15%",
  },
  {
    key: "max_drawdown",
    label: "Max Drawdown",
    description: "Largest peak-to-trough decline  - the worst loss from a high point",
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
    icon: TrendingDown,
    idealRange: "> -20%",
  },
  {
    key: "beta",
    label: "Portfolio Beta",
    description: "Sensitivity to market movements  - 1.0 = moves like the market",
    format: (v) => v.toFixed(2),
    grade: (v) => {
      const diff = Math.abs(v - 1);
      if (diff < 0.15) return gradeFromScore(80);
      if (v < 1 && v > 0.7) return gradeFromScore(85);
      if (v > 1.3) return gradeFromScore(45);
      if (v > 1.5) return gradeFromScore(25);
      return gradeFromScore(60);
    },
    icon: Zap,
    idealRange: "0.7 – 1.2",
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
    warning = `${topHolding.ticker} represents ${topHolding.pct.toFixed(0)}% of your portfolio`;
  } else if (top3Pct > 60) {
    warning = `Top 3 holdings make up ${top3Pct.toFixed(0)}% of your portfolio`;
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

// ── Insights engine ──────────────────────────────────────────────────

interface Insight {
  type: "success" | "warning" | "info";
  text: string;
}

function generateInsights(risk: RiskMetrics, holdings: Holding[]): Insight[] {
  const insights: Insight[] = [];
  const conc = analyzeConcentration(holdings);

  if (risk.sharpe_ratio != null) {
    if (risk.sharpe_ratio >= 1.0) {
      insights.push({ type: "success", text: `Your risk-adjusted returns are strong  - Sharpe of ${risk.sharpe_ratio.toFixed(2)} indicates efficient risk usage.` });
    } else if (risk.sharpe_ratio < 0.5) {
      insights.push({ type: "warning", text: "Low Sharpe ratio suggests you're not being adequately compensated for the risk you're taking." });
    }
  }

  if (risk.annualized_volatility != null) {
    if (risk.annualized_volatility > 25) {
      insights.push({ type: "warning", text: `Volatility of ${risk.annualized_volatility.toFixed(0)}% is high  - consider adding lower-volatility assets like bonds or dividend stocks.` });
    } else if (risk.annualized_volatility < 12) {
      insights.push({ type: "success", text: "Your portfolio has low volatility  - smooth sailing through market turbulence." });
    }
  }

  if (risk.max_drawdown != null && Math.abs(risk.max_drawdown) > 20) {
    insights.push({ type: "warning", text: `Your worst drawdown was ${Math.abs(risk.max_drawdown).toFixed(0)}%  - make sure you can tolerate this level of decline psychologically and financially.` });
  }

  if (risk.beta != null) {
    if (risk.beta > 1.3) {
      insights.push({ type: "info", text: `Your portfolio amplifies market moves by ${((risk.beta - 1) * 100).toFixed(0)}%  - it will fall harder in downturns.` });
    } else if (risk.beta < 0.7) {
      insights.push({ type: "info", text: "Low beta means your portfolio is defensive  - it won't keep pace in strong bull markets but offers downside protection." });
    }
  }

  if (conc.warning) {
    insights.push({ type: "warning", text: conc.warning + ". Consider rebalancing to reduce single-stock risk." });
  }

  if (holdings.length < 5) {
    insights.push({ type: "warning", text: `Only ${holdings.length} holding${holdings.length === 1 ? "" : "s"}  - consider diversifying across more positions.` });
  } else if (holdings.length >= 15) {
    insights.push({ type: "success", text: `Well-diversified across ${holdings.length} positions.` });
  }

  if (risk.annualized_return != null && risk.annualized_volatility != null) {
    const efficiency = risk.annualized_return / risk.annualized_volatility;
    if (efficiency > 0.8) {
      insights.push({ type: "success", text: "Your return-to-volatility ratio is efficient  - you're getting strong returns relative to the risk." });
    }
  }

  return insights;
}

// ── Gauge component ──────────────────────────────────────────────────

function RiskGauge({ score, size = "lg" }: { score: number; size?: "lg" | "sm" }) {
  const grade = gradeFromScore(score);
  const isLg = size === "lg";
  const radius = isLg ? 70 : 40;
  const strokeWidth = isLg ? 10 : 6;
  const cx = isLg ? 90 : 50;
  const cy = isLg ? 85 : 48;
  const svgW = isLg ? 180 : 100;
  const svgH = isLg ? 100 : 60;
  const circumference = Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgb(39, 39, 42)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="currentColor"
          className={grade.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
        <text
          x={cx}
          y={cy - (isLg ? 16 : 8)}
          textAnchor="middle"
          className="fill-zinc-100 font-bold"
          style={{ fontSize: isLg ? 36 : 20 }}
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy + (isLg ? 4 : 4)}
          textAnchor="middle"
          className="fill-zinc-500"
          style={{ fontSize: isLg ? 11 : 9 }}
        >
          / 100
        </text>
      </svg>
      <div className={`text-center mt-1 ${isLg ? "text-sm" : "text-xs"}`}>
        <span className={`font-semibold ${grade.color}`}>{grade.label}</span>
      </div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────

function MetricCard({ def, value }: { def: MetricDef; value: number | null }) {
  if (value == null) {
    return (
      <div className="vela-card opacity-50">
        <div className="flex items-center gap-2 mb-3">
          <def.icon className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-400">{def.label}</span>
        </div>
        <p className="text-xs text-zinc-600">Insufficient data</p>
      </div>
    );
  }

  const grade = def.grade(value);
  const Icon = def.icon;

  return (
    <div className="vela-card group hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${grade.bg}`}>
            <Icon className={`w-4 h-4 ${grade.color}`} />
          </div>
          <span className="text-sm font-medium text-zinc-300">{def.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${grade.bg} ${grade.color}`}>
          {grade.grade}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-display font-bold text-zinc-100 tabular-nums">
          {def.format(value)}
        </span>
        <span className="text-xs text-zinc-600">ideal {def.idealRange}</span>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">{def.description}</p>

      {/* Score bar */}
      <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${
            grade.grade === "A" ? "bg-gain" :
            grade.grade === "B" ? "bg-teal-400" :
            grade.grade === "C" ? "bg-amber-400" :
            grade.grade === "D" ? "bg-orange-400" :
            "bg-loss"
          }`}
          style={{
            width: `${
              grade.grade === "A" ? 95 :
              grade.grade === "B" ? 75 :
              grade.grade === "C" ? 55 :
              grade.grade === "D" ? 35 :
              15
            }%`,
          }}
        />
      </div>
    </div>
  );
}

// ── Concentration card ───────────────────────────────────────────────

function ConcentrationCard({ holdings }: { holdings: Holding[] }) {
  const total = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const sorted = [...holdings]
    .map((h) => ({ ticker: h.ticker, pct: total > 0 ? ((h.market_value ?? 0) / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  const conc = analyzeConcentration(holdings);

  return (
    <div className="vela-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${conc.grade.bg}`}>
            <Shield className={`w-4 h-4 ${conc.grade.color}`} />
          </div>
          <span className="text-sm font-medium text-zinc-300">Concentration Risk</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${conc.grade.bg} ${conc.grade.color}`}>
          {conc.grade.grade}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {sorted.map((h) => (
          <div key={h.ticker} className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400 w-12 shrink-0">{h.ticker}</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  h.pct > 25 ? "bg-loss" : h.pct > 15 ? "bg-amber-400" : "bg-teal-500"
                }`}
                style={{ width: `${Math.min(h.pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 tabular-nums w-12 text-right">{h.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">Top holding</p>
          <p className="text-sm font-medium text-zinc-200 tabular-nums">
            {conc.topHolding ? `${conc.topHolding.ticker} (${conc.topHolding.pct.toFixed(0)}%)` : " -"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Top 3 concentration</p>
          <p className="text-sm font-medium text-zinc-200 tabular-nums">{conc.top3Pct.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">HHI score</p>
          <p className="text-sm font-medium text-zinc-200 tabular-nums">{(conc.hhi * 10000).toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Positions</p>
          <p className="text-sm font-medium text-zinc-200 tabular-nums">{holdings.length}</p>
        </div>
      </div>
    </div>
  );
}

// ── Insight card ─────────────────────────────────────────────────────

const INSIGHT_ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const INSIGHT_COLORS = {
  success: "text-gain border-gain/20 bg-gain/5",
  warning: "text-amber-400 border-amber-400/20 bg-amber-400/5",
  info: "text-teal-400 border-teal-400/20 bg-teal-400/5",
};

// ── Empty state ──────────────────────────────────────────────────────

function EmptyRisk() {
  return (
    <div className="vela-card text-center py-16 space-y-4">
      <Shield className="w-12 h-12 text-zinc-700 mx-auto" />
      <div>
        <h2 className="text-lg font-medium text-zinc-300">No risk data yet</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
          Add trades to your portfolio and accumulate some history. Risk metrics need at least 30 days of data.
        </p>
      </div>
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-2 btn-primary text-sm"
      >
        Go to Portfolio <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

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

  if (portfolioError || riskError) return <ErrorState message="Failed to load risk metrics." onRetry={() => window.location.reload()} />;

  const noData = !hasHoldings || !risk || risk.data_points < 2;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Risk Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Understand the risk profile of your portfolio
        </p>
      </div>

      {noData ? (
        <EmptyRisk />
      ) : (
        <>
          {/* Hero  - Overall Score + Annualized Return */}
          <FloatingCard glowColor="rgba(12, 181, 201, 0.12)" tilt={false}>
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 py-2">
              {overallScore != null && <RiskGauge score={overallScore} />}

              <div className="flex-1 text-center sm:text-left space-y-3">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Risk-Adjusted Profile</p>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                    {overallScore != null && overallScore >= 70
                      ? "Your portfolio is well-managed from a risk perspective. Keep monitoring as conditions change."
                      : overallScore != null && overallScore >= 50
                      ? "Your risk profile is moderate. Consider optimizing concentration or adding hedges."
                      : "Your portfolio has elevated risk. Review the metrics below for specific areas to improve."}
                  </p>
                </div>

                {risk?.annualized_return != null && (
                  <div className="flex items-center gap-6 justify-center sm:justify-start">
                    <div>
                      <p className="text-xs text-zinc-500">Annualized Return</p>
                      <p className={`text-lg font-display font-bold tabular-nums ${risk.annualized_return >= 0 ? "text-gain" : "text-loss"}`}>
                        {risk.annualized_return.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Data Points</p>
                      <p className="text-lg font-display font-bold tabular-nums text-zinc-200">
                        {risk.data_points}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FloatingCard>

          {/* Metric cards grid */}
          <RevealOnScroll>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRICS.map((def) => (
                <MetricCard key={def.key} def={def} value={risk?.[def.key] as number | null} />
              ))}
            </div>
          </RevealOnScroll>

          {/* Concentration + Insights */}
          <RevealOnScroll delay={0.05}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Concentration  - takes 3 cols */}
              <div className="lg:col-span-3">
                {summary && <ConcentrationCard holdings={summary.holdings} />}
              </div>

              {/* Insights  - takes 2 cols */}
              <div className="lg:col-span-2 space-y-3">
                <h2 className="section-heading">Insights</h2>
                {insights.length === 0 ? (
                  <p className="text-xs text-zinc-600">Not enough data for insights yet.</p>
                ) : (
                  insights.map((ins, i) => {
                    const Icon = INSIGHT_ICONS[ins.type];
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg border ${INSIGHT_COLORS[ins.type]}`}>
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-zinc-300">{ins.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </RevealOnScroll>

          {/* Cross-links */}
          <RevealOnScroll delay={0.1}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { href: "/correlation", label: "Diversification", desc: "Correlation matrix & diversity grade", icon: Activity },
                { href: "/stress-index", label: "Stress Index", desc: "Overall financial health score", icon: Gauge },
                { href: "/rebalance", label: "Rebalance", desc: "Target allocation optimizer", icon: Shield },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="vela-card group hover:border-zinc-600 transition-colors flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-vela-teal/10 transition-colors">
                    <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-vela-teal transition-colors" />
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
