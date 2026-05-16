/**
 * Smart Alerts — threshold-based notification engine
 *
 * Evaluates user data and produces alerts when notable events occur.
 * All evaluation is client-side, no backend needed.
 */

export type AlertSeverity = "info" | "warning" | "critical" | "positive";
export type AlertCategory = "price" | "portfolio" | "tax" | "goal" | "income" | "risk";

export interface SmartAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  timestamp: number; // Date.now()
  link?: string;
  ticker?: string;
}

export interface AlertInput {
  holdings: {
    ticker: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    dayChangePct: number;
    unrealizedPnlPct: number;
    weight: number;
  }[];
  portfolioValue: number;
  dayChangePct: number;
  unrealizedPnlPct: number;

  dividends?: {
    holdings: {
      ticker: string;
      yield: number;
      exDividendDate: string | null;
    }[];
  };

  tax?: {
    holdings: {
      ticker: string;
      daysHeld: number;
      isLongTerm: boolean;
      daysUntilLongTerm: number | null;
      unrealizedGain: number;
    }[];
    harvestableTotal: number;
  };

  goals?: {
    name: string;
    currentAmount: number;
    targetAmount: number;
  }[];

  netWorth?: {
    netWorth: number;
    totalLiabilities: number;
    totalAssets: number;
  };
}

// ── Alert generators ───────────────────────────────────────────────

function priceAlerts(input: AlertInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();

  for (const h of input.holdings) {
    // Big daily drop
    if (h.dayChangePct <= -5) {
      alerts.push({
        id: `drop-${h.ticker}-${now}`,
        title: `${h.ticker} dropped ${Math.abs(h.dayChangePct).toFixed(1)}% today`,
        message: `Sharp decline in ${h.ticker}. Review if the thesis still holds before reacting.`,
        severity: "warning",
        category: "price",
        timestamp: now,
        link: "/portfolio",
        ticker: h.ticker,
      });
    } else if (h.dayChangePct <= -3) {
      alerts.push({
        id: `dip-${h.ticker}-${now}`,
        title: `${h.ticker} down ${Math.abs(h.dayChangePct).toFixed(1)}% today`,
        message: `Notable decline. Could be a buying opportunity if your thesis is intact.`,
        severity: "info",
        category: "price",
        timestamp: now,
        ticker: h.ticker,
      });
    }

    // Big daily gain
    if (h.dayChangePct >= 8) {
      alerts.push({
        id: `surge-${h.ticker}-${now}`,
        title: `${h.ticker} surged ${h.dayChangePct.toFixed(1)}% today`,
        message: `Unusually large move. Consider if it's news-driven and whether to take some profit.`,
        severity: "positive",
        category: "price",
        timestamp: now,
        ticker: h.ticker,
      });
    }

    // Position underwater significantly
    if (h.unrealizedPnlPct <= -25) {
      alerts.push({
        id: `underwater-${h.ticker}`,
        title: `${h.ticker} is down ${Math.abs(h.unrealizedPnlPct).toFixed(0)}% from cost`,
        message: `Significant unrealized loss. Re-evaluate your original thesis.`,
        severity: "warning",
        category: "portfolio",
        timestamp: now,
        link: "/portfolio",
        ticker: h.ticker,
      });
    }

    // Position up big
    if (h.unrealizedPnlPct >= 100) {
      alerts.push({
        id: `double-${h.ticker}`,
        title: `${h.ticker} has doubled from your cost basis`,
        message: `Up ${h.unrealizedPnlPct.toFixed(0)}%. Some investors take partial profits at this level.`,
        severity: "positive",
        category: "portfolio",
        timestamp: now,
        link: "/portfolio",
        ticker: h.ticker,
      });
    }
  }

  // Portfolio-level daily move
  if (input.dayChangePct <= -3) {
    alerts.push({
      id: `portfolio-drop-${now}`,
      title: `Portfolio down ${Math.abs(input.dayChangePct).toFixed(1)}% today`,
      message: `Broad decline across your holdings. Stay calm and avoid emotional decisions.`,
      severity: "warning",
      category: "portfolio",
      timestamp: now,
      link: "/portfolio",
    });
  }

  return alerts;
}

function taxAlerts(input: AlertInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (!input.tax) return alerts;
  const now = Date.now();

  // LTCG approaching
  for (const h of input.tax.holdings) {
    if (
      !h.isLongTerm &&
      h.daysUntilLongTerm !== null &&
      h.daysUntilLongTerm > 0 &&
      h.daysUntilLongTerm <= 30 &&
      h.unrealizedGain > 0
    ) {
      alerts.push({
        id: `ltcg-soon-${h.ticker}`,
        title: `${h.ticker} reaches long-term status in ${h.daysUntilLongTerm} days`,
        message: `Holding ${h.daysUntilLongTerm} more days qualifies for lower long-term capital gains rates.`,
        severity: "info",
        category: "tax",
        timestamp: now,
        link: "/tax",
        ticker: h.ticker,
      });
    }
  }

  // Harvesting opportunity
  if (input.tax.harvestableTotal > 200) {
    alerts.push({
      id: "harvest-opportunity",
      title: `$${Math.round(input.tax.harvestableTotal).toLocaleString()} in harvestable losses`,
      message: `You could offset gains or up to $3,000 of ordinary income by harvesting losses.`,
      severity: "info",
      category: "tax",
      timestamp: now,
      link: "/tax",
    });
  }

  return alerts;
}

function goalAlerts(input: AlertInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (!input.goals) return alerts;
  const now = Date.now();

  for (const g of input.goals) {
    if (g.targetAmount <= 0) continue;
    const pct = g.currentAmount / g.targetAmount;

    // Goal reached
    if (pct >= 1) {
      alerts.push({
        id: `goal-reached-${g.name}`,
        title: `Goal "${g.name}" is fully funded!`,
        message: `You've reached your target. Time to celebrate or set a new goal.`,
        severity: "positive",
        category: "goal",
        timestamp: now,
        link: "/goals",
      });
    }

    // Goal milestone (75%)
    if (pct >= 0.75 && pct < 1) {
      alerts.push({
        id: `goal-75-${g.name}`,
        title: `"${g.name}" is 75% funded`,
        message: `Almost there! ${(pct * 100).toFixed(0)}% of your ${formatK(g.targetAmount)} target.`,
        severity: "positive",
        category: "goal",
        timestamp: now,
        link: "/goals",
      });
    }
  }

  return alerts;
}

function incomeAlerts(input: AlertInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (!input.dividends) return alerts;
  const now = Date.now();

  for (const h of input.dividends.holdings) {
    // Upcoming ex-dividend
    if (h.exDividendDate) {
      const exDate = new Date(h.exDividendDate);
      const daysUntil = Math.ceil((exDate.getTime() - now) / (1000 * 60 * 60 * 24));
      if (daysUntil > 0 && daysUntil <= 7) {
        alerts.push({
          id: `ex-div-${h.ticker}`,
          title: `${h.ticker} ex-dividend in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
          message: `Buy before the ex-date to receive the next dividend payment.`,
          severity: "info",
          category: "income",
          timestamp: now,
          link: "/dividends",
          ticker: h.ticker,
        });
      }
    }

    // Unusually high yield
    if (h.yield > 0.1) {
      alerts.push({
        id: `high-yield-${h.ticker}`,
        title: `${h.ticker} yield is ${(h.yield * 100).toFixed(1)}%`,
        message: `Yields this high often signal distress. Verify the company's fundamentals.`,
        severity: "warning",
        category: "income",
        timestamp: now,
        link: "/dividends",
        ticker: h.ticker,
      });
    }
  }

  return alerts;
}

function riskAlerts(input: AlertInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();

  // Over-concentration
  const concentrated = input.holdings.filter((h) => h.weight > 0.5);
  for (const h of concentrated) {
    alerts.push({
      id: `concentrated-${h.ticker}`,
      title: `${h.ticker} is ${(h.weight * 100).toFixed(0)}% of your portfolio`,
      message: `More than half your portfolio in one stock. Consider your risk tolerance.`,
      severity: "warning",
      category: "risk",
      timestamp: now,
      link: "/portfolio",
      ticker: h.ticker,
    });
  }

  // Negative net worth
  if (input.netWorth && input.netWorth.netWorth < -10000) {
    alerts.push({
      id: "negative-nw",
      title: `Net worth is ${formatK(input.netWorth.netWorth)}`,
      message: `Liabilities significantly exceed assets. Prioritize debt reduction.`,
      severity: "critical",
      category: "risk",
      timestamp: now,
      link: "/net-worth",
    });
  }

  return alerts;
}

// ── Main evaluator ─────────────────────────────────────────────────

export function evaluateAlerts(input: AlertInput): SmartAlert[] {
  return [
    ...priceAlerts(input),
    ...taxAlerts(input),
    ...goalAlerts(input),
    ...incomeAlerts(input),
    ...riskAlerts(input),
  ].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ── Display helpers ────────────────────────────────────────────────

function formatK(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; icon: string; border: string; text: string }
> = {
  critical: {
    bg: "bg-rose-500/10",
    icon: "🔴",
    border: "border-rose-500/30",
    text: "text-rose-400",
  },
  warning: {
    bg: "bg-amber-500/10",
    icon: "🟡",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  info: {
    bg: "bg-blue-500/10",
    icon: "🔵",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  positive: {
    bg: "bg-emerald-500/10",
    icon: "🟢",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
};

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  price: "Price",
  portfolio: "Portfolio",
  tax: "Tax",
  goal: "Goals",
  income: "Income",
  risk: "Risk",
};
