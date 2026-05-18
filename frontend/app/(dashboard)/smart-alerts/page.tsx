"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  PiggyBank,
  Target,
  DollarSign,
  Scissors,
  BarChart2,
  ArrowRight,
  CheckCircle2,
  Filter,
  Wallet,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

// ── Alert types ───────────────────────────────────────────────────────

type AlertCategory = "portfolio" | "planning" | "opportunity" | "risk";
type AlertSeverity = "critical" | "warning" | "info" | "positive";

interface SmartAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: string;
  link: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SEVERITY_STYLES: Record<AlertSeverity, { border: string; bg: string; dot: string; iconColor: string }> = {
  critical: {
    border: "border-rose-500/30",
    bg: "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent",
    dot: "bg-rose-400",
    iconColor: "text-rose-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent",
    dot: "bg-amber-400",
    iconColor: "text-amber-400",
  },
  info: {
    border: "border-teal-500/20",
    bg: "bg-gradient-to-r from-teal-500/8 via-teal-500/3 to-transparent",
    dot: "bg-teal-400",
    iconColor: "text-teal-400",
  },
  positive: {
    border: "border-emerald-500/20",
    bg: "bg-gradient-to-r from-emerald-500/8 via-emerald-500/3 to-transparent",
    dot: "bg-emerald-400",
    iconColor: "text-emerald-400",
  },
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  portfolio: "Portfolio",
  planning: "Planning",
  opportunity: "Opportunity",
  risk: "Risk",
};

// ── Alert generation engine ───────────────────────────────────────────

function generateAlerts(
  summary: { total_value: number; holdings: { ticker: string; market_value: number | null; total_cost: number; unrealized_pnl: number | null; unrealized_pnl_pct: number | null; sector?: string; day_change_pct: number | null; quantity: number }[] } | null,
  nw: { net_worth: number; total_assets: number; total_liabilities: number } | null,
  cf: { total_income: number; total_expenses: number; savings_rate: number | null } | null,
  goals: { name: string; target_amount: number; current_amount: number; monthly_contribution: number | null; target_date: string | null }[] | null,
  risk: { annualized_volatility: number | null; max_drawdown: number | null; sharpe_ratio: number | null } | null,
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  let id = 0;

  // ── Portfolio alerts ──────────────────────────────────────────────

  if (summary && summary.holdings.length > 0) {
    const totalValue = summary.total_value;

    // Concentration risk — any single holding >25%
    for (const h of summary.holdings) {
      const mv = h.market_value ?? h.total_cost;
      const pct = totalValue > 0 ? (mv / totalValue) * 100 : 0;
      if (pct > 25) {
        alerts.push({
          id: `conc-${id++}`,
          category: "risk",
          severity: pct > 40 ? "critical" : "warning",
          title: `${h.ticker} is ${pct.toFixed(0)}% of your portfolio`,
          description: `High concentration in a single position increases idiosyncratic risk. Consider trimming to below 20% and reallocating to maintain diversification.`,
          action: "View Rebalance",
          link: "/rebalance",
          icon: ShieldAlert,
        });
      }
    }

    // Big daily movers
    for (const h of summary.holdings) {
      const dayPct = h.day_change_pct ?? 0;
      if (Math.abs(dayPct) > 5) {
        alerts.push({
          id: `move-${id++}`,
          category: "portfolio",
          severity: dayPct < -5 ? "warning" : "positive",
          title: `${h.ticker} moved ${dayPct > 0 ? "+" : ""}${dayPct.toFixed(1)}% today`,
          description: dayPct < 0
            ? `Significant drop — review your thesis. If the fundamentals haven't changed, this could be a buying opportunity.`
            : `Strong rally — consider whether to take partial profits or let it ride based on your thesis.`,
          action: "View Portfolio",
          link: "/portfolio",
          icon: dayPct < 0 ? TrendingDown : TrendingUp,
        });
      }
    }

    // Tax-loss harvesting opportunities
    const harvestable = summary.holdings.filter((h) => (h.unrealized_pnl ?? 0) < 0);
    const totalLosses = harvestable.reduce((s, h) => s + Math.abs(h.unrealized_pnl ?? 0), 0);
    if (totalLosses > 100) {
      const taxSavings = totalLosses * 0.22;
      alerts.push({
        id: `tlh-${id++}`,
        category: "opportunity",
        severity: totalLosses > 1000 ? "info" : "info",
        title: `$${totalLosses.toFixed(0)} in harvestable losses`,
        description: `${harvestable.length} position${harvestable.length !== 1 ? "s" : ""} have unrealized losses. Harvesting could save ~$${taxSavings.toFixed(0)} in taxes at the 22% bracket. Remember the 30-day wash sale rule.`,
        action: "View Tax Harvest",
        link: "/tax-harvest",
        icon: Scissors,
      });
    }

    // Sector concentration
    const sectorMap: Record<string, number> = {};
    for (const h of summary.holdings) {
      const sec = h.sector || "Other";
      sectorMap[sec] = (sectorMap[sec] || 0) + (h.market_value ?? h.total_cost ?? 0);
    }
    const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);
    if (sectors.length > 0 && totalValue > 0) {
      const topPct = (sectors[0][1] / totalValue) * 100;
      if (topPct > 50 && sectors.length < 4) {
        alerts.push({
          id: `sec-${id++}`,
          category: "risk",
          severity: "warning",
          title: `${topPct.toFixed(0)}% concentrated in ${sectors[0][0]}`,
          description: `Your portfolio is heavily weighted toward one sector. A downturn in ${sectors[0][0]} would disproportionately impact you. Consider diversifying across more industries.`,
          action: "View Sectors",
          link: "/sectors",
          icon: BarChart2,
        });
      }
    }

    // Small positions that aren't worth holding
    const dustPositions = summary.holdings.filter((h) => {
      const mv = h.market_value ?? h.total_cost;
      return totalValue > 0 && (mv / totalValue) * 100 < 0.5 && mv < 50;
    });
    if (dustPositions.length >= 2) {
      alerts.push({
        id: `dust-${id++}`,
        category: "portfolio",
        severity: "info",
        title: `${dustPositions.length} dust positions under 0.5%`,
        description: `Tiny positions add complexity without meaningful impact. Consider consolidating ${dustPositions.map((p) => p.ticker).join(", ")} into your core holdings.`,
        action: "View Portfolio",
        link: "/portfolio",
        icon: DollarSign,
      });
    }
  }

  // ── Net worth / debt alerts ───────────────────────────────────────

  if (nw) {
    if (nw.total_liabilities > 0 && nw.total_assets > 0) {
      const debtRatio = (nw.total_liabilities / nw.total_assets) * 100;
      if (debtRatio > 60) {
        alerts.push({
          id: `debt-${id++}`,
          category: "risk",
          severity: debtRatio > 80 ? "critical" : "warning",
          title: `Debt-to-asset ratio at ${debtRatio.toFixed(0)}%`,
          description: `Your liabilities represent a significant portion of your assets. Prioritize paying down high-interest debt to strengthen your balance sheet.`,
          action: "View Debt Payoff",
          link: "/debt-payoff",
          icon: AlertTriangle,
        });
      }
    }

    if (nw.net_worth < 0) {
      alerts.push({
        id: `nwneg-${id++}`,
        category: "planning",
        severity: "critical",
        title: "Negative net worth",
        description: `Your liabilities ($${(nw.total_liabilities / 1000).toFixed(1)}K) exceed your assets ($${(nw.total_assets / 1000).toFixed(1)}K). Focus on debt reduction and building an emergency fund.`,
        action: "View Net Worth",
        link: "/net-worth",
        icon: Wallet,
      });
    }
  }

  // ── Cash flow alerts ──────────────────────────────────────────────

  if (cf && cf.total_income > 0) {
    const rate = cf.savings_rate ?? ((cf.total_income - cf.total_expenses) / cf.total_income) * 100;
    if (rate < 0) {
      alerts.push({
        id: `savneg-${id++}`,
        category: "planning",
        severity: "critical",
        title: "Spending exceeds income",
        description: `You're spending $${Math.abs(cf.total_income - cf.total_expenses).toFixed(0)}/mo more than you earn. This is unsustainable — review your budget for cuts.`,
        action: "View Budget",
        link: "/budget",
        icon: AlertTriangle,
      });
    } else if (rate < 10) {
      alerts.push({
        id: `savlow-${id++}`,
        category: "planning",
        severity: "warning",
        title: `Savings rate at ${rate.toFixed(0)}%`,
        description: `Financial advisors recommend saving at least 20% of income. At ${rate.toFixed(0)}%, you have room to improve. Even small increases compound significantly over time.`,
        action: "View Cash Flow",
        link: "/cash-flow",
        icon: PiggyBank,
      });
    } else if (rate >= 30) {
      alerts.push({
        id: `savhi-${id++}`,
        category: "opportunity",
        severity: "positive",
        title: `Excellent ${rate.toFixed(0)}% savings rate`,
        description: `You're saving well above the recommended 20% target. This accelerates your path to financial independence significantly.`,
        action: "View FI Tracker",
        link: "/fi",
        icon: PiggyBank,
      });
    }
  }

  // ── Goal alerts ───────────────────────────────────────────────────

  if (goals && goals.length > 0) {
    for (const g of goals) {
      if (g.target_amount <= 0) continue;
      const pct = (g.current_amount / g.target_amount) * 100;

      // Goal nearly complete
      if (pct >= 90 && pct < 100) {
        alerts.push({
          id: `goal90-${id++}`,
          category: "opportunity",
          severity: "positive",
          title: `"${g.name}" is ${pct.toFixed(0)}% complete`,
          description: `You're almost there! Only $${(g.target_amount - g.current_amount).toFixed(0)} left to reach your goal.`,
          action: "View Goals",
          link: "/goals",
          icon: Target,
        });
      }

      // Goal with no contribution
      if ((g.monthly_contribution ?? 0) === 0 && pct < 50) {
        alerts.push({
          id: `goalnoc-${id++}`,
          category: "planning",
          severity: "info",
          title: `"${g.name}" has no monthly contribution`,
          description: `At ${pct.toFixed(0)}% progress with no recurring contribution, this goal may stall. Set up automatic contributions to stay on track.`,
          action: "View Goals",
          link: "/goals",
          icon: Target,
        });
      }
    }
  }

  // ── Risk alerts ───────────────────────────────────────────────────

  if (risk) {
    const vol = risk.annualized_volatility ?? 0;
    const dd = Math.abs(risk.max_drawdown ?? 0);
    const sharpe = risk.sharpe_ratio ?? 0;

    if (vol > 30) {
      alerts.push({
        id: `volhi-${id++}`,
        category: "risk",
        severity: "warning",
        title: `Portfolio volatility at ${vol.toFixed(0)}%`,
        description: `Your portfolio swings more than the broad market (~15-20%). If this exceeds your risk tolerance, consider adding bonds, REITs, or lower-beta holdings.`,
        action: "View Risk",
        link: "/risk",
        icon: ShieldAlert,
      });
    }

    if (dd > 20) {
      alerts.push({
        id: `ddhi-${id++}`,
        category: "risk",
        severity: dd > 30 ? "critical" : "warning",
        title: `Max drawdown of ${dd.toFixed(0)}%`,
        description: `Your portfolio has experienced a ${dd.toFixed(0)}% peak-to-trough decline. Review whether your allocation matches your risk tolerance.`,
        action: "View Risk",
        link: "/risk",
        icon: TrendingDown,
      });
    }

    if (sharpe < 0) {
      alerts.push({
        id: `sharpneg-${id++}`,
        category: "risk",
        severity: "warning",
        title: "Negative Sharpe ratio",
        description: `Your portfolio is underperforming a risk-free asset. Consider reviewing your holdings and whether your strategy is working.`,
        action: "View Optimizer",
        link: "/optimizer",
        icon: BarChart2,
      });
    }
  }

  // Sort: critical first, then warning, info, positive
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ── Filter pill ───────────────────────────────────────────────────────

function FilterPill({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        active
          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
          : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-teal-500/30" : "bg-zinc-700/50"}`}>
        {count}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function SmartAlertsPage() {
  const { summary, portfolio, loading: pLoading, error: pError } = useDefaultPortfolio();
  const { summary: nw, isLoading: nwLoading, error: nwError } = useNetWorthSummary();
  const { summary: cf, isLoading: cfLoading, error: cfError } = useCashFlowSummary();
  const { goals, isLoading: gLoading, error: gError } = useGoals();
  const portfolioId = portfolio?.id;
  const { data: risk, isLoading: rLoading, error: rError } = useRiskMetrics(portfolioId);

  const loading = pLoading || nwLoading || cfLoading || gLoading || rLoading;
  const error = pError || nwError || cfError || gError || rError;

  const [activeFilter, setActiveFilter] = useState<AlertCategory | "all">("all");

  const allAlerts = useMemo(() => {
    if (loading) return [];
    return generateAlerts(
      summary ? { total_value: summary.total_value, holdings: summary.holdings } : null,
      nw ?? null,
      cf ?? null,
      goals ?? null,
      risk ?? null,
    );
  }, [loading, summary, nw, cf, goals, risk]);

  const filteredAlerts = useMemo(() => {
    if (activeFilter === "all") return allAlerts;
    return allAlerts.filter((a) => a.category === activeFilter);
  }, [allAlerts, activeFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allAlerts.length, portfolio: 0, planning: 0, opportunity: 0, risk: 0 };
    for (const a of allAlerts) counts[a.category] = (counts[a.category] || 0) + 1;
    return counts;
  }, [allAlerts]);

  const severityCounts = useMemo(() => {
    const counts: Record<AlertSeverity, number> = { critical: 0, warning: 0, info: 0, positive: 0 };
    for (const a of allAlerts) counts[a.severity]++;
    return counts;
  }, [allAlerts]);

  if (error) return <ErrorState message="Failed to load alert data." onRetry={() => window.location.reload()} />;
  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-400" />
          Smart Alerts
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Automated insights from your portfolio, net worth, cash flow, and goals
        </p>
      </div>

      {/* Summary strip */}
      <FloatingCard glowColor="rgba(251, 191, 36, 0.08)" tilt={false}>
        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="text-center">
            <p className="text-3xl font-display font-bold text-zinc-100 tabular-nums">{allAlerts.length}</p>
            <p className="text-xs text-zinc-500">Total Alerts</p>
          </div>
          <div className="h-10 w-px bg-zinc-800 hidden sm:block" />
          {severityCounts.critical > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-rose-400 tabular-nums">{severityCounts.critical}</p>
                <p className="text-[10px] text-zinc-600">Critical</p>
              </div>
            </div>
          )}
          {severityCounts.warning > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div>
                <p className="text-sm font-bold text-amber-400 tabular-nums">{severityCounts.warning}</p>
                <p className="text-[10px] text-zinc-600">Warning</p>
              </div>
            </div>
          )}
          {severityCounts.info > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
              <div>
                <p className="text-sm font-bold text-teal-400 tabular-nums">{severityCounts.info}</p>
                <p className="text-[10px] text-zinc-600">Info</p>
              </div>
            </div>
          )}
          {severityCounts.positive > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">{severityCounts.positive}</p>
                <p className="text-[10px] text-zinc-600">Positive</p>
              </div>
            </div>
          )}
        </div>
      </FloatingCard>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-zinc-600" />
        <FilterPill label="All" active={activeFilter === "all"} count={categoryCounts.all} onClick={() => setActiveFilter("all")} />
        {(["portfolio", "risk", "planning", "opportunity"] as AlertCategory[]).map((cat) =>
          categoryCounts[cat] > 0 ? (
            <FilterPill
              key={cat}
              label={CATEGORY_LABELS[cat]}
              active={activeFilter === cat}
              count={categoryCounts[cat]}
              onClick={() => setActiveFilter(activeFilter === cat ? "all" : cat)}
            />
          ) : null,
        )}
      </div>

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-200">
              {allAlerts.length === 0 ? "No alerts detected" : "No alerts in this category"}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              {allAlerts.length === 0
                ? "Your finances look clean. We'll surface insights as your data changes."
                : "Try a different filter to see other alerts."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, i) => {
            const style = SEVERITY_STYLES[alert.severity];
            return (
              <RevealOnScroll key={alert.id} delay={i * 0.03}>
                <div className={`rounded-xl border ${style.border} ${style.bg} p-4 sm:p-5 transition-all hover:scale-[1.005]`}>
                  <div className="flex gap-3 sm:gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 mt-0.5 ${style.iconColor}`}>
                      <alert.icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-zinc-100">{alert.title}</h3>
                        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${style.border} ${style.iconColor}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{alert.description}</p>
                      <Link
                        href={alert.link}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-teal-400 transition-colors pt-1"
                      >
                        {alert.action} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      )}

      {/* Data sources */}
      <RevealOnScroll delay={0.1}>
        <div className="vela-card">
          <h2 className="section-heading mb-3">Data Sources Scanned</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Portfolio", connected: !!summary, count: summary?.holdings.length ?? 0, unit: "holdings" },
              { label: "Net Worth", connected: !!nw, count: nw ? 1 : 0, unit: "snapshot" },
              { label: "Cash Flow", connected: !!cf, count: cf ? 1 : 0, unit: "snapshot" },
              { label: "Goals", connected: !!goals && goals.length > 0, count: goals?.length ?? 0, unit: "goals" },
              { label: "Risk Metrics", connected: !!risk, count: risk ? 1 : 0, unit: "analysis" },
            ].map((src) => (
              <div key={src.label} className="text-center py-2">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${src.connected ? "bg-emerald-400" : "bg-zinc-700"}`} />
                <p className="text-xs font-medium text-zinc-300">{src.label}</p>
                <p className="text-[10px] text-zinc-600">
                  {src.connected ? `${src.count} ${src.unit}` : "Not set up"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}
