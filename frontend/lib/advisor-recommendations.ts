/**
 * Maps financial goals and portfolio state to relevant professional qualifications.
 * Each recommendation explains what the professional does and when to seek one.
 *
 * Disclaimer: Vela does not provide financial advice. These are educational pointers.
 */

export interface AdvisorRec {
  title: string;
  credential: string;
  reason: string;
  when: string;
}

interface AdvisorContext {
  goalIcons: string[];         // icons from user's goals (retirement, home, etc.)
  netWorth: number;
  hasPortfolio: boolean;
  totalLiabilities: number;
  savingsRate: number | null;  // percentage or null
  annualDividendIncome: number;
}

const RECS: { match: (ctx: AdvisorContext) => boolean; rec: AdvisorRec }[] = [
  {
    match: (ctx) => ctx.goalIcons.includes("sunset") || ctx.netWorth > 500_000,
    rec: {
      title: "Certified Financial Planner",
      credential: "CFP",
      reason: "Holistic retirement and wealth planning — investment strategy, tax efficiency, estate basics.",
      when: "You have retirement goals or significant assets to manage across accounts.",
    },
  },
  {
    match: (ctx) => ctx.hasPortfolio && ctx.netWorth > 250_000,
    rec: {
      title: "Chartered Financial Analyst",
      credential: "CFA",
      reason: "Deep investment analysis — portfolio construction, asset allocation, risk management.",
      when: "You're actively managing a sizeable portfolio and want institutional-grade insight.",
    },
  },
  {
    match: (ctx) => ctx.annualDividendIncome > 5_000 || ctx.netWorth > 200_000,
    rec: {
      title: "Certified Public Accountant",
      credential: "CPA",
      reason: "Tax optimization — capital gains harvesting, dividend taxation, estimated payments.",
      when: "Your investment income is material or your tax situation is getting complex.",
    },
  },
  {
    match: (ctx) => ctx.goalIcons.includes("home") || ctx.goalIcons.includes("car"),
    rec: {
      title: "Certified Mortgage Advisor",
      credential: "CMA",
      reason: "Loan structuring — rate comparison, pre-approval strategy, refinancing analysis.",
      when: "You're planning a major purchase that involves financing.",
    },
  },
  {
    match: (ctx) => ctx.totalLiabilities > 50_000,
    rec: {
      title: "Accredited Financial Counselor",
      credential: "AFC",
      reason: "Debt management and budgeting — payoff strategy, cash flow planning, financial wellness.",
      when: "You want a structured plan to reduce liabilities and improve cash flow.",
    },
  },
  {
    match: (ctx) => ctx.goalIcons.includes("graduation-cap"),
    rec: {
      title: "College Financial Advisor",
      credential: "529 / FAFSA Specialist",
      reason: "Education funding — 529 plan selection, financial aid strategy, scholarship search.",
      when: "You're saving for education expenses and want to maximize tax advantages.",
    },
  },
  {
    match: (ctx) => ctx.netWorth > 1_000_000,
    rec: {
      title: "Estate Planning Attorney",
      credential: "JD / TEP",
      reason: "Wealth transfer — trusts, wills, power of attorney, estate tax minimization.",
      when: "Your net worth warrants succession planning to protect your family.",
    },
  },
  {
    match: (ctx) => ctx.goalIcons.includes("shield") || (ctx.savingsRate !== null && ctx.savingsRate < 10),
    rec: {
      title: "Certified Financial Counselor",
      credential: "CFC",
      reason: "Financial foundations — emergency fund sizing, insurance review, basic budgeting.",
      when: "You're building your safety net or want help with foundational money habits.",
    },
  },
];

export function getAdvisorRecommendations(ctx: AdvisorContext): AdvisorRec[] {
  const matched = RECS.filter((r) => r.match(ctx)).map((r) => r.rec);
  // Deduplicate by credential, keep first match (higher priority)
  const seen = new Set<string>();
  return matched.filter((r) => {
    if (seen.has(r.credential)) return false;
    seen.add(r.credential);
    return true;
  }).slice(0, 3); // Max 3 recommendations
}
