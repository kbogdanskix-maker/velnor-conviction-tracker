/**
 * Anonymous Benchmarking
 *
 * Compares user metrics against published national averages and
 * age-based financial norms, adjusted for risk tolerance, income
 * level, and career stage.
 *
 * Sources: Federal Reserve SCF, BLS, Fidelity, Vanguard studies.
 * All data is approximate and for educational comparison only.
 */

// ── Risk Profile ─────────────────────────────────────────────────────────────

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type CareerStage = "early" | "mid" | "established" | "pre-retirement" | "retired";
export type IncomeLevel = "low" | "moderate" | "high" | "very-high";

export interface RiskProfile {
  riskTolerance: RiskTolerance;
  careerStage: CareerStage;
  incomeLevel: IncomeLevel;
  hasEmergencyFund: boolean;
  hasDependents: boolean;
  hasStableIncome: boolean;
}

export const DEFAULT_PROFILE: RiskProfile = {
  riskTolerance: "moderate",
  careerStage: "early",
  incomeLevel: "moderate",
  hasEmergencyFund: false,
  hasDependents: false,
  hasStableIncome: true,
};

// Profile-adjusted multipliers for recommended thresholds
function getProfileAdjustments(profile: RiskProfile & { portfolioSmall?: boolean }) {
  // Savings rate target: conservative saves more, high income can save more
  let savingsTarget = 0.15; // 15% baseline recommended
  if (profile.incomeLevel === "high" || profile.incomeLevel === "very-high") savingsTarget = 0.25;
  if (profile.incomeLevel === "low") savingsTarget = 0.08;
  if (profile.careerStage === "early") savingsTarget *= 0.9; // slightly lower early career
  if (profile.careerStage === "pre-retirement") savingsTarget *= 1.2; // save more before retirement
  if (profile.hasDependents) savingsTarget *= 0.85; // dependents reduce savings capacity

  // Max concentration: aggressive can tolerate more, conservative less
  let maxConcentration = 0.10; // 10% baseline
  if (profile.riskTolerance === "aggressive") maxConcentration = 0.20;
  if (profile.riskTolerance === "conservative") maxConcentration = 0.07;
  if (profile.careerStage === "pre-retirement" || profile.careerStage === "retired") {
    maxConcentration *= 0.7; // reduce concentration near/in retirement
  }

  // Target debt ratio: stricter for conservative, looser early career
  let debtThreshold = 0.30; // 30% baseline
  if (profile.riskTolerance === "conservative") debtThreshold = 0.20;
  if (profile.riskTolerance === "aggressive") debtThreshold = 0.40;
  if (profile.careerStage === "early") debtThreshold = 0.45; // student loans etc
  if (profile.careerStage === "retired") debtThreshold = 0.15;

  // Investment ratio target
  let investTarget = 0.40;
  if (profile.riskTolerance === "aggressive") investTarget = 0.55;
  if (profile.riskTolerance === "conservative") investTarget = 0.30;
  if (profile.careerStage === "early") investTarget = 0.25;
  if (profile.careerStage === "retired") investTarget = 0.50;

  // Holdings count target
  let holdingsTarget = 10;
  if (profile.riskTolerance === "aggressive") holdingsTarget = 6; // concentrated bets ok
  if (profile.riskTolerance === "conservative") holdingsTarget = 15; // more diversification
  if (profile.portfolioSmall) holdingsTarget = Math.max(holdingsTarget - 3, 3);

  // Emergency fund months
  let emergencyMonths = 6;
  if (profile.hasStableIncome) emergencyMonths = 4;
  if (!profile.hasStableIncome) emergencyMonths = 9;
  if (profile.hasDependents) emergencyMonths += 2;

  return {
    savingsTarget,
    maxConcentration,
    debtThreshold,
    investTarget,
    holdingsTarget,
    emergencyMonths,
  };
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface BenchmarkInput {
  age: number;
  netWorth: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  savingsRate: number | null; // 0-1
  portfolioValue: number;
  numHoldings: number;
  topHoldingWeight: number; // 0-1
  dividendYield: number | null;
  totalIncome: number | null; // monthly
  totalExpenses: number | null; // monthly
  profile: RiskProfile;
}

export interface BenchmarkMetric {
  id: string;
  label: string;
  userValue: number | null;
  benchmarkValue: number;
  benchmarkLabel: string;
  unit: "currency" | "percent" | "number" | "ratio";
  higherIsBetter: boolean;
  percentile: number | null;
  insight: string;
  personalized: boolean; // true if adjusted for profile
}

export interface BenchmarkResult {
  metrics: BenchmarkMetric[];
  overallPercentile: number;
  ageGroup: string;
  profileSummary: string;
}

// ── Age-based median net worth (Fed SCF 2022, inflation-adjusted) ─────────

const NET_WORTH_BY_AGE: Record<string, number> = {
  "Under 25": 10400,
  "25-34": 39000,
  "35-44": 135600,
  "45-54": 247200,
  "55-64": 364500,
  "65-74": 410000,
  "75+": 335600,
};

// Income-adjusted net worth multipliers
const INCOME_NW_MULTIPLIER: Record<IncomeLevel, number> = {
  "low": 0.6,
  "moderate": 1.0,
  "high": 2.0,
  "very-high": 3.5,
};

function getAgeGroup(age: number): string {
  if (age < 25) return "Under 25";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  if (age < 75) return "65-74";
  return "75+";
}

function getCareerStageFromAge(age: number): CareerStage {
  if (age < 28) return "early";
  if (age < 40) return "mid";
  if (age < 55) return "established";
  if (age < 65) return "pre-retirement";
  return "retired";
}

function getIncomeLevelFromMonthly(monthly: number | null): IncomeLevel {
  if (!monthly || monthly <= 0) return "moderate";
  const annual = monthly * 12;
  if (annual < 40000) return "low";
  if (annual < 80000) return "moderate";
  if (annual < 150000) return "high";
  return "very-high";
}

function estimatePercentile(userVal: number, medianVal: number, higherIsBetter: boolean): number {
  if (medianVal === 0) return 50;
  const ratio = userVal / medianVal;
  let pct: number;
  if (ratio <= 0) pct = 5;
  else if (ratio < 0.25) pct = 15;
  else if (ratio < 0.5) pct = 25;
  else if (ratio < 0.75) pct = 35;
  else if (ratio < 1.0) pct = 45;
  else if (ratio < 1.5) pct = 60;
  else if (ratio < 2.0) pct = 70;
  else if (ratio < 3.0) pct = 80;
  else if (ratio < 5.0) pct = 90;
  else pct = 95;

  return higherIsBetter ? pct : 100 - pct;
}

function buildProfileSummary(profile: RiskProfile, ageGroup: string): string {
  const parts: string[] = [];
  parts.push(`${ageGroup} age group`);
  parts.push(`${profile.riskTolerance} risk tolerance`);
  parts.push(`${profile.incomeLevel} income`);
  if (profile.hasDependents) parts.push("with dependents");
  if (!profile.hasStableIncome) parts.push("variable income");
  return parts.join(" / ");
}

// ── Calculator ───────────────────────────────────────────────────────────────

export function calculateBenchmarks(input: BenchmarkInput): BenchmarkResult {
  const ageGroup = getAgeGroup(input.age);
  const profile = {
    ...input.profile,
    portfolioSmall: input.portfolioValue < 10000,
  };
  const adj = getProfileAdjustments(profile as any);

  // Income-adjusted net worth benchmark
  const baseNW = NET_WORTH_BY_AGE[ageGroup] ?? 100000;
  const incomeMultiplier = INCOME_NW_MULTIPLIER[input.profile.incomeLevel];
  const adjustedNW = Math.round(baseNW * incomeMultiplier);

  const metrics: BenchmarkMetric[] = [];

  // 1. Net Worth (income-adjusted)
  if (input.netWorth !== null) {
    const pct = estimatePercentile(input.netWorth, adjustedNW, true);
    const isAbove = input.netWorth >= adjustedNW;
    metrics.push({
      id: "net-worth",
      label: "Net Worth",
      userValue: input.netWorth,
      benchmarkValue: adjustedNW,
      benchmarkLabel: `Adjusted for ${ageGroup} + ${input.profile.incomeLevel} income`,
      unit: "currency",
      higherIsBetter: true,
      percentile: pct,
      personalized: true,
      insight: isAbove
        ? `Your net worth exceeds the adjusted benchmark for your age and income level.`
        : input.profile.careerStage === "early"
          ? `Below the adjusted benchmark, but you're early in your career. Consistent saving will close this gap.`
          : `Below the adjusted benchmark. Focus on increasing savings and managing debt.`,
    });
  }

  // 2. Savings Rate (profile-adjusted target)
  if (input.savingsRate !== null) {
    const target = adj.savingsTarget;
    const pct = estimatePercentile(input.savingsRate, target, true);
    metrics.push({
      id: "savings-rate",
      label: "Savings Rate",
      userValue: input.savingsRate * 100,
      benchmarkValue: target * 100,
      benchmarkLabel: `Benchmark for your profile`,
      unit: "percent",
      higherIsBetter: true,
      percentile: pct,
      personalized: true,
      insight: input.savingsRate >= target
        ? `At or above the ${(target * 100).toFixed(0)}% savings benchmark for your income and situation.`
        : input.savingsRate >= target * 0.5
          ? `Below the ${(target * 100).toFixed(0)}% savings benchmark for your profile.`
          : `Well below the ${(target * 100).toFixed(0)}% savings benchmark for your profile.`,
    });
  }

  // 3. Holdings Count (risk-adjusted)
  if (input.numHoldings > 0) {
    const target = adj.holdingsTarget;
    const pct = estimatePercentile(input.numHoldings, target, true);
    metrics.push({
      id: "diversification",
      label: "Holdings Count",
      userValue: input.numHoldings,
      benchmarkValue: target,
      benchmarkLabel: input.profile.riskTolerance === "aggressive"
        ? "Adjusted (aggressive: fewer, deeper)"
        : input.profile.riskTolerance === "conservative"
          ? "Adjusted (conservative: more spread)"
          : "Benchmark diversification",
      unit: "number",
      higherIsBetter: true,
      percentile: Math.min(pct, 90),
      personalized: true,
      insight: input.numHoldings >= target
        ? `Good diversification for your ${input.profile.riskTolerance} risk tolerance.`
        : `You hold ${input.numHoldings}. A ${input.profile.riskTolerance} profile is commonly spread across ~${target} holdings.`,
    });
  }

  // 4. Top holding concentration (risk-adjusted)
  if (input.topHoldingWeight > 0) {
    const target = adj.maxConcentration;
    const invPct = estimatePercentile(input.topHoldingWeight, target, false);
    metrics.push({
      id: "concentration",
      label: "Largest Position",
      userValue: input.topHoldingWeight * 100,
      benchmarkValue: target * 100,
      benchmarkLabel: `Max for ${input.profile.riskTolerance} profile`,
      unit: "percent",
      higherIsBetter: false,
      percentile: invPct,
      personalized: true,
      insight: input.topHoldingWeight <= target
        ? `Within the ${(target * 100).toFixed(0)}% concentration benchmark for your risk tolerance.`
        : input.profile.riskTolerance === "aggressive"
          ? `Above the ${(target * 100).toFixed(0)}% benchmark, high even for an aggressive profile.`
          : `Largest position is above the ${(target * 100).toFixed(0)}% benchmark for your profile.`,
    });
  }

  // 5. Debt-to-Asset Ratio (profile-adjusted)
  if (input.totalAssets !== null && input.totalLiabilities !== null && input.totalAssets > 0) {
    const ratio = input.totalLiabilities / input.totalAssets;
    const target = adj.debtThreshold;
    const pct = estimatePercentile(ratio, target, false);
    metrics.push({
      id: "debt-ratio",
      label: "Debt-to-Asset Ratio",
      userValue: ratio * 100,
      benchmarkValue: target * 100,
      benchmarkLabel: input.profile.careerStage === "early"
        ? "Adjusted (early career: student debt expected)"
        : `Threshold for ${input.profile.riskTolerance} profile`,
      unit: "percent",
      higherIsBetter: false,
      percentile: pct,
      personalized: true,
      insight: ratio <= target * 0.5
        ? "Very healthy debt levels relative to your profile."
        : ratio <= target
          ? `Manageable debt for your ${input.profile.careerStage} career stage.`
          : `Debt is above the ${(target * 100).toFixed(0)}% threshold for your profile.`,
    });
  }

  // 6. Investment ratio (profile-adjusted)
  if (input.netWorth !== null && input.netWorth > 0) {
    const investPct = input.portfolioValue / input.netWorth;
    const target = adj.investTarget;
    const pct = estimatePercentile(investPct, target, true);
    metrics.push({
      id: "investment-ratio",
      label: "Invested Assets Ratio",
      userValue: investPct * 100,
      benchmarkValue: target * 100,
      benchmarkLabel: `Target for ${input.profile.riskTolerance} / ${input.profile.careerStage}`,
      unit: "percent",
      higherIsBetter: true,
      percentile: Math.min(pct, 95),
      personalized: true,
      insight: investPct >= target
        ? `At or above the invested-share benchmark for your profile.`
        : `Below the invested-share benchmark for your ${input.profile.riskTolerance} risk tolerance.`,
    });
  }

  // 7. Emergency Fund (new, profile-adjusted)
  if (input.totalExpenses !== null && input.totalExpenses > 0 && input.totalAssets !== null) {
    // Estimate liquid savings as totalAssets - portfolioValue (rough proxy)
    const liquidSavings = Math.max(0, (input.totalAssets ?? 0) - input.portfolioValue);
    const monthsCovered = liquidSavings / input.totalExpenses;
    const target = adj.emergencyMonths;
    const pct = estimatePercentile(monthsCovered, target, true);

    metrics.push({
      id: "emergency-fund",
      label: "Emergency Fund",
      userValue: Math.round(monthsCovered * 10) / 10,
      benchmarkValue: target,
      benchmarkLabel: input.profile.hasStableIncome
        ? `${target} months (stable income)`
        : `${target} months (variable income)`,
      unit: "number",
      higherIsBetter: true,
      percentile: pct,
      personalized: true,
      insight: monthsCovered >= target
        ? `${monthsCovered.toFixed(1)} months of expenses covered, at or above the ${target}-month benchmark.`
        : monthsCovered >= target * 0.5
          ? `${monthsCovered.toFixed(1)} of ${target} benchmark months covered${!input.profile.hasStableIncome ? ", against variable income" : ""}.`
          : `${monthsCovered.toFixed(1)} of ${target} benchmark months covered.`,
    });
  }

  // Overall percentile
  const validPcts = metrics.filter((m) => m.percentile !== null).map((m) => m.percentile!);
  const overallPercentile = validPcts.length > 0
    ? Math.round(validPcts.reduce((s, p) => s + p, 0) / validPcts.length)
    : 50;

  return {
    metrics,
    overallPercentile,
    ageGroup,
    profileSummary: buildProfileSummary(input.profile, ageGroup),
  };
}
