/**
 * Velnor Learn  - Playbooks & Deep Dives
 *
 * Body text rules:
 *  - Blank line (two \n) = paragraph break
 *  - Lines starting with "- " = rendered as bullet list
 *  - No em dashes. No "Here's how." No textbook hedging.
 */

export type ContentType = "playbook" | "deepdive";
export type LearnCategory = "valuation" | "portfolio" | "tax" | "risk" | "planning" | "macro" | "advanced";

export const CATEGORY_LABELS: Record<LearnCategory, string> = {
  valuation: "Valuation",
  portfolio: "Portfolio",
  tax: "Tax",
  risk: "Risk",
  planning: "Planning",
  macro: "Macro",
  advanced: "Advanced",
};

export const CATEGORY_COLORS: Record<LearnCategory, { bg: string; text: string; border: string }> = {
  valuation: { bg: "bg-vela-teal/10",   text: "text-vela-teal",   border: "border-vela-teal/30" },
  portfolio: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  tax:       { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30" },
  risk:      { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/30" },
  planning:  { bg: "bg-vela-border/40", text: "text-vela-body",   border: "border-vela-border" },
  macro:     { bg: "bg-vela-teal/10",   text: "text-vela-teal",   border: "border-vela-teal/30" },
  advanced:  { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/30" },
};

// ── Playbook ──────────────────────────────────────────────────────────────────

export interface MiniToolDef {
  id: "position-from-loss" | "tax-harvest-savings" | "expected-value" | "drawdown-recovery";
  label: string;
}

export interface PlaybookStep {
  title: string;
  body: string;
  tip?: string;
  tool?: { label: string; href: string };
  miniTool?: MiniToolDef;
}

export interface Playbook {
  id: string;
  type: "playbook";
  category: LearnCategory;
  title: string;
  tagline: string;
  readMin: number;
  /** One-line description of what Claude focuses on when applied to a ticker */
  aiAngle: string;
  steps: PlaybookStep[];
}

// ── Deep Dive ─────────────────────────────────────────────────────────────────

export interface DeepDiveSection {
  heading?: string;
  body: string;
  callout?: string;
  tool?: { label: string; href: string };
}

export interface DeepDive {
  id: string;
  type: "deepdive";
  category: LearnCategory;
  title: string;
  tagline: string;
  readMin: number;
  /** One-line description of what Claude focuses on when applied to a ticker */
  aiAngle: string;
  opening: string;
  sections: DeepDiveSection[];
  takeaways: string[];
}

export type LearnItem = Playbook | DeepDive;

// ── Content ───────────────────────────────────────────────────────────────────

export const LEARN_CONTENT: LearnItem[] = [

  // ── PLAYBOOKS ───────────────────────────────────────────────────────────────

  {
    id: "stock-analysis-framework",
    type: "playbook",
    category: "valuation",
    title: "5-Step Stock Analysis Framework",
    tagline: "A repeatable process for evaluating any stock before you commit capital.",
    readMin: 8,
    aiAngle: "Walk through each step of this framework applied to [TICKER] - moat assessment, financial quality, and what the current price implies.",
    steps: [
      {
        title: "Understand the business first",
        body: "Before any numbers: what does this company actually sell? Who buys it, and why do they keep buying it? If you can't explain the business in two sentences, you don't have enough edge to own it. Complexity is not a reason to skip this step. It's a reason to do more reading.",
        tip: "Buffett's test: could you explain this business clearly to someone with no finance background? If not, read the 10-K again.",
      },
      {
        title: "Find the moat",
        body: "What stops a well-funded competitor from taking this company's customers? There are five sources of durable advantage: brand power, network effects, switching costs, cost advantages, and regulatory barriers. Most companies have none. Great businesses typically have two or more.\n\nA useful stress test: if Amazon or Google decided to enter this market tomorrow, what happens to this company in three years?",
        tip: "Be skeptical of companies that describe their moat in terms of patents. Patents expire. Network effects and switching costs are harder to dislodge.",
      },
      {
        title: "Read the financials - but look at the right numbers",
        body: "Revenue growth rate, free cash flow margin (not net income), return on invested capital, and debt relative to operating cash flow.\n\nFCF is harder to manipulate than earnings. ROIC above the cost of capital means the business creates value. ROIC below it destroys value, regardless of growth rate. A company growing fast while destroying capital is not a good business.",
        tool: { label: "Open DCF Tool", href: "/valuation/dcf" },
      },
      {
        title: "Value it with conservative assumptions",
        body: "Run a DCF using inputs 10 to 20 percent below analyst consensus. Markets routinely price in best-case scenarios. You want to know what you're paying for if things go only reasonably well.\n\nThen flip it: run the reverse DCF. What growth rate is the current share price implying? If it requires the company to execute perfectly for ten years straight, you're buying someone else's optimism.",
        tool: { label: "Run Reverse DCF", href: "/valuation/reverse-dcf" },
        tip: "If the implied growth rate in the reverse DCF exceeds the company's best-ever historical growth, that's a warning.",
      },
      {
        title: "Write the thesis before you buy",
        body: "Before placing the trade, write one paragraph: why you're buying, what the key risk is that could break the thesis, and at what price you would sell in both directions.\n\nThis is not a formality. It's the document you re-read when the stock drops 20% and you're tempted to panic. If the thesis is intact, the drop may be an opportunity. If the thesis is broken, selling is right.",
        tip: "Save it in the Thesis Notebook. Update it when new information arrives. A thesis that never changes means you're not paying attention.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
    ],
  },

  {
    id: "earnings-reaction-playbook",
    type: "playbook",
    category: "portfolio",
    title: "Earnings Reaction Playbook",
    tagline: "What to do in the 48 hours after a company you own reports quarterly results.",
    readMin: 6,
    aiAngle: "Assess [TICKER]'s most recent earnings print against this playbook, covering guidance quality and what to watch next quarter.",
    steps: [
      {
        title: "Know the setup before the print",
        body: "Check consensus EPS and revenue estimates, the implied options move (how much the market expects the stock to swing), and whether positioning has changed. A stock up 30% into earnings with elevated expectations is a very different situation than one that's been ignored.\n\nThe implied move lives in the options chain. A 7% implied move means the options market is pricing a 7% swing in either direction.",
      },
      {
        title: "Beat with raised guidance",
        body: "The best outcome. But check whether it's already priced in. If the stock ran up 15% in the week before earnings, the beat was expected. The new question becomes: does the raised guidance justify the current valuation? Update your model before you react to the stock price.",
      },
      {
        title: "Beat with flat or lowered guidance",
        body: "This is the combination that trips up most investors. The headline looks good. The reality is worse. Management almost always has better visibility into forward demand than analysts do. Lowering the outlook while beating the current quarter is a signal they see deterioration coming.\n\nListen to the earnings call. What are analysts pressing on? What is management not answering directly?",
      },
      {
        title: "Miss with maintained guidance",
        body: "A single miss doesn't break a thesis. Management is betting their credibility that it's temporary. Determine whether the miss was company-specific (execution problem) or industry-wide (macro headwind). If it's macro, it may not be fatal. If it's company-specific, your thesis needs revision.",
      },
      {
        title: "Miss with lowered guidance",
        body: "The most dangerous scenario. Don't average down until you understand why the miss happened. Is this temporary execution or structural deterioration? Cheap stocks can get significantly cheaper when the thesis cracks.\n\nGo back to your original write-up. Has the core premise changed?",
        tip: "Give yourself 48 to 72 hours before making any decision. Emotional reactions to earnings prints are where most money is lost.",
      },
      {
        title: "Update the model, not the position",
        body: "Your reaction should be driven by whether the business changed, not by what the stock price did. If results were fine and the stock dropped 10% on macro sentiment, that may be an opportunity. If results revealed a real problem and the stock barely moved, that's a warning.\n\nUpdate the model first. Then decide.",
        tool: { label: "Open Portfolio", href: "/portfolio" },
      },
    ],
  },

  {
    id: "when-to-sell",
    type: "playbook",
    category: "portfolio",
    title: "When to Sell: A Decision Framework",
    tagline: "Five clear conditions that justify selling. \"It went up\" is not one of them.",
    readMin: 5,
    aiAngle: "Evaluate [TICKER] against each sell condition - thesis integrity, valuation, and concentration - to surface whether action is warranted.",
    steps: [
      {
        title: "Your thesis has been invalidated",
        body: "The only sell reason that's always right. If the core reason you bought the stock no longer holds, sell. It doesn't matter whether you're up or down. Holding because you're underwater is anchoring to a cost basis, not to a business.\n\nDon't confuse a falling stock price with an invalidated thesis. They're different things.",
      },
      {
        title: "The valuation has become extreme",
        body: "Run the reverse DCF. If the current price implies growth that would require the company to become one of the largest businesses ever built, the upside is already priced in and the downside is now asymmetric.\n\nTrimming into strength isn't the same as panic-selling. Reducing a position by 30% while keeping upside exposure is rational portfolio management.",
        tool: { label: "Run Reverse DCF", href: "/valuation/reverse-dcf" },
        tip: "Consider trimming rather than selling entirely. You can reduce concentration while maintaining exposure to your thesis.",
      },
      {
        title: "A better opportunity clearly exists",
        body: "Capital is finite. Opportunity cost is real. If you have high conviction in a new idea and your current position has asymmetric downside, reallocating is rational. The market doesn't care what you paid.",
      },
      {
        title: "The position has grown to uncomfortable concentration",
        body: "If unrealized gains have pushed a single holding to 15 to 20% of your portfolio, trimming to manage concentration risk makes sense even if the thesis is intact. This isn't about the business. It's about ensuring one bad event can't erase years of compounding.",
        tool: { label: "Check Position Weights", href: "/portfolio" },
      },
      {
        title: "You need this money within three years",
        body: "Stocks need time to recover from drawdowns. A 50% decline requires a 100% gain just to get back to even. Money earmarked for a specific near-term goal has no business being in equities. Match the time horizon of your money to its purpose.",
        tool: { label: "Review Goals Timeline", href: "/goals" },
      },
    ],
  },

  {
    id: "tax-loss-harvesting",
    type: "playbook",
    category: "tax",
    title: "Tax-Loss Harvesting Checklist",
    tagline: "Turn losing positions into a guaranteed tax benefit without triggering wash sale rules.",
    readMin: 7,
    aiAngle: "Identify tax-loss harvesting potential for [TICKER] and suggest suitable replacement securities that avoid the wash sale window.",
    steps: [
      {
        title: "Identify candidates",
        body: "Look for positions with unrealized losses of at least $500. The loss must be in a taxable account. Harvesting inside a 401(k) or IRA generates zero tax benefit.\n\nCheck whether you've held the position long enough that cost basis lots are straightforward to identify.",
        tool: { label: "View Tax Harvest Tool", href: "/tax-harvest" },
      },
      {
        title: "Understand the wash sale rule",
        body: "Sell a security at a loss and buy the same or substantially identical security within 30 days before or after the sale, and the IRS disallows the loss. The window is 61 days total: 30 days before the sale, the sale date, 30 days after.\n\nThe rule applies across all your accounts. Selling at a loss in taxable and buying back in your IRA within 30 days still triggers it.",
        tip: "Substantially identical is a gray area. Different ETFs tracking the same index are generally considered acceptable replacements, though there's ongoing debate.",
      },
      {
        title: "Find a suitable replacement",
        body: "Buy something similar enough to maintain market exposure but different enough to avoid the wash sale.\n\n- Sell SPY, buy VOO or IVV (same index, different issuer)\n- Sell NVDA, buy AMD to stay in semiconductors\n- Sell AMZN, buy a broad consumer discretionary ETF\n- Sell a single stock, buy the sector ETF",
      },
      {
        title: "Execute carefully",
        body: "Avoid the first and last 15 minutes of the trading day when spreads are widest. Check your cost basis method: FIFO gives you the oldest shares first, which may not be the ones with the biggest loss. Specify the highest-cost lot to maximize the harvested amount.",
      },
      {
        title: "Document everything",
        body: "Record the sale date, cost basis, realized loss, the replacement security bought, and the 31-day window when you can repurchase the original. Your brokerage generates a 1099-B, but your own records help you plan for next year.",
      },
      {
        title: "Know what you actually gain",
        body: "Harvested losses offset realized capital gains first, dollar for dollar. Excess losses offset up to $3,000 of ordinary income per year. Remaining losses carry forward indefinitely.\n\nAt a 20% long-term capital gains rate, a $10,000 harvested loss saves $2,000 in taxes. The tax isn't eliminated, it's deferred. But deferral has real value because of the time value of money.",
        tip: "When you eventually sell the replacement security, you'll have a lower cost basis and a larger gain. That's the deferred tax coming due.",
        miniTool: { id: "tax-harvest-savings", label: "Calculate your tax saving" },
      },
    ],
  },

  {
    id: "building-a-dcf",
    type: "playbook",
    category: "valuation",
    title: "Building Your First DCF",
    tagline: "Discounted cash flow analysis, explained practically without the finance degree.",
    readMin: 9,
    aiAngle: "Estimate the key DCF inputs for [TICKER] - FCF, growth rate, discount rate - and show what assumptions the current price requires.",
    steps: [
      {
        title: "Start with free cash flow, not earnings",
        body: "The foundation of a DCF is actual cash, not accounting profit. Free Cash Flow = Operating Cash Flow minus Capital Expenditures. Find it on the cash flow statement, not the income statement.\n\nFor a cleaner signal, use trailing twelve months (TTM) FCF. If FCF is consistently below net income, investigate why. It often points to working capital issues or aggressive revenue recognition.",
        tool: { label: "Open DCF Tool", href: "/valuation/dcf" },
        tip: "A business where net income greatly exceeds FCF for multiple consecutive years deserves serious scrutiny before you model it.",
      },
      {
        title: "Forecast Years 1 to 5 conservatively",
        body: "If consensus growth is 25%, model 18 to 20%. If the company has never sustained 25% growth for five consecutive years, assuming it starts now requires justification you probably don't have.\n\nCross-check against industry growth rates. A company outgrowing its industry is taking share. One growing in line with the industry might just be riding the tide.",
        tip: "Your assumptions should be defensible in a sentence. If you can't explain why 25% growth is realistic, use a lower number.",
      },
      {
        title: "Model deceleration in Years 6 to 10",
        body: "Very few businesses sustain high growth for a decade. Model growth converging toward 5 to 8% in the back half of the forecast. A company projected to grow at 30% for ten years is not a forecast. It's a wish.",
      },
      {
        title: "Set terminal growth at 2 to 3%",
        body: "The terminal value often represents 60 to 80% of total DCF value. Using a terminal growth rate above 3 to 4% implies the company will eventually be larger than the entire economy. Use long-run nominal GDP growth: 2 to 3%.\n\nSensitivity test this number. Moving from 2% to 3% terminal growth can change your fair value estimate by 15 to 25%. It's the most dangerous assumption in the model.",
        tip: "Because terminal value dominates the DCF, your discount rate choice matters more than your near-term growth assumptions.",
      },
      {
        title: "Set the discount rate honestly",
        body: "The discount rate reflects the minimum return you require given the risk. For most large-cap equities: 8 to 10%. For small-cap or high-growth companies with uncertain cash flows: 11 to 14%. For speculative businesses: 15% or higher.\n\nWhen uncertain, use 10%. It approximates long-run equity market returns and keeps you from building in hidden optimism through a low discount rate.",
      },
      {
        title: "Run the reverse DCF as a sanity check",
        body: "Input the current market price and solve for the implied growth rate. If the market is pricing in 40% annual growth for 10 years for a company that has never grown faster than 20%, you're paying for an expectation that may never materialize.\n\nThe reverse DCF turns valuation into a more honest question: do I actually believe these assumptions?",
        tool: { label: "Try Reverse DCF", href: "/valuation/reverse-dcf" },
      },
    ],
  },

  // ── DEEP DIVES ───────────────────────────────────────────────────────────────

  {
    id: "fcf-vs-earnings",
    type: "deepdive",
    category: "valuation",
    title: "Why Free Cash Flow Beats Earnings",
    tagline: "Earnings are a story. Free cash flow is the bank statement.",
    readMin: 7,
    aiAngle: "Compare [TICKER]'s free cash flow quality against reported earnings and flag any divergence worth investigating.",
    opening: "Every quarter, companies report earnings per share. Analysts debate beats and misses. Stock prices move on the difference. Most of it is noise, because EPS is calculated under rules that allow revenue to appear before cash arrives.",
    sections: [
      {
        heading: "The accounting gap",
        body: "Earnings are calculated on accrual accounting. Revenue is recognized when earned, not when collected. A company can book a $10M sale the moment a contract is signed, even if the customer has 90 days to pay. That $10M hits EPS immediately. Not a dollar has changed hands.\n\nThis isn't fraud. It's legal accounting. But it means earnings and cash reality can diverge sharply, especially during periods of aggressive growth or financial stress.",
      },
      {
        heading: "What free cash flow actually measures",
        body: "Free Cash Flow = Operating Cash Flow minus Capital Expenditures. It strips out the accounting and asks one question: after paying to keep the business running and investing in its future, how much actual cash did this company generate?\n\nFCF is what can be paid as dividends, used to buy back shares, pay down debt, or make acquisitions. It flows through the company's bank account. It's what an owner of the business would actually pocket.",
        callout: "Buffett calls it owner earnings: net income plus depreciation and amortization, minus maintenance capex. The number an honest owner would report to a partner.",
      },
      {
        heading: "When they diverge, and what it means",
        body: "Strong EPS alongside weak or negative FCF for multiple consecutive quarters deserves scrutiny. Common causes:\n\n- Accounts receivable growing faster than revenue (customers not paying on time)\n- Inventory buildup (products not selling)\n- Capitalizing expenses that belong on the income statement\n- Booking multi-year contracts upfront\n\nNone of these are always signs of fraud. But a business that earns $2 per share while only converting $0.80 of that into real cash is generating lower quality results than one where the two numbers converge.",
      },
      {
        heading: "Where to find it",
        body: "The cash flow statement is in every 10-Q and 10-K. Look for Cash flow from operations and Capital expenditures (often labeled Purchases of property, plant and equipment). Subtract the second from the first.\n\nHigh-quality businesses tend to have FCF margins (FCF as a percentage of revenue) above 15 to 20%. Asset-light businesses like software platforms often generate 25 to 40% FCF margins because they don't need much capital to grow. Asset-heavy businesses have structurally lower margins because they continuously reinvest.",
        tool: { label: "Use the DCF Tool", href: "/valuation/dcf" },
      },
    ],
    takeaways: [
      "Always check FCF alongside EPS. They should roughly converge over time",
      "FCF margin above net margin signals high-quality, cash-generative earnings",
      "Receivables growing faster than revenue is a warning worth investigating",
      "Asset-light businesses structurally generate higher FCF margins than capital-intensive ones",
    ],
  },

  {
    id: "pe-ratio-guide",
    type: "deepdive",
    category: "valuation",
    title: "P/E Ratios: The Most Misused Metric in Finance",
    tagline: "How to actually interpret price-to-earnings, and stop making the mistake everyone makes.",
    readMin: 6,
    aiAngle: "Contextualize [TICKER]'s P/E against its growth rate, sector peers, and historical range - and whether the multiple is justified.",
    opening: "The P/E ratio is cited everywhere and understood almost nowhere. A stock gets called cheap at P/E 12 and expensive at P/E 35 as if those numbers carry meaning in isolation. They don't.",
    sections: [
      {
        heading: "What it actually measures",
        body: "P/E = share price divided by earnings per share. It's how much investors pay for $1 of annual earnings. A P/E of 20 implies an earnings yield of 5%. A P/E of 40 implies 2.5%.\n\nThe earnings yield comparison to bond yields is genuinely useful. When 10-year Treasuries yield 4.5% and the S&P 500 earnings yield is 4.8%, equities look roughly fairly valued relative to bonds. When bonds yield 5% and stocks yield 3%, the relative value case weakens considerably.",
      },
      {
        heading: "Low P/E is not the same as cheap",
        body: "A P/E of 8 might mean the stock is genuinely undervalued. It might also mean the company is in a declining industry, has deteriorating competitive dynamics, sits at the peak of an earnings cycle that will contract, or that management has a history of destroying value.\n\nThe market is not obviously wrong when it assigns a low multiple. It's pricing in a concern about future earnings. Your job is to determine whether that concern is correct.",
        callout: "Value traps are real. Newspapers, mall retailers, and declining consumer brands all looked cheap at various points. The earnings didn't last.",
      },
      {
        heading: "High P/E is not the same as expensive",
        body: "A company at P/E 40 growing earnings at 35% per year is cheaper in three years than a P/E 15 company growing at 5%.\n\nCompany A: earns $2 today at 35% growth, earns $3.65 in year three. At a compressed P/E of 30, the stock trades at $109 vs. $80 today.\nCompany B: earns $3 today at 5% growth, earns $3.47 in year three. At P/E 15, the stock trades at $52 vs. $45 today.\n\nCompany A outperforms despite a seemingly expensive starting multiple.",
      },
      {
        heading: "How to actually use it",
        body: "P/E provides context, not verdicts. Three useful applications:\n\n- Compare within sectors. Industrials trade at lower multiples than software by design. Comparing across sectors misleads.\n- Compare to the company's own history. A stock at P/E 30 when its 5-year average is 22 is at a meaningful premium to itself.\n- Pair it with growth using the PEG ratio (P/E divided by expected growth rate). A PEG below 1.0 often signals reasonable value.",
        callout: "Forward P/E uses analyst estimates for next year's earnings, which are frequently optimistic. In late-cycle markets, watch for hockey-stick estimates that never arrive.",
        tool: { label: "Compare Stocks", href: "/stock-compare" },
      },
    ],
    takeaways: [
      "P/E is context, not a verdict. Always pair it with growth rate, margins, and FCF quality",
      "Low P/E can be a value trap. High P/E can be rational if growth supports it",
      "The PEG ratio (P/E divided by growth) normalizes for growth and is more useful for comparison",
      "Compare a stock's P/E to its own 5-year range, not just to the market average",
    ],
  },

  {
    id: "compounding-math",
    type: "deepdive",
    category: "planning",
    title: "The Compounding Math Nobody Explains Clearly",
    tagline: "Why starting at 25 beats starting at 35 by more than $1 million, and what that means today.",
    readMin: 5,
    aiAngle: "Model the long-term compounding math for a position in [TICKER] under different holding period and return scenarios.",
    opening: "Compound interest gets described as the eighth wonder of the world so often the phrase has lost meaning. Here's the actual math, and why the implications are more radical than most people realize.",
    sections: [
      {
        heading: "The numbers, plainly",
        body: "$500 per month invested, earning 8% annually:\n\n- Start at 25: $1.74 million at 65\n- Start at 30: $1.22 million at 65\n- Start at 35: $745,000 at 65\n\nThe gap between starting at 25 versus 35 is $995,000. From $60,000 in additional contributions. Each dollar contributed in that extra decade generated roughly $16 in ending wealth.",
        callout: "You don't need to be smarter than anyone else. You need to start earlier.",
      },
      {
        heading: "Why the math is non-intuitive",
        body: "Compounding is exponential, and human brains think linearly. We expect progress to be steady and proportional. Compounding is neither.\n\nIn the first ten years of a 40-year investment, your own contributions dominate. You're mostly adding money with modest returns on top. In the final ten years, returns on prior returns dominate. The last decade of a 40-year account often represents more than half the total value accumulated across the entire 40 years.\n\nThis is why interruptions early matter less than they feel like they do, and interruptions late are genuinely devastating.",
      },
      {
        heading: "Tax drag: the silent compounding killer",
        body: "A 10% annual return in a taxable account, assuming 20% capital gains tax on annual realizations, effectively compounds at 7.5 to 8%.\n\nOver 30 years, that 0.5 to 1% difference compresses ending wealth by 15 to 25%. On a $1 million portfolio, that's $150,000 to $250,000 in taxes that didn't have to be paid yet.",
      },
      {
        heading: "The practical order of operations",
        body: "From a pure compounding standpoint:\n\n1. 401(k) to employer match (immediate 50 to 100% return on the contribution)\n2. HSA if eligible (triple tax advantage; use it as a stealth retirement account)\n3. Roth IRA to the contribution limit\n4. Max the 401(k) beyond the match\n5. Taxable brokerage last\n\nThe specific account matters because of tax drag. A dollar inside a Roth IRA compounds at the full pre-tax rate for decades, then comes out tax-free. A dollar in taxable faces continuous leakage.",
      },
    ],
    takeaways: [
      "Starting 10 years earlier can add nearly $1M to retirement wealth on the same contribution amount",
      "The final decade of compounding generates more than half the value of a 40-year account",
      "Tax drag costs 15 to 25% of ending wealth over long periods. Account structure is not a minor decision",
      "Max tax-advantaged accounts before investing in taxable. The order matters significantly",
    ],
  },

  {
    id: "reading-earnings",
    type: "deepdive",
    category: "portfolio",
    title: "Reading an Earnings Report in 15 Minutes",
    tagline: "What to look for, what to ignore, and where management hides bad news.",
    readMin: 7,
    aiAngle: "Apply this earnings reading framework to [TICKER]'s latest quarterly report, highlighting the numbers that matter.",
    opening: "Four times a year, every public company tells you more about its business than at any other point. Most investors get distracted by the wrong numbers. Here's how to read a report the way an analyst does.",
    sections: [
      {
        heading: "Start with the press release, then be suspicious",
        body: "The earnings press release is written by management and investor relations. It presents results in the most favorable light legally permitted. Notice what's highlighted prominently and what's buried in footnotes.\n\nAbsent metrics are data. Companies disclose what makes them look good. When a metric disappears from the standard reporting package, assume it deteriorated.",
      },
      {
        heading: "The five numbers that actually matter",
        body: "Revenue growth rate: not the absolute number, the rate of change. Decelerating growth (25% to 18% to 12%) is more important than the current level.\n\nGross margin: pricing power and competitive moat in a single number. Expanding margins mean the business is strengthening. Compressing margins mean pricing pressure or rising input costs.\n\nFree cash flow: not adjusted EBITDA. Actual cash from operations minus capex.\n\nGuidance revision: did management raise, maintain, or lower the forward outlook? This matters more than the current quarter.\n\nUnit economics: net revenue retention for SaaS, same-store sales for retail. The health of the core business at the unit level.",
        callout: "Adjusted EBITDA excludes stock-based compensation, one-time charges, and restructuring costs. When one-time items recur every quarter for five years, they are not one-time.",
      },
      {
        heading: "The earnings call: where to focus",
        body: "Skip the scripted remarks if you've read the press release. The Q&A is where information surfaces.\n\nListen for the difference between confidence and hedging. \"We have strong visibility into demand through year-end\" is specific. \"We continue to see healthy demand signals\" is vague. Management uses imprecision when they're uncertain.\n\nPay attention to which analyst questions get sidestepped. A long non-answer about \"investment cycles\" and \"long-term value creation\" in response to a direct gross margin question is itself an answer.",
      },
      {
        heading: "What to ignore",
        body: "Non-GAAP earnings: useful as a supplement, not a replacement. When a company leads with adjusted metrics and buries GAAP results, weight the GAAP numbers more heavily.\n\nEBITDA for capital-intensive businesses: airlines, manufacturers, and telecom companies require enormous ongoing capital investment. Depreciation is a real cost. An airline with strong EBITDA and negative FCF is not generating wealth.\n\nEPS driven by buybacks alone: if earnings per share are growing but total net income is flat, you're seeing financial engineering, not business improvement.",
        tool: { label: "Track your holdings", href: "/portfolio" },
      },
    ],
    takeaways: [
      "Gross margin is the clearest indicator of competitive moat and pricing power",
      "Absent metrics are data. Companies highlight what's working and omit what isn't",
      "Forward guidance matters more than the current quarter's print",
      "Non-GAAP metrics require skepticism. Always reconcile back to GAAP free cash flow",
    ],
  },

  {
    id: "margin-of-safety",
    type: "deepdive",
    category: "valuation",
    title: "Margin of Safety: The Most Important Concept in Investing",
    tagline: "Benjamin Graham's core principle, and why most investors understand it but few actually practice it.",
    readMin: 6,
    aiAngle: "Estimate a fair value range for [TICKER] and assess whether the current price includes an adequate margin of safety.",
    opening: "Every valuation model you build is wrong. The inputs are estimates based on uncertain assumptions about an unknowable future. Margin of safety is the systematic acknowledgment of that uncertainty, and the protection you build in as a result.",
    sections: [
      {
        heading: "The idea",
        body: "When you buy a stock, you're buying ownership in a business at a price. Your DCF model gives you an estimate of intrinsic value. When the market price is significantly below your estimate, the gap is your margin of safety.\n\nBenjamin Graham described it simply: if your analysis says a company is worth $100 and you buy at $70, you have a 30% margin of safety. If your assumptions are modestly wrong and growth comes in at 18% instead of 22%, you likely still paid a fair price.",
        callout: "The margin of safety is not pessimism about the business. It's intellectual honesty about the limits of your own analysis.",
      },
      {
        heading: "Why most investors skip it",
        body: "Requiring a 25 to 30% discount to intrinsic value is psychologically difficult in bull markets. A stock you've valued at $100 might run from $75 to $90 before it meets your criteria. That $15 you missed hurts. The discipline required to hold the line is real.\n\nThe problem is that this feeling, the regret of watching a stock appreciate before buying, is precisely what leads investors to buy at or above fair value. And when you buy at fair value, you have no buffer if your analysis is wrong.",
      },
      {
        heading: "How large should the margin be?",
        body: "It depends on how certain your estimate is.\n\nA business with predictable, durable cash flows: a consumer staple, a toll road, a dominant software platform with high switching costs. A 15 to 20% discount below your DCF estimate may be sufficient.\n\nA business with high execution risk, uncertain competitive dynamics, or limited operating history: 40 to 50% below intrinsic value. Not because the business is bad, but because your ability to model it accurately is lower.",
      },
      {
        heading: "The asymmetry it creates",
        body: "Buying with a margin of safety creates favorable asymmetry. If you're right, you earn excellent returns. If you're modestly wrong, growth comes in slower than expected, you likely break even or earn modest returns.\n\nThe margin converts being somewhat wrong from a loss into a wash. You're not eliminating the possibility of error. You're ensuring that error doesn't destroy capital.",
        tool: { label: "Run your DCF analysis", href: "/valuation/dcf" },
        callout: "The larger the uncertainty, the larger the required margin. High-uncertainty businesses need bigger buffers, not smaller ones. Excitement about a story is not a reason to accept less safety.",
      },
    ],
    takeaways: [
      "Build a discount into your DCF intrinsic value before buying. 15 to 30% minimum",
      "Greater uncertainty requires a larger margin of safety, not a smaller one",
      "The margin converts being modestly wrong from a loss into a neutral outcome",
      "This discipline is hardest in bull markets, which is exactly when it matters most",
    ],
  },

  {
    id: "yield-curve",
    type: "deepdive",
    category: "macro",
    title: "What a Yield Curve Inversion Actually Signals",
    tagline: "The indicator with a perfect recession-predicting record, and why its timing is unreliable.",
    readMin: 6,
    aiAngle: "Assess how the current macro environment and yield curve could affect [TICKER] given its sector, debt profile, and rate sensitivity.",
    opening: "The yield curve has inverted before every U.S. recession since 1955. Seven for seven. It's the most reliable macroeconomic indicator in modern finance, and also the most misused, because the lag between inversion and recession varies wildly.",
    sections: [
      {
        heading: "What the yield curve is",
        body: "The yield curve plots Treasury yields across maturities, from 3 months to 30 years. In normal conditions, longer-term bonds yield more than short-term bonds. Investors demand more compensation for lending money over longer periods.\n\nInversion occurs when short-term rates rise above long-term rates. The most watched indicator is the 2-year minus 10-year spread (2s10s). When negative, the curve is inverted.",
      },
      {
        heading: "The mechanism: why it predicts recessions",
        body: "Banks borrow short and lend long. Their profit depends on long rates exceeding short rates. When the curve inverts, that spread compresses or turns negative. Banks stop making new loans because the economics stop working. Credit tightens. Businesses can't borrow to expand. Consumers can't borrow to spend. Economic activity slows.",
        callout: "The yield curve predicts recessions partly because it causes them. Credit tightening is a self-reinforcing mechanism.",
      },
      {
        heading: "The timing problem",
        body: "The inversion-to-recession lag has ranged from 6 months to 24 months across historical cycles. Some inversions resolve without a deep recession. Others precede significant downturns. The indicator tells you risk is elevated. It does not give you a start date.",
        tool: { label: "View Macro Dashboard", href: "/macro" },
      },
      {
        heading: "What to do with your portfolio",
        body: "An inverted yield curve is a risk signal, not a sell signal.\n\nWhat's reasonable: review cyclical exposure (consumer discretionary, industrials, and materials tend to be hit hardest in recessions), ensure adequate cash reserves, review companies with heavy variable-rate debt.\n\nWhat isn't reasonable: panic-selling equities. Markets often rise 15 to 20% after initial inversion before any eventual decline. Macro-timing in and out of the market is extremely difficult to execute profitably.",
        callout: "In 2019 the curve inverted. Markets rose 30%. The recession came in 2020, from a source nobody was modeling. Timing the curve is nearly impossible.",
      },
    ],
    takeaways: [
      "The 2s10s spread has inverted before every U.S. recession since 1955",
      "The mechanism is credit tightening: banks stop lending, growth slows",
      "The lag from inversion to recession is 6 to 24 months, making precise timing impossible",
      "Use as a risk-awareness signal, not a trigger to exit equities",
    ],
  },
  // ── STANDARD ADDITIONS ──────────────────────────────────────────────────────

  {
    id: "rebalancing-a-portfolio",
    type: "playbook",
    category: "portfolio",
    title: "How and When to Rebalance Your Portfolio",
    tagline: "Rebalancing is not about chasing balance for its own sake. It is about resetting your actual risk exposure to what you chose.",
    readMin: 6,
    aiAngle: "Assess whether your [TICKER] position has drifted beyond your intended weight and whether rebalancing is warranted.",
    steps: [
      {
        title: "Understand what you are actually rebalancing",
        body: "Rebalancing restores your portfolio to a target allocation that reflects your intended risk level. Over time, assets that appreciate become a larger share of the portfolio than you planned. This is not a problem by itself. But if a 5% position becomes 18%, your risk exposure to that single name has more than tripled.\n\nThe trigger for rebalancing is not the calendar. It is drift from your intended allocation.",
      },
      {
        title: "Set a drift threshold, not a schedule",
        body: "Calendar-based rebalancing (quarterly, annually) is arbitrary. A more rational approach: rebalance when any position drifts more than 5 percentage points from its target weight, or when the total portfolio allocation deviates more than 10 points from your target equity/bond split.\n\nThreshold-based rebalancing reduces unnecessary trading and taxes while still keeping you within your risk budget.",
        tip: "Rebalancing annually in taxable accounts generates capital gains. Threshold-based rebalancing often means fewer trades per year than calendar-based approaches.",
      },
      {
        title: "Use new contributions to rebalance first",
        body: "Before selling anything, direct new contributions to underweight positions. If you invest $1,000 monthly and bonds have drifted below target, put the full contribution into bonds that month.\n\nThis approach avoids realizing capital gains entirely. It works well when the drift is modest and contributions are meaningful relative to portfolio size.",
        tool: { label: "View Portfolio Weights", href: "/portfolio" },
      },
      {
        title: "Handle tax implications before selling",
        body: "In a taxable account, selling appreciated positions to rebalance triggers capital gains. Run the numbers before trading:\n\n- Short-term gains (held under a year) are taxed as ordinary income\n- Long-term gains (held over a year) are taxed at 0%, 15%, or 20% depending on income\n- Harvesting losses elsewhere first can offset gains from rebalancing\n\nInside a 401(k) or IRA, you can rebalance freely with no tax consequence.",
      },
      {
        title: "Rebalance across accounts strategically",
        body: "If you hold both taxable and tax-advantaged accounts, do the selling inside the retirement account and the buying in taxable. The sale generates no tax event inside the 401(k). This is a simple but frequently missed optimization.\n\nAlso consider asset location: bonds are best held in tax-deferred accounts where their interest income is sheltered. Equities with long-term appreciation potential are well-suited to Roth accounts.",
        tool: { label: "Review Net Worth & Accounts", href: "/net-worth" },
      },
    ],
  },

  {
    id: "how-to-read-a-10k",
    type: "playbook",
    category: "portfolio",
    title: "How to Read a 10-K Without Wasting 4 Hours",
    tagline: "The sections that matter, the sections you can skip, and the one paragraph that tells you more than the rest of the filing.",
    readMin: 7,
    aiAngle: "Walk through the most important sections of [TICKER]'s most recent 10-K and identify what to focus on.",
    steps: [
      {
        title: "Start with Item 1A: Risk Factors",
        body: "Most investors skip risk factors. That is a mistake. Risk factors are where companies disclose what could go wrong, and a careful reading reveals what management is genuinely worried about.\n\nCompare this year's risk factors to last year's. New additions are meaningful. Risks that disappeared without resolution deserve scrutiny. The specific language used to describe risks often changes subtly when management's level of concern has changed.",
        tip: "If a risk factor section has grown materially year over year, that is a signal. Management is required to disclose known risks. Expanding disclosures mean expanding awareness of problems.",
      },
      {
        title: "Read the MD&A for the real narrative",
        body: "Management's Discussion and Analysis (usually Item 7) is the most useful section of the filing. Management is required to explain the year's results in plain language, discuss what drove revenue and margin changes, and address any known trends that will affect future performance.\n\nThis is where you find qualitative explanations for the numbers. If gross margin declined, the MD&A explains why. If a business segment underperformed, this is where management addresses it. Read it skeptically but carefully.",
      },
      {
        title: "Check the cash flow statement, not just income",
        body: "The income statement is on the first page of financial statements and gets most of the attention. The cash flow statement is typically several pages later and is more revealing.\n\nLook at Cash from operations and Capital expenditures. Calculate free cash flow. If FCF has been declining for three consecutive years while EPS has risen, something is worth investigating. Also review Changes in working capital - rapid growth in receivables relative to revenue is a warning sign.",
        tool: { label: "Open DCF Tool", href: "/valuation/dcf" },
      },
      {
        title: "Read the footnotes on revenue recognition and debt",
        body: "Two footnotes matter more than most of the filing:\n\nRevenue recognition policy: how and when does the company count a sale? Companies with aggressive revenue recognition (booking multi-year deals upfront, for instance) report higher near-term earnings at the cost of future periods.\n\nDebt schedule and covenants: what does the company owe, when does it mature, and what financial ratios must it maintain to avoid default? A company with $500M in debt maturing in 18 months needs to either refinance or generate significant cash. Current rates make this relevant again.",
        tip: "Footnotes are written in dense legal language, but the key disclosures are usually in the first two sentences of each note. Skim for the substance.",
      },
      {
        title: "Scan the auditor's report for one thing",
        body: "The auditor's report is usually boilerplate. But read the first paragraph. A clean opinion says results 'present fairly in all material respects.' Any qualification, any going concern language, or any emphasis of matter paragraph is significant. These are rare and important.\n\nAlso check the auditor. A change in audit firm without explanation can signal disagreement over accounting judgments.",
      },
    ],
  },

  {
    id: "emergency-fund",
    type: "playbook",
    category: "planning",
    title: "Building Your Emergency Fund",
    tagline: "The one financial move that protects everything else you are trying to build.",
    readMin: 4,
    aiAngle: "Assess how an emergency fund interacts with a [TICKER] position - opportunity cost, liquidity, and whether you are investing money you may need.",
    steps: [
      {
        title: "Size it correctly for your situation",
        body: "The standard advice is three to six months of expenses. The right number depends on your situation:\n\n- Single income household, or variable income: six months minimum\n- Dual income household with stable employment: three months is defensible\n- Self-employed or commission-based income: nine to twelve months\n- Approaching retirement or in retirement: twelve to twenty-four months\n\nThe fund covers essential monthly expenses only - housing, food, utilities, insurance, minimum debt payments. Not discretionary spending.",
        tip: "Calculate the number precisely. Vague targets ('a few months') lead to underfunding. A specific number - $22,400 - is easier to work toward than 'enough.'",
      },
      {
        title: "Keep it liquid and boring",
        body: "The emergency fund is not an investment. It is insurance. Its job is to be available instantly at full value.\n\nA high-yield savings account (HYSA) is the right vehicle. Currently yielding 4.5 to 5%, it beats inflation, stays fully liquid, and is FDIC-insured. A money market fund is a reasonable alternative.\n\nDo not invest the emergency fund in equities, bonds, or anything that can lose value. A 30% market decline that coincides with a job loss is exactly when you need this money most.",
      },
      {
        title: "Fund it before investing",
        body: "The standard priority order:\n\n1. Emergency fund to one month of expenses\n2. Contribute to 401(k) to capture employer match\n3. Build emergency fund to target\n4. Then invest aggressively\n\nThe employer match is an immediate 50 to 100% return. But beyond that, investing before the emergency fund is built means you may have to sell investments at a loss during a crisis. The emergency fund protects your investment portfolio.",
      },
      {
        title: "Review it annually and after major life changes",
        body: "If your expenses have increased - new mortgage, new child, higher insurance - recalculate the target. If you used any of the fund, replenishing it takes priority over other financial goals until it is restored.\n\nThe fund is not a savings vehicle to be optimized. Once it is at target, leave it alone and focus capital elsewhere.",
      },
    ],
  },

  {
    id: "evaluating-dividends",
    type: "playbook",
    category: "valuation",
    title: "Evaluating a Dividend Stock",
    tagline: "Yield is not a reason to buy. It is a starting point for five harder questions.",
    readMin: 6,
    aiAngle: "Evaluate [TICKER]'s dividend quality - yield, payout ratio, coverage, growth history, and sustainability.",
    steps: [
      {
        title: "Look at payout ratio before yield",
        body: "Yield tells you what the company is paying relative to its stock price. Payout ratio tells you whether it can sustain it.\n\nPayout ratio = dividends per share / earnings per share. A ratio below 60% is generally sustainable. Above 80%, and a business slowdown puts the dividend at risk. Above 100%, the company is paying out more than it earns - which is only sustainable if it has the cash reserves and conviction to maintain it.",
        tip: "Use FCF payout ratio instead of earnings payout ratio for a cleaner picture. Some businesses with high depreciation (utilities, REITs) have earnings payout ratios above 100% while FCF coverage is fine.",
      },
      {
        title: "Check the dividend growth history",
        body: "A dividend that has grown consistently for 10 or more years is a different investment from one paying a high static yield.\n\nDividend growth signals management confidence in future earnings. It also means your yield on cost increases over time. A stock paying $2 today on a $40 cost basis yields 5%. In ten years at 7% annual dividend growth, that same position yields 10% on your original cost.\n\nCompanies that have grown dividends for 25 or more consecutive years are called Dividend Aristocrats. That track record is difficult to sustain without durable business quality.",
      },
      {
        title: "Understand how dividends affect total return",
        body: "Dividends are not free money. When a stock pays a dividend, the share price drops by approximately the dividend amount on the ex-dividend date. The total return - price appreciation plus dividends - is what matters, not the yield in isolation.\n\nA 6% yielder that appreciates 0% per year returns 6% total. A 1% yielder growing earnings at 18% per year may return 20% total. Chasing yield at the expense of growth is a common and costly mistake.",
      },
      {
        title: "Assess dividend coverage from free cash flow",
        body: "Dividends are paid in cash. Verify that the company generates enough free cash flow to fund them.\n\nDividend coverage ratio = FCF / total dividends paid. A ratio above 1.5x is comfortable. Below 1.0x, the dividend requires either debt or asset sales to fund - neither is sustainable indefinitely.\n\nAlso check the debt load. A highly leveraged company that maintains a dividend through a downturn may survive, but paying shareholders while loaded with debt is a choice that limits financial flexibility.",
        tool: { label: "Open DCF Tool", href: "/valuation/dcf" },
      },
      {
        title: "Think about the tax treatment",
        body: "Qualified dividends (from most US corporations, held more than 60 days) are taxed at long-term capital gains rates: 0%, 15%, or 20%. Non-qualified dividends - from REITs, MLPs, and short-held positions - are taxed as ordinary income.\n\nFor high-income investors, a REIT yielding 5% in a taxable account can have an effective after-tax yield below 3%. The same holding inside a Roth IRA is fully sheltered.",
      },
    ],
  },

  {
    id: "short-selling",
    type: "deepdive",
    category: "portfolio",
    title: "Short Selling: The Mechanics and the Math",
    tagline: "How shorting actually works, why the risk profile is fundamentally different from going long, and why most retail investors shouldn't do it.",
    readMin: 6,
    aiAngle: "Assess whether [TICKER] has characteristics that make it a credible short candidate - and the risks of that position.",
    opening: "Short selling is the practice of profiting from a stock's decline. It sounds symmetrical to buying. It is not. The mechanics create a risk profile that is structurally different in ways that matter enormously.",
    sections: [
      {
        heading: "How it works",
        body: "To short a stock, you borrow shares from another investor (through your broker), sell them immediately at the current price, and hope to buy them back later at a lower price. The profit is the difference.\n\nShort XYZ at $100. Buy back at $60. Profit: $40 per share minus borrow cost and any dividends paid while short.\n\nThe borrow cost varies significantly. Easy-to-borrow large-cap stocks may cost 0.5% annually. Hard-to-borrow small caps can cost 30 to 100% annually, which eats heavily into any gain.",
        callout: "Short interest, borrow cost, and institutional ownership all affect whether a short thesis can be profitable even when it is analytically correct.",
      },
      {
        heading: "The asymmetry that makes shorting dangerous",
        body: "When you buy a stock, your maximum loss is 100% of what you paid. The position cannot go below zero.\n\nWhen you short a stock, your maximum loss is theoretically unlimited. A stock at $10 can go to $50. To $200. To $800. Each of those moves forces additional losses on your short position with no ceiling.\n\nThis asymmetry means that being right about a company eventually is not enough. You have to be right within a timeframe you can survive financially.",
      },
      {
        heading: "Short squeezes",
        body: "If a heavily shorted stock rises sharply, short sellers are forced to buy back shares to limit losses. This buying pushes the price up further, triggering more forced buying. This feedback loop is a short squeeze.\n\nGameStop in January 2021 is the most famous recent example. The stock went from $20 to $483 in two weeks. Short sellers who were analytically correct about the business lost billions because the timing was wrong and the squeeze was violent.\n\nHigh short interest (percentage of the float held short) in a stock makes it vulnerable to squeezes regardless of fundamentals.",
      },
      {
        heading: "When shorting might be appropriate",
        body: "Short selling makes sense in a handful of situations: you have genuine informational edge on an accounting issue or fraud (rare), you are hedging a concentrated long position in the same sector, or you are running a long-short portfolio with specific risk management infrastructure.\n\nFor retail investors without short-selling infrastructure and risk management discipline, a put option is a structurally safer way to express a bearish view. The maximum loss is limited to the premium paid.",
        tool: { label: "View Portfolio", href: "/portfolio" },
      },
    ],
    takeaways: [
      "Short positions have unlimited theoretical loss, unlike long positions capped at 100%",
      "Being analytically correct is insufficient - timing and borrow cost both matter",
      "High short interest creates short squeeze risk that can overwhelm any fundamental thesis",
      "Put options are a structurally safer tool for most retail investors with a bearish view",
    ],
  },

  {
    id: "options-basics",
    type: "deepdive",
    category: "portfolio",
    title: "Options Explained Without the Complexity Theater",
    tagline: "Calls, puts, covered calls, and protective puts - what they actually do and when they make sense.",
    readMin: 8,
    aiAngle: "Assess the options landscape for [TICKER] - implied volatility, key strike levels, and whether a covered call or protective put could make sense.",
    opening: "Options have a reputation for being complex. The math can be. The core concepts are not. An option is a contract that gives you the right, but not the obligation, to buy or sell a stock at a specific price before a specific date. That sentence contains the entire framework.",
    sections: [
      {
        heading: "Calls: the right to buy",
        body: "A call option gives you the right to buy 100 shares of a stock at the strike price before the expiration date.\n\nYou pay a premium upfront. If the stock rises above the strike price before expiration, you can exercise the option and buy at the lower strike price - or sell the option itself for a profit.\n\nIf the stock stays below the strike price, the option expires worthless and you lose the premium. Maximum loss is the premium paid. Maximum gain is theoretically unlimited as the stock rises.\n\nCalls are a leveraged way to bet on a stock rising. A stock move of 10% can produce a call option gain of 50 to 100% or more, depending on the strike and expiry.",
      },
      {
        heading: "Puts: the right to sell",
        body: "A put option gives you the right to sell 100 shares at the strike price before expiration.\n\nA protective put is bought on a stock you already own. If the stock falls below the strike price, you can sell at the higher strike price. It is portfolio insurance - you pay a premium (the option cost) to limit your downside.\n\nA speculative put is bought without the underlying stock, to profit from a decline.",
        callout: "Buying a put to protect a long position you hold is not pessimism. It is risk management. The premium is the cost of insurance.",
      },
      {
        heading: "Covered calls: generating income from stocks you own",
        body: "A covered call means you sell a call option on shares you already hold. You collect the premium immediately. In exchange, you cap your upside at the strike price.\n\nExample: you own 100 shares of XYZ at $50. You sell a call with a $55 strike for $2 premium. You collect $200. If the stock stays below $55 at expiration, you keep the $200 and your shares. If it rises above $55, your shares are called away at $55 - you miss the upside above that.\n\nCovered calls are most useful on positions where you have a price target anyway, or where you want to incrementally reduce exposure while earning income.",
        tool: { label: "View Your Holdings", href: "/portfolio" },
      },
      {
        heading: "The critical variable: implied volatility",
        body: "Options are priced based partly on implied volatility - the market's expectation of how much the stock will move. High implied volatility means expensive options. Low implied volatility means cheaper ones.\n\nBuying options when implied volatility is high (before earnings, after a spike in uncertainty) means you are paying a premium for protection. Selling options (covered calls) when implied volatility is high earns richer premiums.\n\nUnderstanding whether you are buying or selling volatility is more important than understanding the math. Options buyers need large moves to profit. Options sellers profit from stability.",
      },
    ],
    takeaways: [
      "Calls give the right to buy; puts give the right to sell - both require paying a premium",
      "Covered calls generate income from existing holdings by capping upside at the strike price",
      "Protective puts are portfolio insurance - you pay a premium to limit downside on a position you hold",
      "Implied volatility determines option pricing - high IV means expensive to buy, lucrative to sell",
    ],
  },

  {
    id: "inflation-portfolio",
    type: "deepdive",
    category: "macro",
    title: "Inflation and Your Portfolio: What Actually Holds Up",
    tagline: "Not all assets perform the same in inflationary environments. The standard playbook is less reliable than most investors assume.",
    readMin: 6,
    aiAngle: "Assess how [TICKER]'s business model, pricing power, and cost structure would hold up in a sustained inflationary environment.",
    opening: "The 2021 to 2023 inflation cycle was the first in 40 years significant enough to matter to most investors. The textbook responses - buy real assets, avoid long-duration bonds - were partially right and partially wrong. The reality is more nuanced.",
    sections: [
      {
        heading: "What inflation actually does to asset prices",
        body: "Inflation reduces the purchasing power of fixed future payments. A bond paying $50 per year is worth less when prices are rising, because $50 buys less over time. This is why rising inflation drives bond prices down and yields up.\n\nEquities are more complex. Stocks represent ownership of real businesses. In theory, companies can raise prices to offset inflation, protecting real returns. In practice, the ability to do this varies enormously by business type.",
      },
      {
        heading: "Which businesses hold up and which do not",
        body: "Businesses with strong pricing power hold up well: consumer staples (people still buy food and household goods at higher prices), energy companies (commodity prices rise with inflation), and businesses with long-term contracts with escalation clauses.\n\nBusinesses that struggle: companies with high fixed costs that cannot be passed on, retailers with thin margins and no pricing power, and any business that sells discretionary products where consumers cut back when purchasing power falls.\n\nGrowth stocks, particularly those with profits far in the future, get doubly hurt: inflation raises the discount rate used to value those future profits, compressing multiples at the same time that input costs rise.",
        callout: "Pricing power is the single most important characteristic for an equity to hold up in inflation. Companies that can raise prices without losing customers compound through inflationary periods.",
      },
      {
        heading: "The real asset case - and its limits",
        body: "Real assets (commodities, real estate, infrastructure) have historically provided inflation protection. Commodity prices often rise directly with inflation. Real estate rents tend to escalate with prices.\n\nThe limits: real estate is highly leveraged in rising rate environments, which compresses returns. Commodity exposure is volatile and timing-dependent. Infrastructure is capital-intensive and depends on regulatory frameworks.\n\nTIPS (Treasury Inflation-Protected Securities) offer direct inflation linkage with no credit risk. The tradeoff is low real yields - they protect purchasing power without generating real returns.",
        tool: { label: "View Macro Dashboard", href: "/macro" },
      },
      {
        heading: "The practical portfolio implication",
        body: "Rather than large structural shifts, the more durable inflation response is at the stock selection level:\n\n- Prioritize businesses with demonstrated pricing power over the past two years\n- Be cautious on high-duration growth stocks when inflation resurges\n- Ensure debt-heavy companies in the portfolio have fixed-rate financing\n- Review commodity and energy exposure - small allocations provide hedging without speculation\n\nMacro shifts at the portfolio level (sell all bonds, buy all commodities) are difficult to time and often arrive after the move has already happened.",
      },
    ],
    takeaways: [
      "Pricing power is the key equity characteristic in inflationary environments - not sector",
      "High-duration growth stocks are doubly hurt: rising discount rates compress multiples while input costs rise",
      "Real assets offer inflation protection but come with their own structural risks",
      "Stock-level selection for pricing power is more durable than broad macro portfolio shifts",
    ],
  },

  {
    id: "index-vs-stock-picking",
    type: "deepdive",
    category: "portfolio",
    title: "Index Funds vs. Stock Picking: An Honest Assessment",
    tagline: "The evidence favors indexing for most investors. Understanding why helps you decide where active management might still make sense.",
    readMin: 6,
    aiAngle: "Assess whether [TICKER] has the characteristics - moat, pricing power, long runway - that would justify owning it individually rather than through an index.",
    opening: "The indexing debate is often framed as a binary: either you believe in active management or you don't. The reality is more granular. Indexing wins on average. Individual stock selection can win in specific circumstances. The question is whether your circumstances qualify.",
    sections: [
      {
        heading: "What the data actually shows",
        body: "Over any 15-year period, roughly 85 to 90% of actively managed large-cap US equity funds underperform the S&P 500 after fees. This is not because fund managers are incompetent. It is because markets are reasonably efficient, fees compound against you, and the average manager is, by definition, average.\n\nAmong individual retail investors, the gap is even wider. Research consistently shows that individual investors underperform the market by 1 to 3% annually due to poor timing, excessive trading, and behavioral biases.",
        callout: "Underperformance is not about intelligence. It is structural. A 1% expense ratio compounded over 30 years consumes roughly 26% of ending wealth. The market does not need to be perfectly efficient for indexing to win.",
      },
      {
        heading: "Where individual stock selection can add value",
        body: "Active stock selection can outperform in three circumstances:\n\n- You have genuine informational or analytical edge on specific companies in an industry you know deeply\n- You are targeting small-cap and mid-cap stocks where analyst coverage is thin and mispricings persist longer\n- You have the temperament to hold through significant volatility without making behavioral errors\n\nLarge-cap US equities are the hardest market in the world to outperform consistently. Every major stock has hundreds of analysts covering it. The information edge available to retail investors is minimal.",
      },
      {
        heading: "A rational framework for combining both",
        body: "Most sophisticated investors use a core-satellite approach:\n\nThe core - 70 to 80% of the portfolio - is indexed in low-cost broad market ETFs. This ensures market returns with minimal cost and effort.\n\nThe satellite - 20 to 30% - is allocated to individual stocks or sector bets where you have genuine conviction and analytical work to support it.\n\nThis approach lets you pursue alpha without betting your financial future on your ability to beat a market that defeats most professionals.",
        tool: { label: "View Portfolio Allocation", href: "/portfolio" },
      },
      {
        heading: "The honest case for individual stocks",
        body: "An index fund will never give you a 10x return on a single position. It will not give you the deep understanding of a business that comes from years of following it. And it will not let you act on genuine insight when you have it.\n\nOwning individual stocks is legitimate. The conditions are: low fees (you are your own fund manager), genuine analytical work, long holding periods, and the emotional capacity to hold through drawdowns without panicking. Meet those conditions and the case for individual stocks stands.",
      },
    ],
    takeaways: [
      "85 to 90% of active funds underperform over 15 years - fees and market efficiency are structural headwinds",
      "Individual stock selection can add value in small-caps, deep-knowledge sectors, or with genuine informational edge",
      "A core-satellite approach - indexed core plus high-conviction individuals - is the most rational structure for most investors",
      "Individual stocks are legitimate if you have low costs, real analytical work, long horizons, and emotional discipline",
    ],
  },

  // ── ADVANCED (High Conviction / Expert) ─────────────────────────────────────

  {
    id: "running-concentrated-portfolio",
    type: "playbook",
    category: "advanced",
    title: "Running a Concentrated Portfolio",
    tagline: "Deliberately owning 8 to 12 positions requires a different set of disciplines than diversification. Here is the operating framework.",
    readMin: 8,
    aiAngle: "Assess how [TICKER] fits within a high-conviction concentrated portfolio - weight, thesis strength, and its role in the overall construction.",
    steps: [
      {
        title: "Accept the premise: concentration is the strategy",
        body: "A concentrated portfolio is not a diversified portfolio with positions removed. It is a fundamentally different approach to investing, based on the premise that genuine understanding of a small number of excellent businesses - held for long periods - outperforms broad exposure to businesses you know less well.\n\nThis premise is supported by evidence. The best long-term investment returns have come from concentrated ownership of exceptional businesses. So have the worst. Concentration amplifies outcomes. The discipline is ensuring your outcomes are amplified in the right direction.",
        tip: "The minimum requirement to run a concentrated portfolio: you must be able to explain each holding in two sentences, name the key risk to the thesis, and state the condition under which you would sell.",
      },
      {
        title: "Define your universe ruthlessly",
        body: "With 8 to 12 slots, the admission standard has to be higher than 'this seems like a good business.' Each position needs to clear a bar that most companies do not:\n\n- A durable competitive advantage you can articulate specifically\n- A management team with a track record of capital allocation\n- A valuation where the margin of safety is adequate given uncertainty\n- A business you understand well enough to evaluate new information quickly\n\nThe universe of businesses that genuinely clear all four criteria is small. This is not a bug. It is the filter that makes the strategy work.",
      },
      {
        title: "Size positions based on conviction and downside, not optimism",
        body: "A high-conviction concentrated portfolio is not a collection of equally-sized positions. Your strongest ideas, with the clearest theses and lowest uncertainty, deserve larger weights.\n\nA practical framework: tier positions into 3 bands:\n- Core (12 to 18%): businesses you know deeply, thesis is clear, risk is definable\n- Standard (7 to 12%): high conviction but more uncertainty or shorter track record\n- Watch (3 to 5%): building position while thesis develops, or recent purchase not yet confirmed\n\nTotal positions across all tiers: 8 to 12. No more.",
        tip: "If you find yourself holding 15 positions, something has been added without something being removed. The discipline of the structure is maintained by treating it as a closed set with explicit admission criteria.",
      },
      {
        title: "Build deep knowledge on each position",
        body: "Concentrated investing rewards knowledge over breadth. For each position:\n\n- Read every 10-K and 10-Q the year you initiate the position\n- Listen to every earnings call (the transcript is sufficient; the audio is optional)\n- Track competitor filings for context on industry dynamics\n- Maintain a living thesis document updated with each new piece of information\n\nThe edge in a concentrated portfolio comes from understanding a business better than the market does. That understanding is only maintained through consistent, ongoing attention.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
      {
        title: "Manage the emotional mathematics of large drawdowns",
        body: "A 15% position that falls 40% drops your total portfolio by 6%. That is real money. The emotional experience of watching a single holding fall that much while you hold is qualitatively different from watching a diversified portfolio fall the same total amount.\n\nThis is not a reason to avoid concentration. It is a reason to be honest with yourself about your temperament before adopting the strategy. The investors who succeed with concentrated portfolios have trained themselves to ask one question when a position falls: has the thesis changed? Not: how much have I lost?",
      },
      {
        title: "Set your sell discipline before you need it",
        body: "In a concentrated portfolio, selling decisions are rarer and higher-stakes than in a diversified one. Selling a 15% position without a replacement idea materially changes your risk profile. Holding too long out of attachment destroys returns.\n\nDefine in advance: the thesis condition that would trigger a sale, the valuation level at which you would trim, and the position size that would trigger forced rebalancing regardless of thesis conviction. These decisions made under calm conditions are better than decisions made under price pressure.",
        tool: { label: "View Current Positions", href: "/portfolio" },
      },
    ],
  },

  {
    id: "conviction-sizing",
    type: "playbook",
    category: "advanced",
    title: "Sizing a High-Conviction Position",
    tagline: "The framework for going 15 to 20% in a single name - what justifies it and what disciplines it.",
    readMin: 6,
    aiAngle: "Work through the conviction sizing framework for a potential 15 to 20% position in [TICKER] - thesis quality, downside scenario, and portfolio impact.",
    steps: [
      {
        title: "Establish that the conviction is earned, not felt",
        body: "High conviction is not an emotion. It is the product of specific work:\n\n- You have read several years of filings and understand how the business makes money in detail\n- You have a variant view from consensus - you believe something about the business that the market price does not reflect\n- You can articulate the downside scenario and explain why you are comfortable with it\n- You have held the position through at least one meaningful correction and maintained the thesis\n\nConviction built on a compelling narrative, an enthusiastic CEO, or three years of rising stock price is not conviction. It is recency bias with a thesis stapled to it.",
        tip: "If your conviction increased after the stock went up, examine whether the new information is doing the work or whether the price action is.",
      },
      {
        title: "Run the downside scenario before you size up",
        body: "Before increasing to a large position, build the bear case explicitly:\n\nWhat is the worst realistic outcome for this business over three years? Not the catastrophic scenario - the plausible bad outcome. What does the stock price look like in that scenario?\n\nNow calculate: if this position falls 40% from a 15% weight, your total portfolio falls 6%. Is that acceptable? Can you fund living expenses, stay invested, and not be forced to sell? If the answer to any of those questions is no, the size is too large regardless of conviction.",
      },
      {
        title: "Build the position over time, not all at once",
        body: "A 15 to 20% position should typically be built over three to six months, not purchased in a single transaction. This serves two purposes:\n\nFirst, it gives you more data points. Buying over time means you will see at least one piece of news, one quarterly update, or one market reaction to incorporate before you are at full size.\n\nSecond, it averages your entry cost across different price points. This reduces the risk of being fully sized at the worst possible moment.",
      },
      {
        title: "Set an explicit maximum and honor it",
        body: "Define the maximum percentage before you start buying. 15%, 18%, 20% - pick a number and treat it as a hard ceiling.\n\nThe natural temptation as a position appreciates is to let it run. If a 15% position doubles, it becomes 25 to 27% of your portfolio through appreciation alone. At that point, you are no longer choosing to run a 20% position. It has chosen itself. Systematic trimming back to your maximum maintains the structure you chose.",
      },
      {
        title: "Review the size decision annually, not just the thesis",
        body: "Separate the question of whether to own the stock from the question of how much to own. The thesis may be fully intact while the appropriate position size has changed:\n\n- Your financial situation has changed (upcoming large expense, income change)\n- The stock's volatility has increased materially\n- The business has grown to a market cap where the original growth thesis no longer supports the same upside\n\nAnnual size review is a distinct exercise from thesis review. Do both.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
    ],
  },

  {
    id: "asymmetric-bets",
    type: "playbook",
    category: "advanced",
    title: "Identifying Asymmetric Bets",
    tagline: "Situations where the upside is 5x or more and the downside is definable. How to find them, size them, and not confuse them with speculation.",
    readMin: 7,
    aiAngle: "Assess whether [TICKER] has the characteristics of a genuine asymmetric setup - identifiable downside, large optionality on the upside.",
    steps: [
      {
        title: "Understand what asymmetry actually means",
        body: "An asymmetric bet is one where the expected upside, probability-weighted, is significantly larger than the expected downside. This requires two things to be true simultaneously: you can define the downside with reasonable confidence, and the upside is much larger.\n\nThis is different from a volatile stock or a speculative position. A speculative position has undefined, potentially unlimited downside. An asymmetric bet has a floor you can estimate - a balance sheet, a liquidation value, a contract in place - and a ceiling that is much higher than the current price.",
        tip: "The floor is as important as the ceiling. If you cannot articulate what the stock is worth in the bad scenario, you do not have an asymmetric bet. You have speculation.",
      },
      {
        title: "Look for businesses the market is mispricing for temporary reasons",
        body: "The most common source of genuine asymmetry is a business that the market has mispriced due to a fixable, temporary problem:\n\n- A cyclical company near the bottom of an industry cycle\n- A turnaround where the new management has a credible track record but the market has not priced in the change\n- A company with near-term earnings pressure hiding long-term unit economics that are excellent\n- A spin-off that has been dumped by institutional holders for non-fundamental reasons\n\nIn each case, the business is worth significantly more than the current price if the temporary problem resolves. The job is identifying whether the problem is actually temporary.",
      },
      {
        title: "Quantify the upside with specific scenarios",
        body: "Asymmetric bets require explicit scenario analysis, not vague upside narratives.\n\nBull case: what does this business earn in three years if things go well? What multiple does that justify? What is the stock price?\n\nBase case: what is the most likely outcome? What does the stock price look like?\n\nBear case: what is the plausible bad outcome, not the catastrophe? What does the stock price look like?\n\nIf the bull case is 3x from here, the base case is 1.5x, and the bear case is -40%, the expected value is meaningfully positive. That is worth sizing. If the bull case is 50%, the base case is 0%, and the bear case is -70%, you have a lottery ticket, not an asymmetric bet.",
        tool: { label: "Run Reverse DCF", href: "/valuation/reverse-dcf" },
        miniTool: { id: "expected-value", label: "Run the expected value math" },
      },
      {
        title: "Size asymmetric positions appropriately",
        body: "Asymmetric bets warrant smaller initial positions than high-conviction core holdings. The higher the uncertainty, the smaller the starting position.\n\nA typical sizing approach:\n- Defined downside of 30 to 40%, clear upside of 3x or more: 5 to 8% initial position\n- Defined downside of 50 to 60%, speculative upside: 2 to 3%\n- Binary event (regulatory approval, contract win): 1 to 2% maximum\n\nThe small size is not lack of conviction. It reflects the asymmetry correctly. If the upside is 5x and you are right 30% of the time, even a 3% position generates meaningful return on the portfolio.",
      },
      {
        title: "Set the sell discipline before the event",
        body: "Asymmetric bets often resolve around specific events: an earnings print, a product launch, a regulatory decision, a new contract announcement. Decide in advance:\n\n- If the event is positive, will you add or trim?\n- If the event is negative but the thesis remains, will you hold or cut?\n- If the thesis is broken regardless of the event, what triggers the exit?\n\nDeciding these in advance removes the most dangerous decision-making context: reacting to price moves under the influence of loss aversion or greed.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
    ],
  },

  {
    id: "when-to-ignore-valuation",
    type: "deepdive",
    category: "advanced",
    title: "When to Ignore Valuation (And When Not To)",
    tagline: "Some of the best investments in history looked expensive by conventional metrics for a decade. Understanding why requires a different model for certain businesses.",
    readMin: 7,
    aiAngle: "Assess whether [TICKER] belongs to the class of businesses where conventional valuation metrics are inadequate, or whether they apply normally.",
    opening: "Amazon traded at triple-digit P/E ratios or no P/E at all for most of the 2000s and 2010s. Investors who refused to buy it because it looked expensive by conventional metrics missed one of the greatest wealth-creation stories in modern markets. Understanding when valuation metrics mislead is as important as knowing how to use them.",
    sections: [
      {
        heading: "Why conventional metrics fail for certain businesses",
        body: "P/E, EV/EBITDA, and price-to-book were designed for businesses with stable, predictable economics. They work well for utilities, consumer staples, and industrials.\n\nThey break down for businesses that are deliberately investing current profits to build future competitive position. A company that could earn $2 per share today but instead spends that on engineering, customer acquisition, and infrastructure to earn $10 per share in five years will look wildly expensive on today's earnings. Those earnings are suppressed by choice, not by business weakness.\n\nUnderstanding the difference between a company that is unprofitable because the business is weak and one that is unprofitable because it is building a dominant position requires reading the unit economics, not the income statement.",
        callout: "AWS, for much of its early existence, was buried inside Amazon's consolidated financials. The parent company looked like a thin-margin retailer. The subsidiary was building one of the most profitable businesses in history.",
      },
      {
        heading: "The businesses where this logic actually holds",
        body: "The 'ignore valuation' argument is valid for a narrow category of businesses:\n\n- Platforms with network effects that become more valuable as they grow (the 100th user on a network adds more value than the first)\n- Software businesses with high switching costs and recurring revenue, where customer acquisition today generates 5 to 10 years of subscription revenue\n- Marketplaces that are approaching or have achieved winner-take-most dynamics in their category\n- Businesses compounding at 25 to 35% per year where time in the investment is the primary value driver\n\nFor businesses outside this category - cyclicals, commodities, traditional retail, most industrials - ignoring valuation is not a sophisticated strategy. It is a rationalization for overpaying.",
      },
      {
        heading: "The right tool: unit economics",
        body: "For businesses where conventional metrics mislead, the right question is: what are the unit economics of a single customer or transaction?\n\nFor a SaaS business: customer acquisition cost (CAC), lifetime value (LTV), and the LTV/CAC ratio. A ratio of 3x or above means the business generates $3 in lifetime value for every $1 spent acquiring a customer. If that ratio is high and the runway of new customers is large, spending aggressively today to acquire customers is rational, not wasteful.\n\nFor a marketplace: take rate, gross merchandise value growth, and the contribution margin of a mature cohort. A marketplace with 25% take rates and cohorts that generate 40% contribution margins is worth investing in at multiples that look extreme on near-term revenue.",
        tool: { label: "Open DCF Tool", href: "/valuation/dcf" },
      },
      {
        heading: "The hard limit of this argument",
        body: "The 'ignore valuation' argument has a hard limit: the time value of money is real, and optionality has a price.\n\nPaying 50x revenue for a software business requires it to grow into that valuation. If growth slows, the multiple compresses and the stock falls even if the business continues to do well. This happened to nearly every high-multiple software stock in 2022.\n\nThe framework for avoiding this error: even if you don't use P/E, use a long-horizon DCF and sensitivity-test the terminal value assumptions. If the investment only works if the business executes perfectly for 15 years, the margin of safety is negative. Businesses where the case is robust to a range of outcomes are different from businesses where only the best case justifies the price.",
      },
    ],
    takeaways: [
      "Conventional valuation metrics fail for businesses deliberately suppressing profits to build competitive position",
      "Network effects, switching costs, and marketplace dynamics create businesses where conventional metrics mislead",
      "Unit economics (LTV/CAC, contribution margin by cohort) are the right lens for these businesses",
      "Even for these businesses, long-horizon DCF sensitivity analysis is required - only the best case justifying the price is not a margin of safety",
    ],
  },

  {
    id: "high-beta-portfolio",
    type: "deepdive",
    category: "advanced",
    title: "Managing a High-Beta Portfolio Through Volatility",
    tagline: "What 30 to 50% drawdowns feel like in practice, what the math of recovery requires, and how to stay rational when it is hardest.",
    readMin: 7,
    aiAngle: "Assess [TICKER]'s beta and volatility profile and what a 30 to 40% drawdown would mean for a portfolio with significant exposure.",
    opening: "A portfolio of high-growth, high-conviction equities with average beta of 1.5 to 2.0 will, at some point, experience a 40 to 50% drawdown. Not might. Will. The question is not whether you can accept volatility in the abstract. It is whether you can hold through -40% in practice, when the financial press is describing permanent structural change and everyone around you is selling.",
    sections: [
      {
        heading: "The math is worse than it feels",
        body: "A 30% decline requires a 43% gain to recover. A 40% decline requires a 67% gain. A 50% decline requires a 100% gain.\n\nFor a high-beta portfolio that declines 45% from peak, full recovery at a 15% annual return takes approximately four years. At 10% annual return, it takes seven years. These are not edge cases. They are the expected experience of running a concentrated, high-beta equity portfolio through a bear market.",
        callout: "The investors who compound best over 20 years are not the ones who avoid drawdowns. They are the ones who do not sell at the bottom.",
      },
      {
        heading: "What makes drawdowns psychologically different from the numbers",
        body: "Reading that your portfolio fell 40% is manageable. Experiencing it in real time over six to twelve months is qualitatively different.\n\nThe first 15%: discomfort, but confidence the thesis is intact.\nThe next 15%: serious doubt, reading every negative article, questioning the original analysis.\nThe final 10 to 20%: the capitulation zone. Maximum pain coincides with maximum negative news flow. This is when most investors sell, locking in the loss and missing the recovery.\n\nKnowing this pattern in advance does not immunize you against it. But it helps you recognize which phase you are in and apply the right question: has the thesis changed, or has the price?",
      },
      {
        heading: "Pre-drawdown actions that make it survivable",
        body: "The time to prepare for a drawdown is before it happens:\n\n- Hold enough cash or short-duration assets to fund living expenses for two to three years without selling equities\n- Write the thesis for each major position. Re-reading it at -30% tells you whether the business changed or the price did\n- Set explicit hold-through conditions: 'I will not sell position X unless revenue growth falls below Y or management makes decision Z'\n- Discuss the strategy with anyone whose financial wellbeing is affected. A partner who panics when the portfolio falls 35% creates pressure that breaks discipline\n\nNone of these prevent drawdowns. They make holding through them possible.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
      {
        heading: "When adding during a drawdown is right and when it is not",
        body: "Averaging down into a high-conviction position during a market-driven drawdown - where fundamentals are intact and the decline reflects broad selling rather than business deterioration - is historically one of the highest-return actions available.\n\nThe condition is critical: the thesis must be intact. Adding to a position because the price is lower, without confirming the business is still what you thought it was, is not conviction. It is anchoring to a cost basis.\n\nFor each position during a drawdown, the question is binary: do the fundamentals support the original thesis? If yes, the drawdown is an opportunity. If the answer is uncertain, wait for more information before adding. If no, the size of the loss is irrelevant to the sell decision.",
      },
    ],
    takeaways: [
      "A 40 to 50% drawdown is the expected experience of a high-beta concentrated portfolio over any decade",
      "Recovery math is severe: a 50% drawdown requires a 100% return to break even",
      "The capitulation zone - maximum psychological pain - coincides with maximum negative news, the worst time to sell",
      "Pre-drawdown preparation (cash runway, written theses, explicit hold conditions) determines whether you survive behavioral mistakes",
    ],
  },

  {
    id: "growth-vs-value",
    type: "deepdive",
    category: "advanced",
    title: "Growth vs. Value: Why the Best Investors Reject the Dichotomy",
    tagline: "The framing that divides investing into two camps is analytically wrong and practically harmful. Here is a more useful model.",
    readMin: 6,
    aiAngle: "Assess whether [TICKER] is best understood as a growth investment, a value investment, or something that transcends the distinction.",
    opening: "Every year, financial media tracks whether 'growth is outperforming value' or vice versa. Entire fund categories are built around the distinction. And yet, Warren Buffett has said explicitly that growth and value are not separate approaches - growth is a component of value. He is right. The framing is a simplification that leads to real analytical errors.",
    sections: [
      {
        heading: "What the labels actually mean in practice",
        body: "In practice, 'value' stocks are those trading at low multiples relative to current earnings, book value, or cash flow. 'Growth' stocks trade at high multiples relative to current fundamentals.\n\nThe problem: a stock trading at P/E 8 is not cheap if its earnings are about to decline. A stock trading at P/E 40 is not expensive if it is compounding earnings at 30% annually.\n\nThe labels describe current multiples, not future returns. Current multiples are only half the valuation equation. The other half is what the business will earn in the future.",
        callout: "A business is worth the present value of its future cash flows. Whether those cash flows are mostly 'now' or mostly 'later' determines the multiple - but value is the same concept either way.",
      },
      {
        heading: "GARP: growth at a reasonable price",
        body: "The analytical framework that bridges the false dichotomy is GARP - Growth At a Reasonable Price. It asks: for the growth rate this business can sustain, is the current multiple reasonable?\n\nA useful check: the PEG ratio (P/E divided by expected earnings growth rate). A PEG below 1.0 suggests the multiple may not fully reflect the growth available. A PEG above 2.0 means the growth is priced in and more.\n\nGARP is not a formula. It is a discipline: paying a premium multiple is defensible when growth is durable and reinvestment opportunities are rich. Paying a premium multiple for growth that is fading or cyclical is not.",
      },
      {
        heading: "When 'growth' stocks are the real value plays",
        body: "Some of the most undervalued stocks in history have looked expensive by conventional metrics:\n\n- A compounder with 20% return on equity, reinvesting all earnings, growing book value at 20% annually, trades at 3x book. Cheap or expensive? It depends on how long it can sustain that ROE.\n- A platform business with 40% gross margins and 80% customer retention growing at 25% annually. Conventional metrics show expensive. DCF with realistic compounding shows significant undervaluation.\n\nThe key variable is reinvestment rate and return on incremental capital. A business that earns 30% on each dollar reinvested and has a decade of reinvestment runway is worth more than a static business with the same current earnings.",
        tool: { label: "Run DCF Analysis", href: "/valuation/dcf" },
      },
      {
        heading: "The discipline that matters",
        body: "Rejecting the growth/value dichotomy does not mean accepting any price for a great business. It means using the right tools:\n\n- Use DCF with sensitivity analysis, not P/E alone\n- Evaluate return on incremental invested capital, not current margins\n- Assess runway length: how many years can this business reinvest at high rates?\n- Price in the risk of that runway ending earlier than expected\n\nThe investor who buys a genuinely excellent business at a fair price and holds it through volatility will likely outperform both the 'value' investor anchored to low multiples and the 'growth' investor who pays any price for momentum.",
      },
    ],
    takeaways: [
      "Growth and value are not opposing strategies - growth is a component of intrinsic value",
      "Low P/E is not cheap if earnings are declining; high P/E is not expensive if growth more than compensates",
      "GARP (Growth at a Reasonable Price) is the practical synthesis: premium multiples are defensible when growth is durable",
      "Return on incremental invested capital and reinvestment runway are more important than current margins",
    ],
  },

  // ── RISK MANAGEMENT ─────────────────────────────────────────────────────────

  {
    id: "position-sizing",
    type: "playbook",
    category: "risk",
    title: "Position Sizing: How Much to Actually Allocate",
    tagline: "Most investors skip this step entirely. It's the one that determines whether a losing trade is painful or fatal.",
    readMin: 7,
    aiAngle: "Calculate an appropriate position size for [TICKER] based on conviction level, volatility, and portfolio context.",
    steps: [
      {
        title: "Start with portfolio size, not conviction",
        body: "The first question is not how much you like a stock. It is how much of your total portfolio you can afford to lose on a single idea and still be okay.\n\nA rule used by professional portfolio managers: no single position should represent a risk exposure where a complete loss materially changes your financial trajectory. For most investors, this caps single-position risk at 2 to 5% of total portfolio value.",
        tip: "Conviction and position size are not the same thing. High conviction is a reason to size toward the top of your band, not a reason to abandon the band entirely.",
      },
      {
        title: "Define your maximum acceptable loss before you size",
        body: "Decide, in advance, how much of a drawdown would cause you to exit the position. This is not a stop-loss order. It is a mental line that tells you whether the thesis is broken.\n\nIf you would sell if the stock fell 25%, and your maximum acceptable dollar loss is $2,000, then your maximum position size is $8,000. This is the only honest way to size a position.\n\nMaximum position size = Maximum dollar loss / Maximum loss percentage.",
        miniTool: { id: "position-from-loss", label: "Calculate your position size" },
      },
      {
        title: "Adjust for the stock's historical volatility",
        body: "A stock that swings 4% daily requires a smaller nominal position than one that moves 1% daily, to achieve the same expected dollar volatility in your portfolio.\n\nBeta is one proxy: a stock with beta 1.5 moves 50% more than the market on average. A beta-adjusted position accounts for this. If your target weight for a beta-1.0 stock is 5%, the equivalent weight for a beta-1.5 stock is closer to 3.3%.",
        tip: "Beta is backward-looking and breaks down in crises. Implied volatility from the options market is a better real-time measure of expected swings.",
      },
      {
        title: "Factor in correlation with what you already own",
        body: "Two positions in the same sector are not two independent bets. If you own three technology stocks and add a fourth, you are not diversifying. You are concentrating with extra steps.\n\nBefore adding a position, ask: if macro conditions turn hostile for this sector, how many of my current holdings get hit at the same time? If the answer is four or five, the fourth stock is not adding diversification at any size.",
        tool: { label: "View Portfolio Allocation", href: "/portfolio" },
      },
      {
        title: "Scale in rather than buying the full position immediately",
        body: "Starting at half the intended size and adding on confirmation reduces the risk of being immediately wrong at full exposure.\n\nA practical approach: buy half the target position when you have conviction. If the thesis develops as expected over 30 to 60 days, add the second half. If the stock moves against you before confirmation, you have half the drawdown and a chance to reassess with new information.",
        tip: "Scaling in is not the same as averaging down into a losing thesis. One is disciplined position building. The other is hope masquerading as a strategy.",
      },
      {
        title: "Trim positions that outperform, not underperform",
        body: "If a position grows to 3x the intended size due to appreciation, the portfolio math has changed even if the thesis has not. A 5% allocation that becomes 15% through gains now carries 3x the original risk exposure.\n\nTrimming into strength is disciplined risk management. It is not selling your best ideas. You keep the position and the upside. You reduce concentration and the downside.",
        tool: { label: "Check Position Weights", href: "/portfolio" },
      },
    ],
  },

  {
    id: "managing-a-drawdown",
    type: "playbook",
    category: "risk",
    title: "Managing a Drawdown: What to Do When a Position Goes Wrong",
    tagline: "The 48-hour rule, the thesis review, and when cutting a loss is the right answer.",
    readMin: 6,
    aiAngle: "Walk through the drawdown decision framework for [TICKER] - whether the thesis is intact, whether this is temporary, and what to do next.",
    steps: [
      {
        title: "Wait 48 hours before doing anything",
        body: "The first instinct when a position drops 15% is to act. The first 48 hours after a significant move are the worst possible time to make a decision. The news is still unfolding. Your emotional state is at its least reliable. Markets often overcorrect in both directions.\n\nThe only action appropriate in the first 48 hours is reading. Not trading.",
      },
      {
        title: "Separate company-specific decline from market noise",
        body: "A stock can fall for three reasons: the business deteriorated, the sector fell, or the broad market fell. Only the first one requires you to revisit the thesis.\n\nIf your stock is down 15% but the sector ETF is down 12% and the S&P is down 8%, your company has underperformed by 3%. That's worth watching, but it's not the same as a business-specific problem. Context changes the entire analysis.",
      },
      {
        title: "Go back to the original thesis and ask one question",
        body: "Write down the core premise you bought the stock on. It should be one or two sentences. Then ask: is this still true?\n\nNot: has the stock recovered? Not: was I right about the price? The question is whether the underlying business case you bet on is intact. If the thesis is intact, the decline may be an opportunity. If it is not, hold the current price is irrelevant.",
        tip: "If you cannot remember why you bought the stock, that itself is information. You did not have a strong enough thesis to begin with.",
        tool: { label: "Open Thesis Notebook", href: "/thesis" },
      },
      {
        title: "Identify whether the decline is temporary or structural",
        body: "Temporary setbacks: one bad quarter, a macro headwind affecting the whole sector, a specific product delay, or a management change. These can resolve.\n\nStructural deterioration: a core competitive advantage is being eroded, pricing power is declining, customer acquisition costs are rising faster than revenue, or a superior substitute is taking market share.\n\nTemporary problems warrant patience. Structural deterioration warrants action regardless of the price.",
      },
      {
        title: "Set a price at which you will cut, and honor it",
        body: "Before you hold through a drawdown, define the line where you will sell regardless of thesis conviction.\n\nThis is not a stop-loss order. It is an explicit acknowledgment that if the stock reaches price X, you have been wrong enough that reassessment from scratch is required. Most investors never set this line, which means they hold falling stocks indefinitely while repeating that the thesis is intact.\n\nA 30 to 40% drawdown from your cost basis is a reasonable default line for most positions. Past that, the math of recovery becomes brutal: a 40% loss requires a 67% gain to get back to even.",
        tip: "A stock that is down 50% requires a 100% return to break even. Time horizon matters: how many years are you willing to wait for that recovery?",
        miniTool: { id: "drawdown-recovery", label: "See the recovery math" },
      },
    ],
  },

  {
    id: "correlation-diversification",
    type: "deepdive",
    category: "risk",
    title: "Why Your Portfolio Is Less Diversified Than You Think",
    tagline: "Correlations that look low in calm markets spike to near-1 in the months that matter.",
    readMin: 7,
    aiAngle: "Analyze how [TICKER] might correlate with common portfolio holdings during market stress and whether it adds genuine diversification.",
    opening: "Investors routinely hold 20 to 30 stocks and describe their portfolios as diversified. In the 2008 financial crisis and the 2020 Covid crash, the correlation between most US equities spiked above 0.9. For a few weeks, almost everything moved together. Holding 25 stocks instead of 5 provided almost no protection.",
    sections: [
      {
        heading: "What correlation actually measures",
        body: "Correlation is a statistical measure of how two assets move relative to each other, ranging from -1 (perfect inverse relationship) to +1 (perfect lockstep). A correlation of 0 means movements are statistically unrelated.\n\nIn finance, most asset correlations sit between 0.3 and 0.8 during normal conditions. This gives a false sense of security. During stress events, correlations compress toward 1.0 as forced selling, margin calls, and panic affect all liquid assets simultaneously.",
        callout: "Diversification works best when you don't need it. It tends to fail precisely when you do.",
      },
      {
        heading: "The common sources of hidden correlation",
        body: "Correlation is not just about industry or sector. Hidden correlations often come from:\n\n- Factor exposure: holding many stocks with high beta means you're exposed to the same market risk factor, regardless of sector\n- Geographic concentration: US large-cap stocks have high correlation with each other even across sectors\n- Momentum: stocks that all appreciated for the same macro reason (falling rates, AI enthusiasm) will often decline together when that thesis reverses\n- Credit conditions: companies with high debt loads correlate strongly in credit tightening environments regardless of industry",
      },
      {
        heading: "What genuine diversification requires",
        body: "True diversification means holding assets whose returns come from different underlying economic drivers.\n\nUS equities vs international equities: different economic cycles, currencies, political risk. Not perfectly decorrelated, but meaningfully different.\n\nEquities vs bonds: in most environments, inversely correlated. (The exception is stagflation, where both fall together.)\n\nReal assets (commodities, real estate): tied to physical supply/demand cycles that don't always track financial markets.\n\nThe challenge: genuine diversification often requires accepting lower expected returns in exchange for lower variance. International equities and bonds have historically underperformed US equities over long horizons. The tradeoff is real.",
        tool: { label: "View Portfolio Allocation", href: "/portfolio" },
      },
      {
        heading: "The practical implication",
        body: "You don't need to own 30 stocks to be diversified. You need to own assets with genuinely different risk drivers.\n\nA portfolio of 10 to 15 US stocks, a broad international equity ETF, and a Treasury or bond allocation may be more genuinely diversified than a 30-stock all-US-equity portfolio.\n\nWithin equities, sector diversification matters less than factor diversification. Holding stocks across technology, healthcare, and industrials still leaves you with a highly correlated portfolio in a broad market sell-off.",
      },
    ],
    takeaways: [
      "Correlations between equities spike toward 1.0 during market stress, when diversification matters most",
      "Hidden correlation sources include beta exposure, momentum, and shared macro drivers",
      "True diversification requires assets with different economic drivers, not just different industries",
      "A smaller portfolio with genuinely uncorrelated assets beats a large portfolio of similarly-driven equities",
    ],
  },

  {
    id: "portfolio-concentration",
    type: "deepdive",
    category: "risk",
    title: "Concentration Risk: When It Helps and When It Destroys",
    tagline: "Concentrated portfolios produce the best long-term returns and the worst drawdowns. The difference is whether you're right.",
    readMin: 6,
    aiAngle: "Assess the concentration implications of holding [TICKER] and what position size would be appropriate given the risk profile.",
    opening: "The best performing investment portfolios over any 10-year period are almost always heavily concentrated. So are the worst performing ones. Concentration amplifies outcomes in both directions. The question is not whether to concentrate, but how to do it without taking risks you haven't consciously accepted.",
    sections: [
      {
        heading: "What the data shows",
        body: "Academic research consistently shows that a majority of individual stocks underperform the market over long periods. A small minority of winners drive most of the market's total return.\n\nThis creates a statistical argument for concentration in your best ideas rather than diversification across mediocre ones. The investor who correctly identifies 5 exceptional businesses and holds them for a decade will almost certainly outperform the one who hedges with 40 positions.\n\nThe challenge: identifying those 5 businesses in advance is extremely difficult. The downside of being wrong while concentrated is severe.",
      },
      {
        heading: "The math of concentrated drawdowns",
        body: "A 50% decline in a position that represents 30% of your portfolio reduces your total portfolio by 15%. To recover, you need either the position to double or the rest of your portfolio to compensate.\n\nThis is not just a math problem. It is a behavioral one. The investor who watches 30% of their portfolio fall 50% often makes the worst decision at the worst time.\n\nConcentration requires psychological durability as much as analytical conviction. Most investors overestimate their ability to hold through large drawdowns until they experience one.",
        callout: "Knowing your maximum drawdown tolerance before you concentrate is not optional. It is the entire foundation of the strategy.",
      },
      {
        heading: "How much concentration is defensible",
        body: "There is no universal answer, but a framework:\n\nFor a stock you have high conviction in, have researched thoroughly, and understand deeply: 10 to 15% of a well-diversified portfolio.\n\nFor a position that represents an asymmetric opportunity with defined downside: up to 20%.\n\nAbove 20% in any single name without extraordinary conviction and circumstances is speculation, not investing. The historical record of investors who held more than 20% in a single stock and were vindicated is short. The list of those who were not is long.",
      },
      {
        heading: "Managing concentration over time",
        body: "The most common concentration problem is not buying too much. It is holding too much after a position appreciates dramatically.\n\nA 5% position that grows to 25% through a combination of appreciation and new investment creates genuine risk that did not exist at inception. The business may be exactly as good as you expected. The position size, relative to your total wealth, has become different from what you chose.\n\nA systematic trimming approach: when any position exceeds 15%, trim to 10 to 12%. Reinvest in existing positions or new ideas. This is not a signal on the business. It is a signal on the portfolio.",
        tool: { label: "Review Your Positions", href: "/portfolio" },
      },
    ],
    takeaways: [
      "Concentration amplifies outcomes - the best and worst returns both come from concentrated portfolios",
      "A majority of individual stocks underperform the market, which argues for concentrating in your highest-conviction ideas",
      "Above 20% in any single position without exceptional circumstances crosses from investing to speculation",
      "Systematic trimming when positions grow large preserves the thesis while managing the risk exposure",
    ],
  },

];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPlaybooks(): Playbook[] {
  return LEARN_CONTENT.filter((i): i is Playbook => i.type === "playbook");
}

export function getDeepDives(): DeepDive[] {
  return LEARN_CONTENT.filter((i): i is DeepDive => i.type === "deepdive");
}
