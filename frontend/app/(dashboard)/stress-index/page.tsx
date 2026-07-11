"use client";

import { useMemo } from "react";
import { Activity, ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import {
  calculateStressIndex,
  STATUS_BG,
  STATUS_COLORS,
} from "@/lib/stress-index";
import type { StressInput, StressDimension } from "@/lib/stress-index";
import PageTransition from "@/components/celestial/PageTransition";

// ── Gauge SVG ──────────────────────────────────────────────────────

function ScoreGauge({ score, label, color }: { score: number; label: string; color: string }) {
  // Semi-circle gauge (180 degrees)
  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // half circle
  const filled = (score / 100) * circumference;
  const cx = 100;
  const cy = 95;

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgb(39, 39, 42)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="currentColor"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
        {/* Score text */}
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-zinc-100 text-4xl font-bold" style={{ fontSize: 40 }}>
          {score}
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" className="fill-zinc-500 text-xs" style={{ fontSize: 12 }}>
          out of 100
        </text>
      </svg>
      <p className={`text-lg font-semibold mt-1 ${color}`}>{label}</p>
    </div>
  );
}

// ── Dimension card ─────────────────────────────────────────────────

function DimensionCard({ dim, link }: { dim: StressDimension; link?: string }) {
  const barWidth = `${dim.score}%`;

  const inner = (
    <div className="vela-card group hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[dim.status]}`} />
          <h3 className="text-sm font-medium text-zinc-200">{dim.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BG[dim.status]}`}>
            {dim.score}/100
          </span>
          {link && <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${STATUS_COLORS[dim.status]}`}
          style={{ width: barWidth }}
        />
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed">{dim.detail}</p>
    </div>
  );

  if (link) {
    return <Link href={link} className="block">{inner}</Link>;
  }
  return inner;
}

// ── Dimension to page link mapping ─────────────────────────────────

const DIM_LINKS: Record<string, string> = {
  debt: "/net-worth",
  savings: "/cash-flow",
  concentration: "/portfolio",
  emergency: "/savings",
  goals: "/goals",
  portfolio: "/portfolio",
};

// ── Main page ──────────────────────────────────────────────────────

export default function StressIndexPage() {
  const { summary } = useDefaultPortfolio();
  const { summary: nwSummary } = useNetWorthSummary();
  const { summary: cfSummary } = useCashFlowSummary();
  const { goals } = useGoals();

  const result = useMemo(() => {
    // Build input from available data
    const holdings = (summary?.holdings ?? []).map((h) => ({
      ticker: h.ticker,
      weight: (h.market_value ?? h.total_cost ?? 0) / (summary?.total_value || 1),
    }));

    // Estimate liquid assets from net worth items
    const liquidAssets = nwSummary?.assets
      ?.filter((a) =>
        ["checking", "savings", "hysa", "money_market"].includes(a.category),
      )
      .reduce((s, a) => s + a.value, 0) ?? 0;

    const monthlyExpenses = cfSummary
      ? cfSummary.total_expenses
      : 0;

    const input: StressInput = {
      totalLiabilities: nwSummary?.total_liabilities ?? 0,
      totalAssets: nwSummary?.total_assets ?? 0,
      netWorth: nwSummary?.net_worth ?? 0,
      savingsRate: cfSummary?.savings_rate ?? 0,
      totalIncome: cfSummary?.total_income ?? 0,
      portfolioValue: summary?.total_value ?? 0,
      holdings,
      dayChangePct: summary?.day_change_pct ?? 0,
      unrealizedPnlPct: summary?.unrealized_pnl_pct ?? 0,
      goals: goals.map((g) => ({
        currentAmount: g.current_amount,
        targetAmount: g.target_amount,
        targetDate: g.target_date,
      })),
      liquidAssets,
      monthlyExpenses,
    };

    return calculateStressIndex(input);
  }, [summary, nwSummary, cfSummary, goals]);

  // Sort dimensions: worst first to draw attention
  const sortedDims = [...result.dimensions].sort((a, b) => a.score - b.score);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Activity className="w-7 h-7 text-vela-teal" />
          Financial Stress Index
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          A composite score based on your debt, savings, portfolio, and goals.
        </p>
      </div>

      {/* Score + Summary */}
      <div className="vela-card flex flex-col items-center py-6">
        <ScoreGauge score={result.overall} label={result.label} color={result.color} />
        <p className="text-sm text-zinc-400 mt-4 max-w-md text-center">
          {result.overall >= 65
            ? "Your finances are in a solid position across most dimensions."
            : result.overall >= 40
              ? "There are a few areas that could use attention. Check the breakdown below."
              : "Several areas need focus. Start with the lowest-scoring dimensions below."}
        </p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {result.dimensions.map((dim) => (
          <div key={dim.id} className="vela-card text-center p-3">
            <div className={`text-lg font-bold tabular ${dim.score >= 60 ? "text-emerald-400" : dim.score >= 35 ? "text-amber-400" : "text-rose-400"}`}>
              {dim.score}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{dim.label}</p>
          </div>
        ))}
      </div>

      {/* Detailed breakdown  - worst first */}
      <div className="space-y-3">
        <h2 className="section-heading">Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDims.map((dim) => (
            <DimensionCard key={dim.id} dim={dim} link={DIM_LINKS[dim.id]} />
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="vela-card border-vela-teal/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-vela-teal mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">How this score works</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your stress index combines six dimensions of your financial life: debt load (20%),
              savings rate (20%), emergency buffer (20%), diversification (15%), portfolio
              performance (15%), and goal progress (10%). The more data you add to Velnor, the
              more accurate this score becomes. This is for educational purposes only and not
              financial advice.
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
