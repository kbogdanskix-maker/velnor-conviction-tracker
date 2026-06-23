import type { UserProfile } from "@/hooks/useProfile";

/**
 * Rule-based "For you" sidebar ranking.
 * Scores nav items by relevance to the user's profile + investing philosophy.
 * Pure + deterministic (no network, no AI) so it's instant and testable.
 */

// ── Relevance tags per nav href ──────────────────────────────────────────────
export const ITEM_TAGS: Record<string, string[]> = {
  "/portfolio": ["equities", "core"],
  "/dividends": ["income", "dividends"],
  "/dividend-calendar": ["income", "dividends"],
  "/dividend-forecast": ["income", "dividends"],
  "/watchlist": ["equities", "core"],
  "/rebalance": ["equities", "risk"],
  "/fees": ["equities", "cost"],
  "/sectors": ["equities", "diversification"],
  "/position-size": ["equities", "risk"],
  "/correlation": ["risk", "diversification"],
  "/risk": ["risk"],
  "/attribution": ["equities", "performance"],
  "/reflect": ["psychology", "discipline"],
  "/returns": ["performance"],
  "/net-worth": ["planning", "core"],
  "/nw-history": ["planning"],
  "/cash-flow": ["planning", "cashflow", "income"],
  "/expenses": ["planning", "budget"],
  "/budget": ["planning", "budget"],
  "/affordability": ["planning"],
  "/debt-payoff": ["planning", "debt"],
  "/tax": ["tax"],
  "/tax-harvest": ["tax", "equities"],
  "/income": ["income", "planning"],
  "/insurance": ["protection", "planning"],
  "/stress-index": ["psychology", "risk"],
  "/subscriptions": ["planning", "budget"],
  "/asset-location": ["tax", "planning"],
  "/behavior": ["psychology", "discipline"],
  "/fi": ["planning", "goals", "fire"],
  "/monte-carlo": ["projection", "risk", "planning"],
  "/goals": ["goals", "planning", "core"],
  "/retirement": ["retirement", "planning"],
  "/compare": ["projection", "performance"],
  "/benchmark": ["performance"],
  "/what-if": ["projection", "planning"],
  "/emergency-fund": ["protection", "planning"],
  "/milestones": ["goals"],
  "/learn": ["learning", "education"],
  "/annual-review": ["planning", "review"],
  "/fx": ["markets", "currency"],
  "/markets": ["markets", "core"],
  "/macro": ["macro", "markets"],
  "/news": ["markets", "news"],
  "/sentiment": ["markets", "psychology"],
  "/earnings-insights": ["research", "equities", "fundamentals"],
  "/thesis": ["research", "valuation"],
  "/notes": ["research"],
  "/journal": ["psychology", "discipline"],
  "/screener": ["research", "screening", "valuation"],
  "/valuation/dcf": ["research", "valuation"],
  "/valuation/reverse-dcf": ["research", "valuation"],
  "/stock-compare": ["research", "equities"],
  "/company": ["research", "valuation", "fundamentals"],
  "/plan": ["planning", "core"],
  "/health-score": ["planning", "review"],
  "/smart-alerts": ["alerts"],
};

// ── Profile fields → tag weights ─────────────────────────────────────────────
function profileBoosts(p: UserProfile): Record<string, number> {
  const b: Record<string, number> = {};
  const add = (tags: Record<string, number>) => {
    for (const [t, w] of Object.entries(tags)) b[t] = (b[t] ?? 0) + w;
  };

  switch (p.primaryObjective) {
    case "growth": add({ growth: 3, equities: 2, research: 1 }); break;
    case "income": add({ income: 3, dividends: 3, cashflow: 2 }); break;
    case "preservation": add({ risk: 3, protection: 2, diversification: 2 }); break;
    case "target": add({ goals: 3, planning: 2, projection: 1 }); break;
    case "learning": add({ learning: 3, education: 2, core: 1 }); break;
  }
  switch (p.riskTolerance) {
    case "conservative": add({ risk: 2, protection: 1, diversification: 1 }); break;
    case "aggressive": add({ growth: 2, equities: 1, research: 1 }); break;
  }
  switch (p.sophistication) {
    case "advanced": add({ research: 2, valuation: 2, screening: 1 }); break;
    case "beginner": add({ learning: 2, education: 1, core: 1 }); break;
  }
  switch (p.timeHorizon) {
    case "long": add({ retirement: 1, fire: 1, projection: 1 }); break;
    case "short": add({ risk: 1, planning: 1 }); break;
  }
  // De-emphasis pushes matching tags down hard.
  for (const d of p.deEmphasize) {
    if (d === "retirement") add({ retirement: -5, fire: -3 });
    if (d === "income") add({ income: -4, dividends: -4 });
    if (d === "tax") add({ tax: -5 });
    if (d === "volatility") add({ risk: -3 });
  }
  return b;
}

// ── Philosophy free-text → tags ──────────────────────────────────────────────
const PHILOSOPHY_RULES: { re: RegExp; tags: string[] }[] = [
  { re: /undervalu|valuation|intrinsic|fair value|cheap|margin of safety|dcf/, tags: ["valuation", "research"] },
  { re: /dividend|yield|payout|distribution/, tags: ["income", "dividends"] },
  { re: /\bincome\b|cash flow|free cash|fcf/, tags: ["income", "cashflow", "valuation"] },
  { re: /momentum|trend|breakout|technical/, tags: ["screening", "equities"] },
  { re: /short interest|short squeeze|shorting|overvalued|excessive selling/, tags: ["screening", "research"] },
  { re: /growth|revenue|expansion|compound|scal(e|ing)|ecosystem|market share|capturing market/, tags: ["growth", "equities"] },
  { re: /risk|hedge|drawdown|downside|protect/, tags: ["risk", "protection"] },
  { re: /diversif|concentrat|allocation/, tags: ["diversification", "risk"] },
  { re: /\btax\b|after-tax|tax-effic/, tags: ["tax"] },
  { re: /retire|fire|financial independence|early retirement/, tags: ["retirement", "fire"] },
  { re: /behavior|psycholog|discipline|emotion|bias|conviction/, tags: ["psychology", "discipline"] },
  { re: /macro|economy|interest rate|inflation|fed\b/, tags: ["macro", "markets"] },
  { re: /screen|filter|scan/, tags: ["screening", "research"] },
  { re: /fundamental|earnings|balance sheet|moat|quality/, tags: ["research", "fundamentals"] },
];

function philosophyBoosts(philosophy: string): Record<string, number> {
  const b: Record<string, number> = {};
  const text = philosophy.toLowerCase();
  if (!text.trim()) return b;
  for (const { re, tags } of PHILOSOPHY_RULES) {
    if (re.test(text)) for (const t of tags) b[t] = (b[t] ?? 0) + 2;
  }
  return b;
}

/** True when the profile carries enough signal to personalize. */
export function hasPersonalization(p: UserProfile): boolean {
  return (
    p.philosophy.trim().length > 0 ||
    p.primaryObjective !== "target" ||
    p.riskTolerance !== "moderate" ||
    p.sophistication !== "intermediate" ||
    p.deEmphasize.length > 0
  );
}

/**
 * Returns the top `limit` most-relevant hrefs (from `availableHrefs`) for this
 * profile, highest score first. Items with non-positive score are excluded.
 */
export function tailoredHrefs(p: UserProfile, availableHrefs: string[], limit = 6): string[] {
  const weights: Record<string, number> = { ...profileBoosts(p) };
  const phil = philosophyBoosts(p.philosophy);
  for (const [t, w] of Object.entries(phil)) weights[t] = (weights[t] ?? 0) + w;

  const scored = availableHrefs
    .map((href) => {
      const tags = ITEM_TAGS[href] ?? [];
      const score = tags.reduce((s, t) => s + (weights[t] ?? 0), 0);
      return { href, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.href);
}
