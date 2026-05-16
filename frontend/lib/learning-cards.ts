/**
 * Contextual Learning Cards — definitions & trigger logic
 *
 * Each card has:
 *  - id:        unique key (also used for dismiss persistence)
 *  - title:     short headline
 *  - body:      1-2 sentence educational explanation
 *  - category:  grouping for /learn page
 *  - trigger:   function that returns true when the card is relevant
 *  - link?:     optional internal route for deeper content
 *  - priority:  higher = shown first (1-10)
 */

// ── Context shape passed to trigger functions ──────────────────────

export interface CardContext {
  /** Portfolio holdings with enriched data */
  holdings: {
    ticker: string;
    shares: number;
    avg_cost: number;
    current_price: number;
    market_value: number;
    weight: number; // 0-1
    gain_pct: number; // e.g. 0.15 = +15%
    loss_pct: number; // e.g. -0.08 = -8%
  }[];

  /** Dividend data (optional) */
  dividends?: {
    total_annual_income: number;
    portfolio_yield: number; // 0-1
    holdings: {
      ticker: string;
      yield: number;
      payout_ratio: number | null;
    }[];
  };

  /** Tax data (optional) */
  tax?: {
    short_term_gains: number;
    long_term_gains: number;
    harvestable_losses: number;
    holdings: {
      ticker: string;
      days_held: number;
      is_long_term: boolean;
      days_until_long_term: number | null;
      unrealized_gain: number;
    }[];
  };

  /** Net worth (optional) */
  netWorth?: {
    net_worth: number;
    total_assets: number;
    total_liabilities: number;
  };

  /** Cash flow (optional) */
  cashFlow?: {
    savings_rate: number; // percent
    total_income: number;
    savings: number;
  };

  /** Goals (optional) */
  goals?: {
    name: string;
    current_amount: number;
    target_amount: number;
    target_date: string | null;
  }[];

  /** Total portfolio value */
  portfolioValue: number;
}

// ── Card type ──────────────────────────────────────────────────────

export type CardCategory =
  | "portfolio"
  | "tax"
  | "income"
  | "risk"
  | "planning"
  | "fundamentals";

export interface LearningCard {
  id: string;
  title: string;
  body: string;
  category: CardCategory;
  priority: number;
  trigger: (ctx: CardContext) => boolean;
  link?: string;
  emoji?: string;
}

// ── Card Definitions ───────────────────────────────────────────────

export const LEARNING_CARDS: LearningCard[] = [
  // ── PORTFOLIO ────────────────────────────────────────────────────

  {
    id: "concentration-risk",
    title: "Concentration Risk",
    body: "One of your holdings makes up over 40% of your portfolio. Concentrated positions amplify both gains and losses, so it's worth checking if this fits your risk tolerance.",
    category: "portfolio",
    priority: 9,
    emoji: "⚖️",
    link: "/portfolio",
    trigger: (ctx) => ctx.holdings.some((h) => h.weight > 0.4),
  },
  {
    id: "diversification-101",
    title: "Why Diversify?",
    body: "Your portfolio has fewer than 5 holdings. Spreading across more stocks, sectors, or asset classes can reduce the impact of any single investment's decline.",
    category: "portfolio",
    priority: 7,
    emoji: "🧩",
    link: "/portfolio",
    trigger: (ctx) => ctx.holdings.length > 0 && ctx.holdings.length < 5,
  },
  {
    id: "big-winner",
    title: "Riding a Winner",
    body: "One of your positions is up over 50%. While momentum can continue, consider whether to rebalance or set a trailing stop to lock in some gains.",
    category: "portfolio",
    priority: 6,
    emoji: "🚀",
    trigger: (ctx) => ctx.holdings.some((h) => h.gain_pct > 0.5),
  },
  {
    id: "significant-loss",
    title: "Dealing With Losses",
    body: "A position is down more than 20%. Before selling, evaluate if the thesis still holds. Selling purely on emotion often locks in losses at the worst time.",
    category: "portfolio",
    priority: 7,
    emoji: "🛟",
    trigger: (ctx) => ctx.holdings.some((h) => h.loss_pct < -0.2),
  },
  {
    id: "position-sizing",
    title: "Position Sizing Matters",
    body: "Your smallest position is less than 2% of your portfolio. Very small positions barely move the needle on returns. Consider concentrating into your highest-conviction ideas.",
    category: "portfolio",
    priority: 4,
    emoji: "📐",
    trigger: (ctx) =>
      ctx.holdings.length > 5 && ctx.holdings.some((h) => h.weight < 0.02),
  },

  // ── TAX ──────────────────────────────────────────────────────────

  {
    id: "ltcg-approaching",
    title: "Long-Term Threshold Approaching",
    body: "A holding is approaching 1 year. Gains on shares held over 365 days are taxed at the lower long-term capital gains rate (0-20%) instead of your ordinary income rate.",
    category: "tax",
    priority: 9,
    emoji: "⏳",
    link: "/tax",
    trigger: (ctx) =>
      !!ctx.tax &&
      ctx.tax.holdings.some(
        (h) =>
          !h.is_long_term &&
          h.days_until_long_term !== null &&
          h.days_until_long_term > 0 &&
          h.days_until_long_term <= 60 &&
          h.unrealized_gain > 0,
      ),
  },
  {
    id: "tax-loss-harvesting",
    title: "Tax-Loss Harvesting Opportunity",
    body: "You have positions with unrealized losses. Selling them could offset up to $3,000 of ordinary income per year, plus unlimited capital gains. Just watch the 30-day wash sale rule!",
    category: "tax",
    priority: 8,
    emoji: "🌾",
    link: "/tax",
    trigger: (ctx) => !!ctx.tax && ctx.tax.harvestable_losses > 50,
  },
  {
    id: "short-term-gains-warning",
    title: "Short-Term Gains Tax Impact",
    body: "You have short-term unrealized gains. If you sell within a year, these get taxed as ordinary income (potentially 22-37%). Holding longer may save you significantly.",
    category: "tax",
    priority: 7,
    emoji: "💸",
    link: "/tax",
    trigger: (ctx) => !!ctx.tax && ctx.tax.short_term_gains > 500,
  },

  // ── INCOME ───────────────────────────────────────────────────────

  {
    id: "high-yield-warning",
    title: "High Yield? Check Twice",
    body: "A holding yields over 8%. Unusually high yields can signal a company in distress, where the price dropped and inflated the yield. Always verify the payout ratio and business health.",
    category: "income",
    priority: 8,
    emoji: "🚩",
    link: "/dividends",
    trigger: (ctx) =>
      !!ctx.dividends && ctx.dividends.holdings.some((h) => h.yield > 0.08),
  },
  {
    id: "payout-ratio-high",
    title: "Unsustainable Payout Ratio",
    body: "A stock is paying out over 90% of its earnings as dividends. This leaves little room for reinvestment or growth, and the dividend may be at risk of a cut.",
    category: "income",
    priority: 7,
    emoji: "🪫",
    link: "/dividends",
    trigger: (ctx) =>
      !!ctx.dividends &&
      ctx.dividends.holdings.some(
        (h) => h.payout_ratio !== null && h.payout_ratio > 0.9,
      ),
  },
  {
    id: "dividend-income-101",
    title: "Your Portfolio Generates Income",
    body: "Your holdings produce dividend income. You can reinvest dividends for compounding or use them as passive income. Both are valid strategies depending on your goals.",
    category: "income",
    priority: 3,
    emoji: "💰",
    link: "/dividends",
    trigger: (ctx) =>
      !!ctx.dividends && ctx.dividends.total_annual_income > 0,
  },

  // ── RISK ─────────────────────────────────────────────────────────

  {
    id: "all-eggs-one-basket",
    title: "Single Stock Risk",
    body: "With only one holding, your portfolio's fate is tied to a single company. Even great companies face unexpected events, and diversification is your primary defense.",
    category: "risk",
    priority: 10,
    emoji: "🥚",
    link: "/portfolio",
    trigger: (ctx) => ctx.holdings.length === 1,
  },
  {
    id: "leverage-warning",
    title: "Debt vs Portfolio Value",
    body: "Your liabilities exceed your portfolio value. While some debt (like mortgages) is normal, high debt relative to investments can limit your financial flexibility.",
    category: "risk",
    priority: 8,
    emoji: "⚠️",
    link: "/net-worth",
    trigger: (ctx) =>
      !!ctx.netWorth &&
      ctx.netWorth.total_liabilities > ctx.portfolioValue &&
      ctx.portfolioValue > 0,
  },
  {
    id: "negative-net-worth",
    title: "Working Toward Positive Net Worth",
    body: "Your liabilities currently exceed your assets. Focus on high-interest debt first (avalanche method), then build your asset base. Every small step compounds over time.",
    category: "risk",
    priority: 9,
    emoji: "📈",
    link: "/debt-payoff",
    trigger: (ctx) => !!ctx.netWorth && ctx.netWorth.net_worth < 0,
  },

  // ── PLANNING ─────────────────────────────────────────────────────

  {
    id: "low-savings-rate",
    title: "Savings Rate Below 10%",
    body: "Financial experts recommend saving at least 15-20% of income. Even a 1% increase adds up dramatically over decades thanks to compounding. Review your cash flow for opportunities.",
    category: "planning",
    priority: 7,
    emoji: "🐷",
    link: "/cash-flow",
    trigger: (ctx) =>
      !!ctx.cashFlow &&
      ctx.cashFlow.total_income > 0 &&
      ctx.cashFlow.savings_rate < 10,
  },
  {
    id: "great-savings-rate",
    title: "Excellent Savings Rate!",
    body: "You're saving over 30% of your income, which puts you in a great position. Consider putting the surplus toward investments, emergency funds, or accelerated debt payoff.",
    category: "planning",
    priority: 3,
    emoji: "🌟",
    link: "/cash-flow",
    trigger: (ctx) =>
      !!ctx.cashFlow &&
      ctx.cashFlow.total_income > 0 &&
      ctx.cashFlow.savings_rate > 30,
  },
  {
    id: "goal-behind-schedule",
    title: "Goal Needs Attention",
    body: "One of your goals is less than 25% funded but the target date is approaching. Consider increasing contributions or adjusting the timeline to stay on track.",
    category: "planning",
    priority: 6,
    emoji: "🎯",
    link: "/goals",
    trigger: (ctx) => {
      if (!ctx.goals) return false;
      const now = Date.now();
      return ctx.goals.some((g) => {
        if (!g.target_date || g.target_amount <= 0) return false;
        const pct = g.current_amount / g.target_amount;
        const deadline = new Date(g.target_date).getTime();
        const totalSpan = deadline - (now - 365 * 24 * 60 * 60 * 1000); // rough
        const timeRemaining = deadline - now;
        return pct < 0.25 && timeRemaining > 0 && timeRemaining < totalSpan * 0.5;
      });
    },
  },
  {
    id: "no-goals-set",
    title: "Set Financial Goals",
    body: "Goals give your money a purpose. Whether it's an emergency fund, vacation, or retirement, defining clear targets makes it easier to stay motivated and track progress.",
    category: "planning",
    priority: 5,
    emoji: "🧭",
    link: "/goals",
    trigger: (ctx) => !ctx.goals || ctx.goals.length === 0,
  },

  // ── FUNDAMENTALS ─────────────────────────────────────────────────

  {
    id: "emergency-fund",
    title: "Do You Have an Emergency Fund?",
    body: "Before investing aggressively, most advisors recommend 3-6 months of expenses in a liquid, safe account. This prevents forced selling during unexpected events.",
    category: "fundamentals",
    priority: 5,
    emoji: "🏥",
    link: "/savings",
    trigger: (ctx) =>
      ctx.portfolioValue > 0 &&
      (!ctx.netWorth || ctx.netWorth.total_assets < ctx.portfolioValue * 1.2),
  },
  {
    id: "cost-basis-matters",
    title: "Know Your Cost Basis",
    body: "Your cost basis determines how much tax you owe when selling. FIFO (first in, first out) is the default method. The IRS uses it unless you specify otherwise.",
    category: "fundamentals",
    priority: 3,
    emoji: "📊",
    link: "/tax",
    trigger: (ctx) => ctx.holdings.length >= 2,
  },
  {
    id: "dollar-cost-averaging",
    title: "The Power of DCA",
    body: "Dollar-cost averaging means investing a fixed amount on a regular schedule. It reduces the risk of buying at a peak and works best with a long time horizon.",
    category: "fundamentals",
    priority: 2,
    emoji: "🔄",
    trigger: (ctx) => ctx.holdings.length >= 1,
  },
  {
    id: "rebalancing",
    title: "When to Rebalance",
    body: "Over time, winners grow and losers shrink, drifting your allocation from its target. Rebalancing quarterly or when any position drifts 5%+ from target keeps risk in check.",
    category: "fundamentals",
    priority: 3,
    emoji: "⚖️",
    link: "/portfolio",
    trigger: (ctx) =>
      ctx.holdings.length >= 3 &&
      ctx.holdings.some((h) => h.weight > 0.5),
  },
  {
    id: "compound-interest",
    title: "Compounding is Your Superpower",
    body: "At a 10% annual return, $10,000 grows to $67,275 in 20 years and $174,494 in 30 years. Time in the market matters more than timing the market.",
    category: "fundamentals",
    priority: 1,
    emoji: "✨",
    trigger: () => true, // universal — always available on /learn page
  },
];

// ── Helpers ────────────────────────────────────────────────────────

/** Evaluate all cards against context, return triggered cards sorted by priority */
export function getTriggeredCards(
  ctx: CardContext,
  dismissedIds: Set<string> = new Set(),
): LearningCard[] {
  return LEARNING_CARDS.filter(
    (card) => !dismissedIds.has(card.id) && card.trigger(ctx),
  ).sort((a, b) => b.priority - a.priority);
}

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  portfolio: "Portfolio",
  tax: "Tax",
  income: "Income",
  risk: "Risk Management",
  planning: "Financial Planning",
  fundamentals: "Fundamentals",
};

export const CATEGORY_COLORS: Record<CardCategory, string> = {
  portfolio: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  tax: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  income: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  risk: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  planning: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  fundamentals: "text-zinc-300 bg-zinc-400/10 border-zinc-400/20",
};
