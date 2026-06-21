/**
 * Financial Stress Index  - composite scoring engine
 *
 * Score: 0 (maximum stress) to 100 (fully healthy)
 * Built from 6 weighted dimensions using real user data.
 */

export interface StressDimension {
  id: string;
  label: string;
  score: number; // 0-100
  weight: number; // how much it contributes to total
  status: "healthy" | "okay" | "warning" | "critical";
  detail: string;
}

export interface StressResult {
  overall: number; // 0-100
  label: string;
  color: string;
  dimensions: StressDimension[];
}

export interface StressInput {
  // Debt
  totalLiabilities: number;
  totalAssets: number;
  netWorth: number;

  // Savings
  savingsRate: number; // percent (e.g. 25 = 25%)
  totalIncome: number;

  // Portfolio
  portfolioValue: number;
  holdings: { ticker: string; weight: number }[];
  dayChangePct: number; // overall portfolio day change %
  unrealizedPnlPct: number; // overall unrealized P&L %

  // Goals
  goals: {
    currentAmount: number;
    targetAmount: number;
    targetDate: string | null;
  }[];

  // Emergency buffer (liquid assets outside portfolio)
  liquidAssets: number; // checking + savings + HYSA
  monthlyExpenses: number;
}

// ── Dimension scorers ──────────────────────────────────────────────

function scoreDebtRatio(input: StressInput): StressDimension {
  const { totalLiabilities, totalAssets } = input;

  let score: number;
  let detail: string;

  if (totalAssets <= 0) {
    score = totalLiabilities > 0 ? 10 : 50;
    detail = totalLiabilities > 0
      ? "No assets tracked but you have liabilities. Add your assets for a better picture."
      : "No financial data yet. Add your assets and liabilities to get started.";
  } else {
    const ratio = totalLiabilities / totalAssets;
    if (ratio <= 0) {
      score = 100;
      detail = "No debt. You're in a strong position.";
    } else if (ratio <= 0.3) {
      score = 85;
      detail = `Debt-to-asset ratio is ${(ratio * 100).toFixed(0)}%. Well within healthy range.`;
    } else if (ratio <= 0.5) {
      score = 65;
      detail = `Debt-to-asset ratio is ${(ratio * 100).toFixed(0)}%. Manageable, but keep an eye on it.`;
    } else if (ratio <= 0.8) {
      score = 40;
      detail = `Debt-to-asset ratio is ${(ratio * 100).toFixed(0)}%. Consider prioritizing debt reduction.`;
    } else if (ratio <= 1.0) {
      score = 20;
      detail = `Debt-to-asset ratio is ${(ratio * 100).toFixed(0)}%. Liabilities are close to total assets.`;
    } else {
      score = 5;
      detail = `Liabilities exceed assets. Focus on high-interest debt first.`;
    }
  }

  return {
    id: "debt",
    label: "Debt Ratio",
    score,
    weight: 0.2,
    status: statusFromScore(score),
    detail,
  };
}

function scoreSavingsRate(input: StressInput): StressDimension {
  const { savingsRate, totalIncome } = input;

  let score: number;
  let detail: string;

  if (totalIncome <= 0) {
    score = 50;
    detail = "No income data. Add your cash flow to unlock this metric.";
  } else if (savingsRate >= 30) {
    score = 100;
    detail = `Saving ${savingsRate.toFixed(0)}% of income. Excellent discipline.`;
  } else if (savingsRate >= 20) {
    score = 80;
    detail = `Saving ${savingsRate.toFixed(0)}% of income. On track for long-term wealth building.`;
  } else if (savingsRate >= 10) {
    score = 55;
    detail = `Saving ${savingsRate.toFixed(0)}% of income. Try to work toward 20%+ over time.`;
  } else if (savingsRate >= 0) {
    score = 30;
    detail = `Saving only ${savingsRate.toFixed(0)}% of income. Look for expenses to cut.`;
  } else {
    score = 5;
    detail = "Spending more than you earn. Review your cash flow for quick wins.";
  }

  return {
    id: "savings",
    label: "Savings Rate",
    score,
    weight: 0.2,
    status: statusFromScore(score),
    detail,
  };
}

function scoreConcentration(input: StressInput): StressDimension {
  const { holdings } = input;

  let score: number;
  let detail: string;

  if (holdings.length === 0) {
    score = 50;
    detail = "No holdings yet. This score improves as you build a diversified portfolio.";
  } else if (holdings.length === 1) {
    score = 15;
    detail = "Only 1 holding. Single-stock risk is very high.";
  } else {
    const maxWeight = Math.max(...holdings.map((h) => h.weight));
    // HHI-inspired: lower concentration = higher score
    if (maxWeight <= 0.15) {
      score = 95;
      detail = `Well diversified. Largest position is ${(maxWeight * 100).toFixed(0)}%.`;
    } else if (maxWeight <= 0.25) {
      score = 80;
      detail = `Reasonably diversified. Largest position is ${(maxWeight * 100).toFixed(0)}%.`;
    } else if (maxWeight <= 0.4) {
      score = 55;
      detail = `Moderately concentrated. Largest position is ${(maxWeight * 100).toFixed(0)}%.`;
    } else if (maxWeight <= 0.6) {
      score = 30;
      detail = `Heavily concentrated. Largest position is ${(maxWeight * 100).toFixed(0)}% of your portfolio.`;
    } else {
      score = 15;
      detail = `Very concentrated. Largest position is ${(maxWeight * 100).toFixed(0)}%. Consider diversifying.`;
    }

    // Bonus for having more holdings
    if (holdings.length >= 10) score = Math.min(100, score + 5);
  }

  return {
    id: "concentration",
    label: "Diversification",
    score,
    weight: 0.15,
    status: statusFromScore(score),
    detail,
  };
}

function scoreEmergencyBuffer(input: StressInput): StressDimension {
  const { liquidAssets, monthlyExpenses } = input;

  let score: number;
  let detail: string;

  if (monthlyExpenses <= 0) {
    score = 50;
    detail = "Add your expenses in Cash Flow to calculate your emergency buffer.";
  } else {
    const months = liquidAssets / monthlyExpenses;
    if (months >= 6) {
      score = 100;
      detail = `${months.toFixed(1)} months of expenses covered. You're well protected.`;
    } else if (months >= 3) {
      score = 70;
      detail = `${months.toFixed(1)} months of expenses covered. Aim for 6 months.`;
    } else if (months >= 1) {
      score = 35;
      detail = `Only ${months.toFixed(1)} months of expenses covered. Build this up as a priority.`;
    } else {
      score = 10;
      detail = "Less than 1 month of expenses in liquid savings. This should be your top priority.";
    }
  }

  return {
    id: "emergency",
    label: "Emergency Buffer",
    score,
    weight: 0.2,
    status: statusFromScore(score),
    detail,
  };
}

function scoreGoalProgress(input: StressInput): StressDimension {
  const { goals } = input;

  let score: number;
  let detail: string;

  if (goals.length === 0) {
    score = 50;
    detail = "No goals set. Define your targets to track progress.";
  } else {
    const now = Date.now();
    const progressScores = goals.map((g) => {
      if (g.targetAmount <= 0) return 50;
      const pct = g.currentAmount / g.targetAmount;
      if (pct >= 1) return 100;

      if (!g.targetDate) return pct * 80; // no deadline, just measure funding %

      const deadline = new Date(g.targetDate).getTime();
      if (deadline <= now) return pct < 1 ? 20 : 100; // past due

      // We don't track a goal's creation date, so we can't honestly establish a
      // pacing window. Score on funding ratio directly (same basis as goals with
      // no deadline) rather than fabricating a fixed window that masks under-funding.
      return pct * 80;
    });

    score = Math.round(progressScores.reduce((a, b) => a + b, 0) / progressScores.length);
    const funded = goals.filter((g) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount).length;
    detail = funded > 0
      ? `${funded} of ${goals.length} goals fully funded. Average progress looks ${score >= 60 ? "good" : "behind schedule"}.`
      : `${goals.length} active goals. ${score >= 60 ? "Generally on track." : "Some goals may need more attention."}`;
  }

  return {
    id: "goals",
    label: "Goal Progress",
    score,
    weight: 0.1,
    status: statusFromScore(score),
    detail,
  };
}

function scorePortfolioHealth(input: StressInput): StressDimension {
  const portfolioValue = Number(input.portfolioValue) || 0;
  const unrealizedPnlPct = Number(input.unrealizedPnlPct) || 0;

  let score: number;
  let detail: string;

  if (portfolioValue <= 0) {
    score = 50;
    detail = "No portfolio value tracked yet.";
  } else {
    // Based on unrealized P&L
    if (unrealizedPnlPct >= 20) {
      score = 95;
      detail = `Portfolio is up ${unrealizedPnlPct.toFixed(1)}% overall. Strong performance.`;
    } else if (unrealizedPnlPct >= 5) {
      score = 80;
      detail = `Portfolio is up ${unrealizedPnlPct.toFixed(1)}% overall. Solid gains.`;
    } else if (unrealizedPnlPct >= -5) {
      score = 60;
      detail = `Portfolio is roughly flat (${unrealizedPnlPct >= 0 ? "+" : ""}${unrealizedPnlPct.toFixed(1)}%). Normal market fluctuation.`;
    } else if (unrealizedPnlPct >= -15) {
      score = 40;
      detail = `Portfolio is down ${Math.abs(unrealizedPnlPct).toFixed(1)}%. Stay focused on fundamentals.`;
    } else {
      score = 20;
      detail = `Portfolio is down ${Math.abs(unrealizedPnlPct).toFixed(1)}%. Avoid panic selling.`;
    }
  }

  return {
    id: "portfolio",
    label: "Portfolio Health",
    score,
    weight: 0.15,
    status: statusFromScore(score),
    detail,
  };
}

// ── Main calculator ────────────────────────────────────────────────

export function calculateStressIndex(input: StressInput): StressResult {
  const dimensions = [
    scoreDebtRatio(input),
    scoreSavingsRate(input),
    scoreConcentration(input),
    scoreEmergencyBuffer(input),
    scoreGoalProgress(input),
    scorePortfolioHealth(input),
  ];

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const overall = Math.round(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight,
  );

  return {
    overall,
    label: labelFromScore(overall),
    color: colorFromScore(overall),
    dimensions,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function statusFromScore(score: number): StressDimension["status"] {
  if (score >= 75) return "healthy";
  if (score >= 50) return "okay";
  if (score >= 25) return "warning";
  return "critical";
}

function labelFromScore(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Needs Work";
  return "High Stress";
}

function colorFromScore(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-teal-400";
  if (score >= 50) return "text-amber-400";
  if (score >= 35) return "text-orange-400";
  return "text-rose-400";
}

export const STATUS_COLORS: Record<StressDimension["status"], string> = {
  healthy: "bg-emerald-400",
  okay: "bg-amber-400",
  warning: "bg-orange-400",
  critical: "bg-rose-400",
};

export const STATUS_BG: Record<StressDimension["status"], string> = {
  healthy: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  okay: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  warning: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  critical: "bg-rose-400/10 text-rose-400 border-rose-400/20",
};
