/**
 * Fee Analyzer
 *
 * Calculates the long-term cost of investment fees (expense ratios).
 * Shows how fees compound to eat into portfolio returns over time,
 * and compares high-fee funds against low-cost alternatives.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeeHolding {
  ticker: string;
  marketValue: number;
  expenseRatio: number; // 0-1 (e.g. 0.0075 = 0.75%)
  isETF: boolean;
}

export interface FeeProjectionYear {
  year: number;
  withCurrentFees: number;
  withLowFees: number;
  feeDrag: number; // cumulative $ lost to fees vs low-cost
}

export interface HoldingFeeDetail {
  ticker: string;
  marketValue: number;
  expenseRatio: number;
  annualFeeDollars: number;
  tenYearDrag: number; // $ lost over 10yr assuming 8% returns
  isETF: boolean;
  costTier: "low" | "moderate" | "high" | "very-high";
}

export interface FeeAnalysisResult {
  holdings: HoldingFeeDetail[];
  portfolioValue: number;
  weightedExpenseRatio: number; // portfolio-level blended ER
  totalAnnualFees: number;
  tenYearFeeDrag: number;
  thirtyYearFeeDrag: number;
  projection: FeeProjectionYear[];
  lowCostER: number; // benchmark low-cost ER
  potentialSavings10yr: number;
  potentialSavings30yr: number;
  feeGrade: "A" | "B" | "C" | "D" | "F";
  feeGradeLabel: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LOW_COST_BENCHMARK = 0.0003; // 0.03% - Vanguard VTI / VOO level
const ASSUMED_RETURN = 0.08; // 8% annual return assumption

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCostTier(er: number): "low" | "moderate" | "high" | "very-high" {
  if (er <= 0.002) return "low";        // ≤ 0.20%
  if (er <= 0.005) return "moderate";   // 0.20% – 0.50%
  if (er <= 0.01) return "high";        // 0.50% – 1.00%
  return "very-high";                    // > 1.00%
}

function getFeeGrade(weightedER: number): { grade: "A" | "B" | "C" | "D" | "F"; label: string } {
  if (weightedER <= 0.001) return { grade: "A", label: "Excellent" };
  if (weightedER <= 0.003) return { grade: "B", label: "Good" };
  if (weightedER <= 0.006) return { grade: "C", label: "Fair" };
  if (weightedER <= 0.01) return { grade: "D", label: "Expensive" };
  return { grade: "F", label: "Very Expensive" };
}

/**
 * Project portfolio value over years with a given expense ratio.
 * Net return each year = grossReturn - expenseRatio
 */
function projectValue(initial: number, years: number, expenseRatio: number): number {
  const netReturn = ASSUMED_RETURN - expenseRatio;
  return initial * Math.pow(1 + netReturn, years);
}

// ── Calculator ───────────────────────────────────────────────────────────────

export function analyzeFees(holdings: FeeHolding[]): FeeAnalysisResult {
  const portfolioValue = holdings.reduce((s, h) => s + h.marketValue, 0);

  if (portfolioValue <= 0 || holdings.length === 0) {
    return {
      holdings: [],
      portfolioValue: 0,
      weightedExpenseRatio: 0,
      totalAnnualFees: 0,
      tenYearFeeDrag: 0,
      thirtyYearFeeDrag: 0,
      projection: [],
      lowCostER: LOW_COST_BENCHMARK,
      potentialSavings10yr: 0,
      potentialSavings30yr: 0,
      feeGrade: "A",
      feeGradeLabel: "No holdings",
    };
  }

  // Per-holding analysis
  const holdingDetails: HoldingFeeDetail[] = holdings.map((h) => {
    const annualFeeDollars = h.marketValue * h.expenseRatio;
    const futureWithFee = projectValue(h.marketValue, 10, h.expenseRatio);
    const futureNoFee = projectValue(h.marketValue, 10, 0);
    const tenYearDrag = futureNoFee - futureWithFee;

    return {
      ticker: h.ticker,
      marketValue: h.marketValue,
      expenseRatio: h.expenseRatio,
      annualFeeDollars,
      tenYearDrag,
      isETF: h.isETF,
      costTier: getCostTier(h.expenseRatio),
    };
  });

  // Sort by annual fees descending
  holdingDetails.sort((a, b) => b.annualFeeDollars - a.annualFeeDollars);

  // Portfolio-level weighted expense ratio
  const weightedExpenseRatio = portfolioValue > 0
    ? holdings.reduce(
        (s, h) => s + h.expenseRatio * (h.marketValue / portfolioValue),
        0
      )
    : 0;

  const totalAnnualFees = portfolioValue * weightedExpenseRatio;

  // 30-year projection: current fees vs low-cost benchmark
  const projection: FeeProjectionYear[] = [];
  for (let year = 0; year <= 30; year++) {
    const withCurrentFees = projectValue(portfolioValue, year, weightedExpenseRatio);
    const withLowFees = projectValue(portfolioValue, year, LOW_COST_BENCHMARK);
    projection.push({
      year,
      withCurrentFees: Math.round(withCurrentFees),
      withLowFees: Math.round(withLowFees),
      feeDrag: Math.round(withLowFees - withCurrentFees),
    });
  }

  const tenYearFeeDrag = projection[10]?.feeDrag ?? 0;
  const thirtyYearFeeDrag = projection[30]?.feeDrag ?? 0;

  const { grade, label } = getFeeGrade(weightedExpenseRatio);

  return {
    holdings: holdingDetails,
    portfolioValue,
    weightedExpenseRatio,
    totalAnnualFees,
    tenYearFeeDrag,
    thirtyYearFeeDrag,
    projection,
    lowCostER: LOW_COST_BENCHMARK,
    potentialSavings10yr: tenYearFeeDrag,
    potentialSavings30yr: thirtyYearFeeDrag,
    feeGrade: grade,
    feeGradeLabel: label,
  };
}

// ── Common ETF expense ratios (for auto-fill) ────────────────────────────────

export const KNOWN_EXPENSE_RATIOS: Record<string, number> = {
  // Vanguard
  VOO: 0.0003, VTI: 0.0003, VXUS: 0.0007, VGT: 0.001,
  VIG: 0.0006, VYM: 0.0006, VNQ: 0.0012, BND: 0.0003,
  VOOG: 0.001, VOOV: 0.001, VT: 0.0007, VEA: 0.0005,
  VWO: 0.0008, VTIP: 0.0004, VGSH: 0.0004,
  // iShares
  IVV: 0.0003, IWM: 0.0019, IWF: 0.0019, IWD: 0.0019,
  AGG: 0.0003, EFA: 0.0032, EEM: 0.0068, HYG: 0.0049,
  LQD: 0.0014, TIP: 0.0019, IJR: 0.0006, IJH: 0.0005,
  IYR: 0.0039, IEMG: 0.0009,
  // SPDR
  SPY: 0.0009, QQQ: 0.002, DIA: 0.0016, GLD: 0.004,
  XLF: 0.0009, XLK: 0.0009, XLE: 0.0009, XLV: 0.0009,
  XLI: 0.0009, XLP: 0.0009, XLU: 0.0009, XLY: 0.0009,
  MDY: 0.0023,
  // Schwab
  SCHD: 0.0006, SCHX: 0.0003, SCHB: 0.0003, SCHF: 0.0006,
  SCHE: 0.0011, SCHG: 0.0004,
  // ARK
  ARKK: 0.0075, ARKW: 0.0088, ARKG: 0.0075, ARKF: 0.0075,
  ARKQ: 0.0075,
  // Other popular
  JEPI: 0.0035, JEPQ: 0.0035, COWZ: 0.0049, DIVO: 0.0055,
  QYLD: 0.006, RYLD: 0.006, XYLD: 0.006,
};

/** Try to look up an expense ratio for a ticker. Returns null if unknown. */
export function lookupExpenseRatio(ticker: string): number | null {
  return KNOWN_EXPENSE_RATIOS[ticker.toUpperCase()] ?? null;
}
