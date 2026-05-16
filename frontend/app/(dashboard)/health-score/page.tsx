"use client";

import { useMemo } from "react";
import {
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  Wallet,
  PiggyBank,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Score helpers ─────────────────────────────────────────────────────

interface Dimension {
  key: string;
  label: string;
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  insight: string;
  link: string;
  linkLabel: string;
}

function toGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-teal-400",
  C: "text-amber-400",
  D: "text-orange-400",
  F: "text-rose-400",
};

const GRADE_BG: Record<string, string> = {
  A: "from-emerald-500/20 to-emerald-500/5",
  B: "from-teal-500/20 to-teal-500/5",
  C: "from-amber-500/20 to-amber-500/5",
  D: "from-orange-500/20 to-orange-500/5",
  F: "from-rose-500/20 to-rose-500/5",
};

const GRADE_RING: Record<string, string> = {
  A: "stroke-emerald-400",
  B: "stroke-teal-400",
  C: "stroke-amber-400",
  D: "stroke-orange-400",
  F: "stroke-rose-400",
};

// ── Score computation ─────────────────────────────────────────────────

function computeHealthScore(
  portfolio: { total_value: number; holdings: { unrealized_pnl_pct: number | null; sector?: string }[] } | null,
  netWorth: { net_worth: number; total_assets: number; total_liabilities: number } | null,
  cashFlow: { total_income: number; total_expenses: number; savings_rate: number | null } | null,
  goals: { target_amount: number; current_amount: number }[] | null,
  risk: { annualized_volatility: number | null; max_drawdown: number | null; sharpe_ratio: number | null } | null,
): Dimension[] {
  const dims: Dimension[] = [];

  // 1. Portfolio Diversification (0-100)
  let divScore = 50; // default if no portfolio
  let divInsight = "Add holdings to measure diversification.";
  if (portfolio && portfolio.holdings.length > 0) {
    const sectors = new Set(portfolio.holdings.map((h) => h.sector || "Other"));
    const holdingCount = portfolio.holdings.length;
    // More holdings + more sectors = better
    const holdingPts = Math.min(holdingCount / 20, 1) * 40; // up to 40 pts for 20+ holdings
    const sectorPts = Math.min(sectors.size / 8, 1) * 40; // up to 40 pts for 8+ sectors
    const basePts = holdingCount >= 3 ? 20 : holdingCount * 7; // 20 base pts for having a real portfolio
    divScore = Math.min(100, Math.round(holdingPts + sectorPts + basePts));

    if (sectors.size <= 2) divInsight = `Only ${sectors.size} sector${sectors.size === 1 ? "" : "s"} — consider diversifying across more industries.`;
    else if (holdingCount < 5) divInsight = `${holdingCount} holdings across ${sectors.size} sectors — adding more positions would improve resilience.`;
    else divInsight = `${holdingCount} holdings across ${sectors.size} sectors — well diversified.`;
  }
  dims.push({
    key: "diversification",
    label: "Diversification",
    score: divScore,
    grade: toGrade(divScore),
    icon: ShieldCheck,
    color: "teal",
    insight: divInsight,
    link: "/correlation",
    linkLabel: "View Diversification",
  });

  // 2. Savings & Cash Flow (0-100)
  let savScore = 50;
  let savInsight = "Set up cash flow tracking to measure your savings health.";
  if (cashFlow && cashFlow.total_income > 0) {
    const rate = cashFlow.savings_rate ?? ((cashFlow.total_income - cashFlow.total_expenses) / cashFlow.total_income) * 100;
    if (rate >= 30) savScore = 95;
    else if (rate >= 20) savScore = 80;
    else if (rate >= 10) savScore = 65;
    else if (rate >= 0) savScore = 40;
    else savScore = 15;

    if (rate >= 20) savInsight = `${rate.toFixed(0)}% savings rate — excellent. You're well above the recommended 20%.`;
    else if (rate >= 10) savInsight = `${rate.toFixed(0)}% savings rate — good, but aim for 20%+ to accelerate wealth building.`;
    else if (rate >= 0) savInsight = `${rate.toFixed(0)}% savings rate — below the 20% target. Review expenses for reduction opportunities.`;
    else savInsight = `Negative savings rate — expenses exceed income. This needs immediate attention.`;
  }
  dims.push({
    key: "savings",
    label: "Savings Rate",
    score: savScore,
    grade: toGrade(savScore),
    icon: PiggyBank,
    color: "emerald",
    insight: savInsight,
    link: "/cash-flow",
    linkLabel: "View Cash Flow",
  });

  // 3. Debt Health (0-100)
  let debtScore = 80; // default if no debt info
  let debtInsight = "Track your net worth to monitor debt health.";
  if (netWorth) {
    const debtToAsset = netWorth.total_assets > 0 ? (netWorth.total_liabilities / netWorth.total_assets) * 100 : 0;
    if (netWorth.total_liabilities === 0) {
      debtScore = 100;
      debtInsight = "No liabilities — debt-free! Outstanding position.";
    } else if (debtToAsset < 20) {
      debtScore = 90;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}% — very manageable.`;
    } else if (debtToAsset < 40) {
      debtScore = 70;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}% — moderate. Focus on paying down high-interest debt.`;
    } else if (debtToAsset < 70) {
      debtScore = 45;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}% — elevated. Prioritize debt reduction.`;
    } else {
      debtScore = 20;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}% — critical. Liabilities significantly outweigh assets.`;
    }
  }
  dims.push({
    key: "debt",
    label: "Debt Health",
    score: debtScore,
    grade: toGrade(debtScore),
    icon: Wallet,
    color: "sky",
    insight: debtInsight,
    link: "/debt-payoff",
    linkLabel: "View Debt Payoff",
  });

  // 4. Investment Performance (0-100)
  let perfScore = 50;
  let perfInsight = "Add investments to track performance.";
  if (risk) {
    const sharpe = risk.sharpe_ratio ?? 0;
    const vol = risk.annualized_volatility ?? 20;
    const dd = Math.abs(risk.max_drawdown ?? 0);

    // Sharpe-driven score (main weight)
    let sharpePts = 0;
    if (sharpe >= 1.5) sharpePts = 50;
    else if (sharpe >= 1.0) sharpePts = 40;
    else if (sharpe >= 0.5) sharpePts = 30;
    else if (sharpe >= 0) sharpePts = 15;
    else sharpePts = 5;

    // Low vol bonus
    const volPts = vol < 10 ? 25 : vol < 15 ? 20 : vol < 25 ? 15 : vol < 35 ? 8 : 3;

    // Drawdown penalty/bonus
    const ddPts = dd < 5 ? 25 : dd < 10 ? 20 : dd < 20 ? 15 : dd < 30 ? 8 : 3;

    perfScore = Math.min(100, sharpePts + volPts + ddPts);

    if (sharpe >= 1.0) perfInsight = `Sharpe ${sharpe.toFixed(2)} with ${vol.toFixed(0)}% vol — strong risk-adjusted returns.`;
    else if (sharpe >= 0.5) perfInsight = `Sharpe ${sharpe.toFixed(2)} — decent returns for the risk taken. Vol at ${vol.toFixed(0)}%.`;
    else perfInsight = `Sharpe ${sharpe.toFixed(2)} — returns don't adequately compensate for ${vol.toFixed(0)}% volatility.`;
  }
  dims.push({
    key: "performance",
    label: "Risk-Adjusted Returns",
    score: perfScore,
    grade: toGrade(perfScore),
    icon: TrendingUp,
    color: "violet",
    insight: perfInsight,
    link: "/risk",
    linkLabel: "View Risk Metrics",
  });

  // 5. Goal Progress (0-100)
  let goalScore = 50;
  let goalInsight = "Create financial goals to track progress.";
  if (goals && goals.length > 0) {
    const avgProgress = goals.reduce((sum, g) => {
      const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
      return sum + pct;
    }, 0) / goals.length;

    goalScore = Math.round(avgProgress);
    const onTrack = goals.filter((g) => g.target_amount > 0 && (g.current_amount / g.target_amount) >= 0.5).length;

    if (avgProgress >= 75) goalInsight = `${onTrack}/${goals.length} goals over 50% complete — excellent progress.`;
    else if (avgProgress >= 40) goalInsight = `${onTrack}/${goals.length} goals over 50% — making progress. Keep contributing.`;
    else goalInsight = `Goals averaging ${avgProgress.toFixed(0)}% completion — consider increasing contributions.`;
  }
  dims.push({
    key: "goals",
    label: "Goal Progress",
    score: goalScore,
    grade: toGrade(goalScore),
    icon: CheckCircle2,
    color: "amber",
    insight: goalInsight,
    link: "/goals",
    linkLabel: "View Goals",
  });

  return dims;
}

// ── Circular score gauge ──────────────────────────────────────────────

function ScoreRing({ score, grade, size = 180 }: { score: number; grade: string; size?: number }) {
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-zinc-800"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={GRADE_RING[grade] ?? "stroke-zinc-400"}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${progress.toFixed(1)} ${(circumference - progress).toFixed(1)}`}
          style={{ transition: "stroke-dasharray 1.2s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-display font-black tabular-nums ${GRADE_COLORS[grade]}`}>
          {score}
        </span>
        <span className="text-xs text-zinc-500 mt-0.5">out of 100</span>
      </div>
    </div>
  );
}

// ── Mini score bar for dimensions ─────────────────────────────────────

function DimBar({ score, grade }: { score: number; grade: string }) {
  const barColor: Record<string, string> = {
    A: "bg-emerald-400",
    B: "bg-teal-400",
    C: "bg-amber-400",
    D: "bg-orange-400",
    F: "bg-rose-400",
  };
  return (
    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full ${barColor[grade] ?? "bg-zinc-500"}`}
        style={{ width: `${score}%`, transition: "width 1s ease-out" }}
      />
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────

function StatusIcon({ grade }: { grade: string }) {
  if (grade === "A" || grade === "B")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (grade === "C")
    return <Info className="w-4 h-4 text-amber-400" />;
  if (grade === "D")
    return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <XCircle className="w-4 h-4 text-rose-400" />;
}

// ── Action items ──────────────────────────────────────────────────────

interface ActionItem {
  priority: "high" | "medium" | "low";
  text: string;
  link: string;
}

function getActionItems(dims: Dimension[]): ActionItem[] {
  const items: ActionItem[] = [];
  for (const d of dims) {
    if (d.score < 40) {
      items.push({ priority: "high", text: `${d.label}: ${d.insight}`, link: d.link });
    } else if (d.score < 65) {
      items.push({ priority: "medium", text: `${d.label}: ${d.insight}`, link: d.link });
    }
  }
  // Sort high → medium → low
  items.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
  return items;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-rose-500/30 bg-rose-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-zinc-700 bg-zinc-800/30",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-zinc-500",
};

// ── Main page ─────────────────────────────────────────────────────────

export default function HealthScorePage() {
  const { summary, portfolio, loading: pLoading } = useDefaultPortfolio();
  const { summary: nw, isLoading: nwLoading } = useNetWorthSummary();
  const { summary: cf, isLoading: cfLoading } = useCashFlowSummary();
  const { goals, isLoading: gLoading } = useGoals();
  const portfolioId = portfolio?.id;
  const { data: risk, isLoading: rLoading } = useRiskMetrics(portfolioId);

  const loading = pLoading || nwLoading || cfLoading || gLoading || rLoading;

  const dimensions = useMemo(() => {
    if (loading) return [];
    return computeHealthScore(
      summary ? { total_value: summary.total_value, holdings: summary.holdings } : null,
      nw ?? null,
      cf ?? null,
      goals ?? null,
      risk ?? null,
    );
  }, [loading, summary, nw, cf, goals, risk]);

  const overallScore = useMemo(() => {
    if (dimensions.length === 0) return 0;
    return Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  }, [dimensions]);

  const overallGrade = toGrade(overallScore);
  const actionItems = useMemo(() => getActionItems(dimensions), [dimensions]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-rose-400" />
          Financial Health Score
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          A holistic assessment of your financial well-being across 5 dimensions
        </p>
      </div>

      {/* Hero score */}
      <FloatingCard glowColor={overallGrade === "A" || overallGrade === "B" ? "rgba(52, 211, 153, 0.12)" : overallGrade === "C" ? "rgba(251, 191, 36, 0.10)" : "rgba(244, 63, 94, 0.10)"} tilt={false}>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <ScoreRing score={overallScore} grade={overallGrade} />
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className={`text-3xl font-display font-bold ${GRADE_COLORS[overallGrade]}`}>
                Grade: {overallGrade}
              </span>
            </div>
            <p className="text-sm text-zinc-400 max-w-md">
              {overallScore >= 80
                ? "Your finances are in excellent shape. Keep maintaining your healthy habits."
                : overallScore >= 60
                  ? "Solid foundation with room for improvement. Focus on the areas below."
                  : overallScore >= 40
                    ? "Several areas need attention. Prioritize the action items below."
                    : "Your financial health needs immediate attention. Start with the highest-priority items."}
            </p>
            <div className="flex gap-4 text-xs text-zinc-500 justify-center sm:justify-start pt-1">
              {dimensions.map((d) => (
                <span key={d.key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${GRADE_COLORS[d.grade].replace("text-", "bg-")}`} />
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </FloatingCard>

      {/* Dimension cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensions.map((d, i) => (
          <RevealOnScroll key={d.key} delay={i * 0.05}>
            <div className={`vela-card relative overflow-hidden`}>
              {/* Gradient accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${GRADE_BG[d.grade]} pointer-events-none`} />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <d.icon className={`w-4 h-4 ${GRADE_COLORS[d.grade]}`} />
                    <span className="text-sm font-medium text-zinc-200">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon grade={d.grade} />
                    <span className={`text-lg font-display font-bold tabular-nums ${GRADE_COLORS[d.grade]}`}>
                      {d.score}
                    </span>
                  </div>
                </div>

                <DimBar score={d.score} grade={d.grade} />

                <p className="text-xs text-zinc-400 leading-relaxed">{d.insight}</p>

                <Link
                  href={d.link}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {d.linkLabel} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </RevealOnScroll>
        ))}
      </div>

      {/* Action items */}
      {actionItems.length > 0 && (
        <RevealOnScroll delay={0.15}>
          <div className="vela-card space-y-3">
            <h2 className="section-heading">Priority Actions</h2>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <Link
                  key={i}
                  href={item.link}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${PRIORITY_STYLES[item.priority]} hover:bg-zinc-800/40 transition-colors`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[item.priority]}`} />
                  <span className="text-xs text-zinc-300 leading-relaxed flex-1">{item.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      )}

      {/* Methodology */}
      <RevealOnScroll delay={0.2}>
        <div className="vela-card">
          <h2 className="section-heading mb-3">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-zinc-400">
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Diversification</p>
              <p>Number of holdings, sector spread, and concentration risk.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Savings Rate</p>
              <p>Monthly income vs expenses. Target: 20%+ of gross income.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Debt Health</p>
              <p>Debt-to-asset ratio from your net worth breakdown.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Risk-Adjusted Returns</p>
              <p>Sharpe ratio, volatility, and max drawdown of your portfolio.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Goal Progress</p>
              <p>Average completion across all financial goals.</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-medium">Overall Score</p>
              <p>Weighted average of all dimensions. A = 90+, B = 75+, C = 60+, D = 40+.</p>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}
