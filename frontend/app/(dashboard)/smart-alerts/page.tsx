"use client";

import { useMemo, useState, useCallback } from "react";
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
  Sparkles,
  Loader2,
} from "lucide-react";
import { apiStreamPost } from "@/lib/api";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { useSectorBreakdown, type SectorEntry } from "@/hooks/useSectors";
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

// ── Goal context helpers ──────────────────────────────────────────────

function moUntil(dateStr: string | null): number {
  if (!dateStr) return 999;
  const now = new Date();
  const t = new Date(dateStr);
  return Math.max(0, (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()));
}

function projectedValue(current: number, monthly: number, months: number, cagr = 0.07): number {
  const r = Math.pow(1 + cagr, 1 / 12) - 1;
  if (r === 0) return current + monthly * months;
  return current * Math.pow(1 + r, months) + monthly * ((Math.pow(1 + r, months) - 1) / r);
}

// ── Alert generation engine ───────────────────────────────────────────

function generateAlerts(
  summary: { total_value: number; holdings: { ticker: string; market_value: number | null; total_cost: number; unrealized_pnl: number | null; unrealized_pnl_pct: number | null; sector?: string; day_change_pct: number | null; quantity: number }[] } | null,
  nw: { net_worth: number; total_assets: number; total_liabilities: number } | null,
  cf: { total_income: number; total_expenses: number; savings_rate: number | null } | null,
  goals: { name: string; target_amount: number; current_amount: number; monthly_contribution: number | null; target_date: string | null }[] | null,
  risk: { annualized_volatility: number | null; max_drawdown: number | null; sharpe_ratio: number | null } | null,
  sectors: SectorEntry[] | null,
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  let id = 0;

  // ── Portfolio alerts ──────────────────────────────────────────────

  if (summary && summary.holdings.length > 0) {
    const totalValue = summary.total_value;

    // Concentration risk  - any single holding >25%
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
            ? `Significant drop  - review your thesis. If the fundamentals haven't changed, this could be a buying opportunity.`
            : `Strong rally  - consider whether to take partial profits or let it ride based on your thesis.`,
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

    // Sector concentration — use real sector data if available, fall back to holding-level
    const sectorSource: Array<{ name: string; value: number }> = sectors && sectors.length > 0
      ? sectors
      : (() => {
          const m: Record<string, number> = {};
          for (const h of summary.holdings) {
            const sec = h.sector || "Unknown";
            m[sec] = (m[sec] || 0) + (h.market_value ?? h.total_cost ?? 0);
          }
          return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        })();

    if (sectorSource.length > 0 && totalValue > 0) {
      const topSector = sectorSource[0];
      const topPct = (topSector.value / totalValue) * 100;
      const sectorCount = sectorSource.filter((s) => s.value > 0).length;

      // Top 2 sectors combined weight
      const top2Value = sectorSource.slice(0, 2).reduce((s, x) => s + x.value, 0);
      const top2Pct = (top2Value / totalValue) * 100;

      const isSingleHeavy = topPct > 40;           // one sector over 40%
      const isDualHeavy = top2Pct > 70 && sectorCount <= 4; // top 2 dominate and few sectors

      if (isSingleHeavy || isDualHeavy) {
        const dollarExposed = topSector.value;
        const drop20 = dollarExposed * 0.2;
        const drop30 = dollarExposed * 0.3;

        // Build goal-aware diversification suggestions filtered to sectors not yet held
        const SP500_SECTORS = ["Healthcare", "Consumer Defensive", "Utilities", "Energy", "Industrials", "Real Estate", "Communication Services", "Basic Materials"];
        const heldSectorNames = new Set(sectorSource.map((s) => s.name.toLowerCase()));
        const missingSectors = SP500_SECTORS.filter((s) => !heldSectorNames.has(s.toLowerCase()));

        const hasRetirement = goals?.some((g) => /retir|pension|fire|independen/i.test(g.name));
        const hasDebt = goals?.some((g) => /house|home|mortgage|property|debt|loan/i.test(g.name));
        const prioritySectors = hasRetirement
          ? ["Healthcare", "Utilities", "Consumer Defensive"]
          : hasDebt
            ? ["Consumer Defensive", "Utilities", "Real Estate"]
            : ["Healthcare", "Consumer Defensive", "Industrials"];
        const suggestSectors = prioritySectors.filter((s) => missingSectors.includes(s)).slice(0, 3);
        const suggestText = suggestSectors.length > 0
          ? `Consider adding ${suggestSectors.join(", ")}, sectors you currently have zero exposure to.`
          : `Spreading further across the ${missingSectors.length} sectors you don't hold would reduce correlation risk.`;

        // Build a message that references actual sector names and top-2 if relevant
        let description: string;
        if (isDualHeavy && sectorSource[1]) {
          const sec2 = sectorSource[1];
          const sec2Pct = (sec2.value / totalValue) * 100;
          description = `${topSector.name} (${topPct.toFixed(0)}%) + ${sec2.name} (${sec2Pct.toFixed(0)}%) = ${top2Pct.toFixed(0)}% of your portfolio. A 20% ${topSector.name} correction alone costs ~$${drop20.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${suggestText}`;
        } else {
          description = `$${dollarExposed.toLocaleString(undefined, { maximumFractionDigits: 0 })} rides on ${topSector.name}. A 20% sector downturn = ~$${drop20.toLocaleString(undefined, { maximumFractionDigits: 0 })} loss; a 30% drop = ~$${drop30.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${suggestText}`;
        }

        alerts.push({
          id: `sec-${id++}`,
          category: "risk",
          severity: topPct > 60 || top2Pct > 85 ? "critical" : "warning",
          title: isDualHeavy && sectorSource[1]
            ? `${topPct.toFixed(0)}% ${topSector.name} + ${((sectorSource[1].value / totalValue) * 100).toFixed(0)}% ${sectorSource[1].name}`
            : `${topPct.toFixed(0)}% concentrated in ${topSector.name}`,
          description,
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
        description: `You're spending $${Math.abs(cf.total_income - cf.total_expenses).toFixed(0)}/mo more than you earn. This is unsustainable  - review your budget for cuts.`,
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

  // ── Goal alerts (deadline-aware + projection-based) ──────────────

  if (goals && goals.length > 0) {
    const hasRetirement = goals.some((g) => /retir|pension|fire|independen/i.test(g.name));
    const shortestUrgentHorizon = Math.min(...goals.map((g) => moUntil(g.target_date)));

    for (const g of goals) {
      if (g.target_amount <= 0) continue;
      const pct = (g.current_amount / g.target_amount) * 100;
      const mo = moUntil(g.target_date);
      const monthly = g.monthly_contribution ?? 0;

      // Deadline-urgency severity: escalate based on how late + how far behind
      const deadlineSeverity: AlertSeverity =
        mo < 6 && pct < 80 ? "critical" :
        mo < 12 && pct < 70 ? "critical" :
        mo < 24 && pct < 40 ? "warning" : "info";

      // Goal nearly complete — positive signal
      if (pct >= 90 && pct < 100) {
        alerts.push({
          id: `goal90-${id++}`,
          category: "opportunity",
          severity: "positive",
          title: `"${g.name}" is ${pct.toFixed(0)}% complete`,
          description: `Only $${(g.target_amount - g.current_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} left. One or two extra contributions could close this out.`,
          action: "View Goals",
          link: "/goals",
          icon: Target,
        });
        continue;
      }

      // Projection shortfall: will current trajectory miss the target?
      if (mo > 0 && monthly >= 0) {
        const projected = projectedValue(g.current_amount, monthly, mo);
        const shortfall = g.target_amount - projected;
        if (shortfall > g.target_amount * 0.1) {
          // Projected to miss by >10% of target
          const extraNeeded = shortfall / Math.max(mo, 1);
          alerts.push({
            id: `goalshort-${id++}`,
            category: "planning",
            severity: deadlineSeverity,
            title: `"${g.name}" is on track to fall short`,
            description: `At current contributions, you'll reach ~$${projected.toLocaleString(undefined, { maximumFractionDigits: 0 })} by ${new Date(g.target_date!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}, missing the $${g.target_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} target by $${shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Increase contributions by ~$${extraNeeded.toFixed(0)}/mo.`,
            action: "View Goals",
            link: "/goals",
            icon: Target,
          });
          continue;
        }
      }

      // Goal with no contribution and behind pace
      if (monthly === 0 && pct < 50) {
        alerts.push({
          id: `goalnoc-${id++}`,
          category: "planning",
          severity: mo < 24 ? "warning" : "info",
          title: `"${g.name}" has no monthly contribution`,
          description: `At ${pct.toFixed(0)}% with $0/mo recurring and ${mo} months remaining, this goal will likely stall. Set up automatic contributions.`,
          action: "View Goals",
          link: "/goals",
          icon: Target,
        });
      }
    }

    // Upgrade savings-rate warning severity if goals demand more saving
    // (applied to alerts already pushed above — upgrade the last savings alert)
    if (shortestUrgentHorizon < 24) {
      const savIdx = alerts.findIndex((a) => a.id.startsWith("savlow"));
      if (savIdx >= 0) alerts[savIdx].severity = "critical";
    }

    // Upgrade volatility warning if retirement or long-term goal
    if (hasRetirement) {
      const volIdx = alerts.findIndex((a) => a.id.startsWith("volhi"));
      if (volIdx >= 0 && alerts[volIdx].severity === "warning") {
        alerts[volIdx].severity = "critical";
        alerts[volIdx].description =
          alerts[volIdx].description.replace("If this exceeds your risk tolerance", "With a retirement goal, sustained high volatility compounds sequence-of-returns risk");
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
        action: "Open Reflect",
        link: "/reflect",
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
        active
          ? "bg-vela-teal/20 text-vela-teal border border-vela-teal/30"
          : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-vela-teal/30" : "bg-zinc-700/50"}`}>
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
  const portfolioId = portfolio?.id ?? null;
  const { data: risk, isLoading: rLoading, error: rError } = useRiskMetrics(portfolioId ?? undefined);
  const { breakdown: sectorData, loading: sLoading } = useSectorBreakdown(portfolioId);

  // Sectors data loads separately (yfinance call) — don't block core alerts on it
  const loading = pLoading || nwLoading || cfLoading || gLoading || rLoading;
  const error = pError || nwError || cfError || gError || rError;

  const [activeFilter, setActiveFilter] = useState<AlertCategory | "all">("all");

  // ── AI insight state per-alert ────────────────────────────────────────
  const [insights, setInsights] = useState<Record<string, { text: string; loading: boolean; error?: string }>>({});
  const [insightQuota, setInsightQuota] = useState<{ remaining: number; limit: number } | null>(null);

  const fetchInsight = useCallback(async (alert: SmartAlert) => {
    if (insights[alert.id]?.text || insights[alert.id]?.loading) return; // already loaded/loading
    setInsights((prev) => ({ ...prev, [alert.id]: { text: "", loading: true } }));

    try {
      const res = await apiStreamPost("/ai/alert-insight", {
        alert_title: alert.title,
        alert_description: alert.description,
        alert_category: alert.category,
        alert_severity: alert.severity,
      });

      // Handle rate limit / tier errors before reading body
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const limit = res.headers.get("X-Insight-Limit") ?? "10";
        setInsights((prev) => ({ ...prev, [alert.id]: { text: "", loading: false, error: data.detail ?? `Daily limit of ${limit} insights reached. Resets at midnight.` } }));
        return;
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setInsights((prev) => ({ ...prev, [alert.id]: { text: "", loading: false, error: data.detail ?? "AI insights require Voyager or Navigator plan." } }));
        return;
      }

      // Read quota headers
      const remaining = res.headers.get("X-Insight-Remaining");
      const limit = res.headers.get("X-Insight-Limit");
      if (remaining !== null && limit !== null) {
        setInsightQuota({ remaining: parseInt(remaining), limit: parseInt(limit) });
      }

      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            if (msg.text) setInsights((prev) => ({ ...prev, [alert.id]: { text: (prev[alert.id]?.text ?? "") + msg.text, loading: true } }));
            if (msg.done) setInsights((prev) => ({ ...prev, [alert.id]: { text: prev[alert.id]?.text ?? "", loading: false } }));
            if (msg.error) setInsights((prev) => ({ ...prev, [alert.id]: { text: "", loading: false, error: msg.error } }));
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setInsights((prev) => ({ ...prev, [alert.id]: { text: "", loading: false, error: "Failed to load insight" } }));
    }
  }, [insights]);

  const allAlerts = useMemo(() => {
    if (loading) return [];
    // sectorData may arrive after initial render — regenerate alerts when it does
    return generateAlerts(
      summary ? { total_value: summary.total_value, holdings: summary.holdings } : null,
      nw ?? null,
      cf ?? null,
      goals ?? null,
      risk ?? null,
      sectorData?.sectors ?? null,
    );
  }, [loading, summary, nw, cf, goals, risk, sectorData]);

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Smart Alerts
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Automated insights from your portfolio, net worth, cash flow, and goals
          </p>
        </div>
        {insightQuota && (
          <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1 border border-zinc-800 rounded px-2.5 py-1">
            <Sparkles className="w-3 h-3 text-vela-teal" />
            <span className={insightQuota.remaining <= 2 ? "text-amber-400" : "text-zinc-400"}>
              {insightQuota.remaining}/{insightQuota.limit} AI insights left today
            </span>
          </div>
        )}
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
            const insight = insights[alert.id];
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
                        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded border ${style.border} ${style.iconColor}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{alert.description}</p>

                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        <Link
                          href={alert.link}
                          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-vela-teal transition-colors"
                        >
                          {alert.action} <ArrowRight className="w-3 h-3" />
                        </Link>
                        {/* AI insight button — only if no insight loaded yet */}
                        {!insight?.text && (
                          <button
                            onClick={() => fetchInsight(alert)}
                            disabled={insight?.loading}
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-vela-teal transition-colors disabled:opacity-50"
                          >
                            {insight?.loading
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
                              : <><Sparkles className="w-3 h-3" /> Get AI insight</>
                            }
                          </button>
                        )}
                      </div>

                      {/* Streaming AI insight panel */}
                      {(insight?.text || insight?.error) && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/60">
                          {insight.error ? (
                            <p className="text-xs text-rose-400">{insight.error}</p>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Sparkles className="w-3 h-3 text-vela-teal" />
                                <span className="text-[10px] font-medium text-vela-teal uppercase tracking-wider">Velnor AI</span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {insight.text}
                                {insight.loading && <span className="inline-block w-1 h-3 bg-vela-teal ml-0.5 animate-pulse align-middle" />}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
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
