"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
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
  Wallet,
  Sparkles,
  Loader2,
} from "lucide-react";
import { apiStreamPost } from "@/lib/api";
import { stripAiMarkdown } from "@/lib/formatters";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { useSectorBreakdown, type SectorEntry } from "@/hooks/useSectors";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import Disclaimer from "@/components/shared/Disclaimer";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  PillGroup,
  Panel,
  Eyebrow,
  Prose,
} from "@/components/instrument";

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

/* Severity is semantic: loss / amber / teal / gain. Never decoration. */
const SEVERITY_STYLES: Record<AlertSeverity, { label: string; text: string }> = {
  critical: { label: "Critical", text: "text-loss" },
  warning: { label: "Warning", text: "text-amber-400" },
  info: { label: "Info", text: "text-vela-teal" },
  positive: { label: "Positive", text: "text-gain" },
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
//
// Copy rule: every description is a statement of recorded fact or arithmetic.
// No imperatives, no prescribed action on a specific holding, no judgement of
// whether a position or plan is good. Thresholds, not recommendations.

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
          description: `High concentration in a single position ties a large share of your outcome to one name (idiosyncratic risk). How that sits with you depends on your conviction and risk tolerance.`,
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
          description: `Recorded against the previous close. Single-day moves of this size are usually tied to company news or a market-wide move.`,
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
        description: `${harvestable.length} position${harvestable.length !== 1 ? "s" : ""} carry unrealized losses. Realising them would offset up to ~$${taxSavings.toFixed(0)} of tax at a 22% marginal rate. The 30-day wash sale rule applies to repurchases.`,
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

        // Name the sectors that are absent from the portfolio. Statement of
        // absence only — no sector is being put forward as one to add.
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
        const absentSectors = prioritySectors.filter((s) => missingSectors.includes(s)).slice(0, 3);
        const absenceText = absentSectors.length > 0
          ? `Your portfolio currently records no exposure to ${absentSectors.join(", ")}.`
          : `You hold few of the ${missingSectors.length} other sectors, so your outcome leans heavily on the ones above.`;

        // Build a message that references actual sector names and top-2 if relevant
        let description: string;
        if (isDualHeavy && sectorSource[1]) {
          const sec2 = sectorSource[1];
          const sec2Pct = (sec2.value / totalValue) * 100;
          description = `${topSector.name} (${topPct.toFixed(0)}%) + ${sec2.name} (${sec2Pct.toFixed(0)}%) = ${top2Pct.toFixed(0)}% of your portfolio. A 20% ${topSector.name} correction alone would be ~$${drop20.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${absenceText}`;
        } else {
          description = `$${dollarExposed.toLocaleString(undefined, { maximumFractionDigits: 0 })} rides on ${topSector.name}. A 20% sector downturn is ~$${drop20.toLocaleString(undefined, { maximumFractionDigits: 0 })}; a 30% drop is ~$${drop30.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${absenceText}`;
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
        description: `${dustPositions.map((p) => p.ticker).join(", ")} each sit under 0.5% of your portfolio, so they add line-item complexity without moving your outcome much.`,
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
          description: `Recorded liabilities are ${debtRatio.toFixed(0)}% of recorded assets, so a large share of what you own is financed by debt.`,
          action: "View Net Worth",
          link: "/net-worth",
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
        description: `Recorded liabilities ($${(nw.total_liabilities / 1000).toFixed(1)}K) exceed recorded assets ($${(nw.total_assets / 1000).toFixed(1)}K), so net worth is below zero.`,
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
        description: `Recorded spending runs $${Math.abs(cf.total_income - cf.total_expenses).toFixed(0)}/mo above recorded income.`,
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
        description: `A commonly cited benchmark is 20% of income. Your recorded rate is ${rate.toFixed(0)}%.`,
        action: "View Cash Flow",
        link: "/cash-flow",
        icon: PiggyBank,
      });
    } else if (rate >= 30) {
      alerts.push({
        id: `savhi-${id++}`,
        category: "opportunity",
        severity: "positive",
        title: `Savings rate at ${rate.toFixed(0)}%`,
        description: `Your recorded savings rate sits above the commonly cited 20% benchmark.`,
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
          description: `$${(g.target_amount - g.current_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} remains to reach the target.`,
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
            description: `At current contributions the projection reaches ~$${projected.toLocaleString(undefined, { maximumFractionDigits: 0 })} by ${new Date(g.target_date!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}, $${shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })} below the $${g.target_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} target. Spread over the remaining ${mo} months that gap is ~$${extraNeeded.toFixed(0)}/mo.`,
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
          description: `At ${pct.toFixed(0)}% funded with $0/mo recorded and ${mo} months remaining, the projection does not reach the target.`,
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
          alerts[volIdx].description.replace("Whether that fits depends on your risk tolerance and time horizon.", "With a retirement goal, sustained high volatility raises sequence-of-returns risk as you approach drawdown.");
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
        description: `Your portfolio swings more than the broad market (~15-20%). Whether that fits depends on your risk tolerance and time horizon.`,
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
        description: `${dd.toFixed(0)}% is the largest peak-to-trough decline your portfolio has recorded over the measured period.`,
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
        description: `Over the measured period, the portfolio's risk-adjusted return sits below that of a risk-free asset.`,
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

// ── Main page ─────────────────────────────────────────────────────────

type FilterKey = AlertCategory | "all";

export default function SmartAlertsPage() {
  const { summary, portfolio, loading: pLoading, error: pError } = useDefaultPortfolio();
  const { summary: nw, isLoading: nwLoading, error: nwError } = useNetWorthSummary();
  const { summary: cf, isLoading: cfLoading, error: cfError } = useCashFlowSummary();
  const { goals, isLoading: gLoading, error: gError } = useGoals();
  const portfolioId = portfolio?.id ?? null;
  const { data: risk, isLoading: rLoading, error: rError } = useRiskMetrics(portfolioId ?? undefined);
  const { breakdown: sectorData } = useSectorBreakdown(portfolioId);

  // Sectors data loads separately (yfinance call) — don't block core alerts on it
  const loading = pLoading || nwLoading || cfLoading || gLoading || rLoading;
  const error = pError || nwError || cfError || gError || rError;

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

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
    } catch {
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

  const filterOptions = useMemo(() => {
    const opts: { key: FilterKey; label: string }[] = [{ key: "all", label: `All ${categoryCounts.all}` }];
    for (const cat of ["portfolio", "risk", "planning", "opportunity"] as AlertCategory[]) {
      if (categoryCounts[cat] > 0) {
        opts.push({ key: cat, label: `${CATEGORY_LABELS[cat]} ${categoryCounts[cat]}` });
      }
    }
    return opts;
  }, [categoryCounts]);

  if (error) return <ErrorState message="Failed to load alert data." onRetry={() => window.location.reload()} />;
  if (loading) return <DashboardSkeleton />;

  const sources = [
    { label: "Portfolio", connected: !!summary, count: summary?.holdings.length ?? 0, unit: "holdings" },
    { label: "Net worth", connected: !!nw, count: nw ? 1 : 0, unit: "snapshot" },
    { label: "Cash flow", connected: !!cf, count: cf ? 1 : 0, unit: "snapshot" },
    { label: "Goals", connected: !!goals && goals.length > 0, count: goals?.length ?? 0, unit: "goals" },
    { label: "Risk metrics", connected: !!risk, count: risk ? 1 : 0, unit: "analysis" },
  ];
  const connectedCount = sources.filter((s) => s.connected).length;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Smart Alerts" }]}
        note={`${connectedCount} of ${sources.length} sources scanned · sorted by severity`}
      />

      <PageHero
        title="Smart Alerts"
        meta="Thresholds crossed in your own recorded data"
        figure={allAlerts.length.toLocaleString("en-US")}
        figureSub={allAlerts.length === 1 ? "signal flagged" : "signals flagged"}
        figureSubClass="text-vela-muted"
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Critical"
          value={severityCounts.critical.toLocaleString("en-US")}
          valueClass={severityCounts.critical > 0 ? "text-loss" : "text-zinc-100"}
          sub="highest urgency"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Warning"
          value={severityCounts.warning.toLocaleString("en-US")}
          valueClass={severityCounts.warning > 0 ? "text-amber-400" : "text-zinc-100"}
          sub="worth a look"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Info"
          value={severityCounts.info.toLocaleString("en-US")}
          valueClass={severityCounts.info > 0 ? "text-vela-teal" : "text-zinc-100"}
          sub="context only"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Positive"
          value={severityCounts.positive.toLocaleString("en-US")}
          valueClass={severityCounts.positive > 0 ? "text-gain" : "text-zinc-100"}
          sub="tracking ahead"
          subClass="text-vela-muted"
        />
      </StatStrip>

      {/* ── Alert list ─────────────────────────────────────────────── */}
      <Section
        label="Signals"
        prose="Observations generated from your portfolio, net worth, cash flow, goals, and risk metrics. Thresholds, not recommendations."
        controls={
          insightQuota ? (
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
              <Sparkles className="w-3 h-3 shrink-0 text-vela-teal" />
              <span className={insightQuota.remaining <= 2 ? "text-amber-400" : "text-vela-muted"}>
                {insightQuota.remaining}/{insightQuota.limit} AI insights left today
              </span>
            </p>
          ) : undefined
        }
      >
        <div className="overflow-x-auto pb-1 mb-6">
          <PillGroup
            options={filterOptions}
            value={activeFilter}
            onChange={(k) => setActiveFilter(k === activeFilter && k !== "all" ? "all" : k)}
            ariaLabel="Filter alerts by category"
          />
        </div>

        {filteredAlerts.length === 0 ? (
          <Panel className="px-5 py-12 text-center">
            <Eyebrow>
              {allAlerts.length === 0 ? "Nothing flagged" : "Nothing in this category"}
            </Eyebrow>
            <Prose className="mt-2.5 max-w-[440px] mx-auto">
              {allAlerts.length === 0
                ? "No threshold was crossed in the data you have recorded. New signals appear as that data changes."
                : "Every signal sits in another category. Switch the filter to see them."}
            </Prose>
          </Panel>
        ) : (
          <div>
            {filteredAlerts.map((alert) => {
              const sev = SEVERITY_STYLES[alert.severity];
              const insight = insights[alert.id];
              return (
                <article
                  key={alert.id}
                  className="border-t border-vela-border first:border-t-0 py-5 first:pt-0"
                >
                  <div className="flex gap-3.5">
                    <alert.icon className={`w-4 h-4 shrink-0 mt-1 ${sev.text}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <Eyebrow>{CATEGORY_LABELS[alert.category]}</Eyebrow>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${sev.text}`}
                        >
                          {sev.label}
                        </span>
                      </div>

                      <h3 className="mt-2 text-[15px] font-medium leading-snug text-zinc-100">
                        {alert.title}
                      </h3>
                      <Prose className="mt-1.5 max-w-[680px]">{alert.description}</Prose>

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Link
                          href={alert.link}
                          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider
                            text-vela-muted hover:text-vela-teal transition-colors"
                        >
                          {alert.action} <ArrowRight className="w-3 h-3 shrink-0" />
                        </Link>
                        {!insight?.text && (
                          <button
                            onClick={() => fetchInsight(alert)}
                            disabled={insight?.loading}
                            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider
                              text-vela-muted hover:text-vela-teal transition-colors
                              disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {insight?.loading ? (
                              <>
                                <Loader2 className="w-3 h-3 shrink-0 animate-spin" /> Thinking…
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 shrink-0" /> Get AI insight
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Streaming AI insight panel */}
                      {(insight?.text || insight?.error) && (
                        <div className="mt-4">
                          {insight.error ? (
                            <p className="text-[13px] text-loss">{insight.error}</p>
                          ) : (
                            <Panel className="p-4">
                              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-teal">
                                Velnor AI
                              </p>
                              <p className="mt-2 text-[13.5px] leading-[1.55] text-vela-body whitespace-pre-line">
                                {stripAiMarkdown(insight.text)}
                                {insight.loading && (
                                  <span
                                    aria-hidden="true"
                                    className="inline-block w-1 h-3 bg-vela-teal ml-0.5 align-middle animate-pulse"
                                  />
                                )}
                              </p>
                              {insight.text && <Disclaimer variant="inline" />}
                            </Panel>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Data sources ───────────────────────────────────────────── */}
      <Section
        label="Data sources scanned"
        prose="Signals are only as complete as the data behind them."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-vela-border">
          {sources.map((src) => (
            <div key={src.label} className="border-b border-vela-border sm:border-r sm:last:border-r-0 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`w-[7px] h-[7px] rotate-45 shrink-0 ${src.connected ? "bg-vela-teal" : "bg-vela-border"}`}
                />
                <p className="text-[13px] text-zinc-100 truncate">{src.label}</p>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
                {src.connected ? `${src.count} ${src.unit}` : "not set up"}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </PageTransition>
  );
}
