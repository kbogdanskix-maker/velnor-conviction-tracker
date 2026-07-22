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
  A: "bg-emerald-500/10",
  B: "bg-vela-teal/10",
  C: "bg-amber-500/10",
  D: "bg-orange-500/10",
  F: "bg-rose-500/10",
};

/** Solid dot fills matching GRADE_COLORS. These must be literal strings:
 *  Tailwind cannot see class names built at runtime, so deriving them from
 *  GRADE_COLORS produced no CSS and the dot rendered invisible. */
const GRADE_DOT: Record<string, string> = {
  A: "bg-emerald-400",
  B: "bg-teal-400",
  C: "bg-amber-400",
  D: "bg-orange-400",
  F: "bg-rose-400",
};

const GRADE_RING: Record<string, string> = {
  A: "stroke-emerald-400",
  B: "stroke-teal-400",
  C: "stroke-amber-400",
  D: "stroke-orange-400",
  F: "stroke-rose-400",
};

// ── Goal context detection ────────────────────────────────────────────

interface GoalContext {
  horizon: "short" | "medium" | "long"; // <24mo / 24-120mo / >120mo
  hasRetirement: boolean;
  hasHouseOrDebt: boolean;
  hasUrgentUnderfunded: boolean; // due <12mo, <70% done
  urgentGoalName: string | null;
  weights: { diversification: number; savings: number; debt: number; performance: number; goals: number };
}

function monthsUntilDate(dateStr: string): number {
  const now = new Date();
  const t = new Date(dateStr);
  return Math.max(0, (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()));
}

function detectGoalContext(
  goals: { name: string; icon: string; target_amount: number; current_amount: number; monthly_contribution: number; target_date: string }[] | null,
): GoalContext {
  const defaultWeights = { diversification: 20, savings: 20, debt: 20, performance: 20, goals: 20 };
  if (!goals || goals.length === 0) {
    return { horizon: "medium", hasRetirement: false, hasHouseOrDebt: false, hasUrgentUnderfunded: false, urgentGoalName: null, weights: defaultWeights };
  }

  const hasRetirement = goals.some((g) => /retir|pension|fire|independen/i.test(g.name));
  const hasHouseOrDebt = goals.some((g) => /house|home|mortgage|property|debt|loan/i.test(g.name));

  const horizons = goals.map((g) => monthsUntilDate(g.target_date));
  const minHorizon = Math.min(...horizons);
  const avgHorizon = horizons.reduce((a, b) => a + b, 0) / horizons.length;
  const horizon: "short" | "medium" | "long" = avgHorizon < 24 ? "short" : avgHorizon > 120 ? "long" : "medium";

  const urgentGoal = goals.find((g) => {
    const mo = monthsUntilDate(g.target_date);
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 100;
    return mo < 12 && pct < 70;
  });

  // Compute goal-aware weights (must sum to 100)
  let weights = { ...defaultWeights };
  if (hasRetirement) {
    weights = { diversification: 25, savings: 25, debt: 10, performance: 30, goals: 10 };
  } else if (hasHouseOrDebt) {
    weights = { diversification: 15, savings: 25, debt: 30, performance: 15, goals: 15 };
  } else if (horizon === "short") {
    weights = { diversification: 10, savings: 30, debt: 20, performance: 10, goals: 30 };
  } else if (horizon === "long") {
    weights = { diversification: 25, savings: 20, debt: 10, performance: 30, goals: 15 };
  }

  return {
    horizon,
    hasRetirement,
    hasHouseOrDebt,
    hasUrgentUnderfunded: !!urgentGoal,
    urgentGoalName: urgentGoal?.name ?? null,
    weights,
  };
}

// ── Score computation ─────────────────────────────────────────────────

function computeHealthScore(
  portfolio: { total_value: number; holdings: { unrealized_pnl_pct: number | null; sector?: string }[] } | null,
  netWorth: { net_worth: number; total_assets: number; total_liabilities: number } | null,
  cashFlow: { total_income: number; total_expenses: number; savings_rate: number | null } | null,
  goals: { name: string; icon: string; target_amount: number; current_amount: number; monthly_contribution: number; target_date: string }[] | null,
  risk: { annualized_volatility: number | null; max_drawdown: number | null; sharpe_ratio: number | null } | null,
): { dimensions: Dimension[]; weights: GoalContext["weights"]; goalContext: GoalContext } {
  const ctx = detectGoalContext(goals);
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

    if (sectors.size <= 2) divInsight = `${sectors.size} sector${sectors.size === 1 ? "" : "s"} across ${holdingCount} holding${holdingCount === 1 ? "" : "s"}, a concentrated spread.`;
    else if (holdingCount < 5) divInsight = `${holdingCount} holdings across ${sectors.size} sectors, a narrow book.`;
    else divInsight = `${holdingCount} holdings across ${sectors.size} sectors, broadly spread.`;
  }
  dims.push({
    key: "diversification",
    label: "Diversification",
    score: divScore,
    grade: toGrade(divScore),
    icon: ShieldCheck,
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

    if (rate >= 20) savInsight = `${rate.toFixed(0)}% savings rate, above the commonly cited 20% benchmark.`;
    else if (rate >= 10) savInsight = `${rate.toFixed(0)}% savings rate, below the commonly cited 20% benchmark.`;
    else if (rate >= 0) savInsight = `${rate.toFixed(0)}% savings rate, well below the commonly cited 20% benchmark.`;
    else savInsight = `Negative savings rate: expenses exceed income this period.`;
  }
  dims.push({
    key: "savings",
    label: "Savings Rate",
    score: savScore,
    grade: toGrade(savScore),
    icon: PiggyBank,
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
      debtInsight = "No liabilities recorded: a debt-free position.";
    } else if (debtToAsset < 20) {
      debtScore = 90;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}%, a low level.`;
    } else if (debtToAsset < 40) {
      debtScore = 70;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}%, a moderate level.`;
    } else if (debtToAsset < 70) {
      debtScore = 45;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}%, an elevated level.`;
    } else {
      debtScore = 20;
      debtInsight = `Debt-to-asset ratio of ${debtToAsset.toFixed(0)}%: liabilities outweigh assets.`;
    }
  }
  dims.push({
    key: "debt",
    label: "Debt Health",
    score: debtScore,
    grade: toGrade(debtScore),
    icon: Wallet,
    insight: debtInsight,
    link: "/net-worth",
    linkLabel: "View Net Worth",
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

    if (sharpe >= 1.0) perfInsight = `Sharpe ${sharpe.toFixed(2)} at ${vol.toFixed(0)}% volatility, a strong risk-adjusted reading.`;
    else if (sharpe >= 0.5) perfInsight = `Sharpe ${sharpe.toFixed(2)} at ${vol.toFixed(0)}% volatility, a moderate reading.`;
    else perfInsight = `Sharpe ${sharpe.toFixed(2)} against ${vol.toFixed(0)}% volatility, a low reading.`;
  }
  dims.push({
    key: "performance",
    label: "Risk-Adjusted Returns",
    score: perfScore,
    grade: toGrade(perfScore),
    icon: TrendingUp,
    insight: perfInsight,
    link: "/risk",
    linkLabel: "View Risk Metrics",
  });

  // 5. Goal Progress (0-100) — horizon + urgency aware
  let goalScore = 50;
  let goalInsight = "Create financial goals to track progress.";
  if (goals && goals.length > 0) {
    const goalData = goals.map((g) => {
      const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
      const mo = monthsUntilDate(g.target_date);
      // Urgency penalty: near-deadline + underfunded reduces score harder
      const urgencyMultiplier = mo < 12 && pct < 70 ? 0.7 : mo < 24 && pct < 40 ? 0.85 : 1.0;
      return { pct, mo, urgencyMultiplier, name: g.name, monthly: g.monthly_contribution };
    });

    const weightedProgress = goalData.reduce((sum, g) => sum + g.pct * g.urgencyMultiplier, 0) / goalData.length;
    goalScore = Math.round(Math.min(100, weightedProgress));

    const onTrack = goalData.filter((g) => g.pct >= 50).length;
    const urgent = goalData.filter((g) => g.mo < 12 && g.pct < 70);

    if (ctx.hasUrgentUnderfunded && urgent.length > 0) {
      goalInsight = `"${urgent[0].name}" is due within a year, currently ${urgent[0].pct.toFixed(0)}% funded.`;
    } else if (goalScore >= 75) {
      goalInsight = `${onTrack}/${goals.length} goals over 50% complete.`;
    } else if (goalScore >= 40) {
      goalInsight = `${onTrack}/${goals.length} goals over 50% complete.`;
    } else {
      goalInsight = `Goals averaging ${weightedProgress.toFixed(0)}% completion.`;
    }
  }
  dims.push({
    key: "goals",
    label: "Goal Progress",
    score: goalScore,
    grade: toGrade(goalScore),
    icon: CheckCircle2,
    insight: goalInsight,
    link: "/goals",
    linkLabel: "View Goals",
  });

  return { dimensions: dims, weights: ctx.weights, goalContext: ctx };
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

  const { dimensions, weights, goalContext } = useMemo(() => {
    if (loading) return { dimensions: [], weights: { diversification: 20, savings: 20, debt: 20, performance: 20, goals: 20 }, goalContext: null };
    return computeHealthScore(
      summary ? { total_value: summary.total_value, holdings: summary.holdings } : null,
      nw ?? null,
      cf ?? null,
      goals && goals.length > 0 ? goals.map(g => ({
        name: g.name, icon: g.icon,
        target_amount: g.target_amount, current_amount: g.current_amount,
        monthly_contribution: g.monthly_contribution, target_date: g.target_date,
      })) : null,
      risk ?? null,
    );
  }, [loading, summary, nw, cf, goals, risk]);

  // Weighted overall score (goal-context-aware)
  const overallScore = useMemo(() => {
    if (dimensions.length === 0) return 0;
    const keyMap: Record<string, keyof typeof weights> = {
      diversification: "diversification", savings: "savings",
      debt: "debt", performance: "performance", goals: "goals",
    };
    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    const weighted = dimensions.reduce((s, d) => {
      const w = weights[keyMap[d.key]] ?? 20;
      return s + d.score * w;
    }, 0);
    return Math.round(weighted / totalWeight);
  }, [dimensions, weights]);

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
          {goalContext && goals && goals.length > 0 && (
            <span className="ml-2 text-[11px] text-teal-500/80 font-medium">
              · weights adjusted for your {goalContext.hasRetirement ? "retirement" : goalContext.hasHouseOrDebt ? "home/debt" : goalContext.horizon + "-term"} goals
            </span>
          )}
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
                ? "Your five dimensions read strong across the board."
                : overallScore >= 60
                  ? "A solid overall reading. Some dimensions score lower than others, broken out below."
                  : overallScore >= 40
                    ? "Several dimensions score lower than others. Each is broken out below."
                    : "Several dimensions score low. Each is broken out below."}
            </p>
            <div className="flex gap-4 text-xs text-zinc-500 justify-center sm:justify-start pt-1">
              {dimensions.map((d) => (
                <span key={d.key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${GRADE_DOT[d.grade]}`} />
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
              <div className={`absolute inset-0 ${GRADE_BG[d.grade]} pointer-events-none`} />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <d.icon className={`w-4 h-4 ${GRADE_COLORS[d.grade]}`} />
                    <span className="text-sm font-medium text-zinc-200">{d.label}</span>
                    {weights[d.key as keyof typeof weights] !== 20 && (
                      <span className="text-[9px] font-semibold text-teal-500/70 bg-teal-500/10 px-1.5 py-0.5 rounded">
                        {weights[d.key as keyof typeof weights]}%
                      </span>
                    )}
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

      {/* Lowest-scoring dimensions */}
      {actionItems.length > 0 && (
        <RevealOnScroll delay={0.15}>
          <div className="vela-card space-y-3">
            <h2 className="section-heading">Where you score lowest</h2>
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
              <p>Weighted average across dimensions. Weights shift based on your goals (retirement, home, horizon). A = 90+, B = 75+, C = 60+, D = 40+.</p>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}
