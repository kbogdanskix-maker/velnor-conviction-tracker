/**
 * Retirement Readiness Calculator
 *
 * Projects whether current savings + contributions will cover retirement.
 * Uses simple compound growth model with configurable assumptions.
 */

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number; // total investable assets (portfolio + retirement accounts)
  monthlyContribution: number;
  expectedReturn: number; // annual, e.g. 0.07 = 7%
  inflationRate: number; // annual, e.g. 0.03 = 3%
  desiredAnnualIncome: number; // in today's dollars
  socialSecurityMonthly: number; // expected monthly SS benefit (today's dollars)
}

export interface RetirementResult {
  /** 0-100 readiness score */
  score: number;
  label: string;
  color: string;

  /** Projected nest egg at retirement (nominal dollars) */
  projectedNestEgg: number;

  /** Amount needed at retirement to fund desired income (nominal) */
  requiredNestEgg: number;

  /** Gap: positive = surplus, negative = shortfall */
  gap: number;

  /** Projected monthly income in retirement (today's dollars) */
  projectedMonthlyIncome: number;

  /** Annual income that nest egg can sustain using 4% rule (today's dollars) */
  sustainableAnnualIncome: number;

  /** Year-by-year projection data for chart */
  projections: YearProjection[];

  /** Insights */
  insights: string[];
}

export interface YearProjection {
  age: number;
  year: number;
  balance: number; // nominal
  contributions: number; // cumulative nominal
  growth: number; // cumulative growth
  phase: "accumulation" | "retirement";
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentSavings,
    monthlyContribution,
    expectedReturn,
    inflationRate,
    desiredAnnualIncome,
    socialSecurityMonthly,
  } = input;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = Math.max(1, lifeExpectancy - retirementAge);
  const realReturn = (1 + expectedReturn) / (1 + inflationRate) - 1;
  const currentYear = new Date().getFullYear();

  // ── Accumulation phase ─────────────────────────────────────────
  const projections: YearProjection[] = [];
  let balance = currentSavings;
  let totalContributions = currentSavings;
  const annualContribution = monthlyContribution * 12;

  for (let y = 0; y <= yearsToRetirement; y++) {
    projections.push({
      age: currentAge + y,
      year: currentYear + y,
      balance: Math.round(balance),
      contributions: Math.round(totalContributions),
      growth: Math.round(balance - totalContributions),
      phase: "accumulation",
    });

    if (y < yearsToRetirement) {
      balance = balance * (1 + expectedReturn) + annualContribution;
      totalContributions += annualContribution;
    }
  }

  const nestEggAtRetirement = balance;

  // ── Required nest egg (using 4% rule, adjusted for inflation) ──
  const ssAnnual = socialSecurityMonthly * 12;
  // What we need from investments (in today's dollars)
  const incomeNeededFromPortfolio = Math.max(0, desiredAnnualIncome - ssAnnual);
  // Inflate to retirement dollars
  const inflatedIncomeNeed =
    incomeNeededFromPortfolio * Math.pow(1 + inflationRate, yearsToRetirement);
  // 4% safe withdrawal rate
  const requiredNestEgg = inflatedIncomeNeed / 0.04;

  // ── Drawdown phase ─────────────────────────────────────────────
  let drawdownBalance = nestEggAtRetirement;
  const annualWithdrawal = nestEggAtRetirement * 0.04; // 4% rule

  for (let y = 1; y <= yearsInRetirement; y++) {
    drawdownBalance = drawdownBalance * (1 + expectedReturn) - annualWithdrawal;
    if (drawdownBalance < 0) drawdownBalance = 0;

    projections.push({
      age: retirementAge + y,
      year: currentYear + yearsToRetirement + y,
      balance: Math.round(drawdownBalance),
      contributions: Math.round(totalContributions),
      growth: Math.round(drawdownBalance - totalContributions),
      phase: "retirement",
    });
  }

  // ── Score calculation ──────────────────────────────────────────
  const gap = nestEggAtRetirement - requiredNestEgg;
  const ratio = requiredNestEgg > 0 ? nestEggAtRetirement / requiredNestEgg : 1;

  let score: number;
  if (ratio >= 1.2) score = 95;
  else if (ratio >= 1.0) score = 80;
  else if (ratio >= 0.75) score = 60;
  else if (ratio >= 0.5) score = 40;
  else if (ratio >= 0.25) score = 20;
  else score = 10;

  // Sustainable income (today's dollars) using 4% rule
  const sustainableAnnualNominal = nestEggAtRetirement * 0.04;
  const sustainableAnnualReal =
    sustainableAnnualNominal / Math.pow(1 + inflationRate, yearsToRetirement);
  const projectedMonthlyIncome = (sustainableAnnualReal + ssAnnual) / 12;

  // ── Insights ───────────────────────────────────────────────────
  const insights: string[] = [];

  if (ratio >= 1) {
    insights.push(
      `Your projected savings should cover your retirement income target with a ${((ratio - 1) * 100).toFixed(0)}% buffer.`,
    );
  } else {
    insights.push(
      `You're projected to reach ${(ratio * 100).toFixed(0)}% of your retirement goal. Consider increasing contributions.`,
    );
  }

  if (monthlyContribution > 0) {
    const targetContrib = monthlyContribution * (1 / Math.max(ratio, 0.1));
    if (ratio < 1 && targetContrib < monthlyContribution * 5) {
      insights.push(
        `Increasing monthly contributions to ~$${Math.round(targetContrib).toLocaleString()} could close the gap.`,
      );
    }
  } else {
    insights.push("You're not making monthly contributions. Even small amounts compound significantly over time.");
  }

  if (yearsToRetirement > 20) {
    insights.push("Time is on your side. Consistent investing over 20+ years benefits enormously from compounding.");
  } else if (yearsToRetirement > 10) {
    insights.push("With 10-20 years to go, stay consistent and consider gradually reducing portfolio risk.");
  } else if (yearsToRetirement > 0) {
    insights.push("With retirement approaching, consider shifting toward more conservative investments.");
  }

  if (socialSecurityMonthly > 0) {
    insights.push(
      `Social Security adds ~$${Math.round(ssAnnual).toLocaleString()}/year to your retirement income.`,
    );
  }

  return {
    score,
    label: labelFromScore(score),
    color: colorFromScore(score),
    projectedNestEgg: Math.round(nestEggAtRetirement),
    requiredNestEgg: Math.round(requiredNestEgg),
    gap: Math.round(gap),
    projectedMonthlyIncome: Math.round(projectedMonthlyIncome),
    sustainableAnnualIncome: Math.round(sustainableAnnualReal),
    projections,
    insights,
  };
}

function labelFromScore(score: number): string {
  if (score >= 80) return "On Track";
  if (score >= 60) return "Getting There";
  if (score >= 40) return "Needs Attention";
  return "Behind";
}

function colorFromScore(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-teal-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export const DEFAULT_INPUT: RetirementInput = {
  currentAge: 30,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentSavings: 0,
  monthlyContribution: 500,
  expectedReturn: 0.07,
  inflationRate: 0.03,
  desiredAnnualIncome: 60000,
  socialSecurityMonthly: 1500,
};
