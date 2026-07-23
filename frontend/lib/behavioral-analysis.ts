/**
 * Behavioral Finance Analysis
 *
 * Detects common cognitive biases from portfolio and journal data.
 * All analysis is client-side, educational only.
 */
import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Gauge,
  History,
  PieChart,
  Scissors,
  TrendingDown,
  Users,
} from "lucide-react";


export interface BehaviorInput {
  holdings: {
    ticker: string;
    weight: number;
    unrealizedPnlPct: number;
    dayChangePct: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
  }[];
  journalEntries: {
    action: string;
    conviction: number;
    outcome: string | null;
    priceAtDecision: number | null;
    priceAtReview: number | null;
    decidedAt: string;
    ticker: string;
    timeHorizon: string | null;
  }[];
  portfolioValue: number;
  dayChangePct: number;
}

export interface BiasDetection {
  id: string;
  name: string;
  description: string;
  severity: "low" | "moderate" | "high";
  detected: boolean;
  evidence: string;
  tip: string;
  icon: LucideIcon;
}

export interface BehaviorResult {
  biases: BiasDetection[];
  biasScore: number; // 0-100, lower = more biases detected
  detectedCount: number;
  totalChecked: number;
  topBias: BiasDetection | null;
}

export function analyzeBehavior(input: BehaviorInput): BehaviorResult {
  const biases: BiasDetection[] = [];

  // 1. Loss Aversion  - holding losers too long
  const losers = input.holdings.filter((h) => h.unrealizedPnlPct < -15);
  const bigLosers = losers.filter((h) => h.unrealizedPnlPct < -30);
  biases.push({
    id: "loss-aversion",
    name: "Loss Aversion",
    description: "Tendency to hold losing positions hoping they recover, rather than cutting losses.",
    severity: bigLosers.length >= 2 ? "high" : losers.length >= 2 ? "moderate" : "low",
    detected: losers.length >= 2,
    evidence: losers.length >= 2
      ? `${losers.length} positions are down 15%+ from cost. ${bigLosers.length > 0 ? `${bigLosers.length} are down over 30%.` : ""}`
      : "No significant losing positions detected.",
    tip: "Set stop-loss levels before entering a trade. Ask yourself: would you buy this stock today at the current price?",
    icon: TrendingDown,
  });

  // 2. Disposition Effect  - selling winners too early
  const sellEntries = input.journalEntries.filter((e) => e.action === "sell" || e.action === "trim");
  const winSells = sellEntries.filter(
    (e) => e.priceAtDecision && e.priceAtReview && e.priceAtReview > e.priceAtDecision
  );
  const earlyWinSells = sellEntries.filter((e) => {
    if (!e.priceAtDecision || !e.priceAtReview) return false;
    const gain = ((e.priceAtReview - e.priceAtDecision) / e.priceAtDecision) * 100;
    return gain > 0 && gain < 15;
  });
  biases.push({
    id: "disposition-effect",
    name: "Disposition Effect",
    description: "Selling winners too quickly for small gains while holding onto losers.",
    severity: earlyWinSells.length >= 3 ? "high" : earlyWinSells.length >= 1 ? "moderate" : "low",
    detected: earlyWinSells.length >= 1 && losers.length >= 1,
    evidence: earlyWinSells.length >= 1 && losers.length >= 1
      ? `You've locked in small gains on ${earlyWinSells.length} trade(s) while holding ${losers.length} losing position(s).`
      : "No clear disposition effect pattern found.",
    tip: "Let your winners run. Consider trailing stop-losses instead of fixed profit targets.",
    icon: Scissors,
  });

  // 3. Overconcentration Bias
  const topWeight = Math.max(...input.holdings.map((h) => h.weight), 0);
  const top3Weight = [...input.holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .reduce((s, h) => s + h.weight, 0);
  biases.push({
    id: "concentration-bias",
    name: "Concentration Bias",
    description: "Over-investing in a few names due to familiarity or overconfidence.",
    severity: topWeight > 0.5 ? "high" : topWeight > 0.3 ? "moderate" : "low",
    detected: topWeight > 0.3 || top3Weight > 0.8,
    evidence: topWeight > 0.3
      ? `Your largest position is ${(topWeight * 100).toFixed(0)}% of the portfolio. Top 3 holdings make up ${(top3Weight * 100).toFixed(0)}%.`
      : "Portfolio concentration is within normal range.",
    tip: "Consider if your conviction justifies the position size. Most advisors suggest no single stock above 10-15%.",
    icon: PieChart,
  });

  // 4. Recency Bias  - overreacting to recent moves
  const recentBuys = input.journalEntries.filter((e) => {
    const daysAgo = (Date.now() - new Date(e.decidedAt).getTime()) / (1000 * 60 * 60 * 24);
    return e.action === "buy" && daysAgo < 7;
  });
  const bigMovers = input.holdings.filter((h) => Math.abs(h.dayChangePct) > 3);
  biases.push({
    id: "recency-bias",
    name: "Recency Bias",
    description: "Making decisions based on recent price moves rather than long-term fundamentals.",
    severity: recentBuys.length >= 3 ? "high" : recentBuys.length >= 2 ? "moderate" : "low",
    detected: recentBuys.length >= 2,
    evidence: recentBuys.length >= 2
      ? `You've made ${recentBuys.length} buy decisions in the last 7 days, a faster pace than a typical week.`
      : "No pattern of reactionary trading detected.",
    tip: "A cooling-off period between a price move and a decision is one way traders separate a reaction from a plan.",
    icon: History,
  });

  // 5. Overconfidence  - high conviction on losing trades
  const highConvLosses = input.journalEntries.filter(
    (e) => e.conviction >= 4 && e.outcome === "loss"
  );
  const totalReviewed = input.journalEntries.filter(
    (e) => e.outcome && e.outcome !== "pending"
  );
  biases.push({
    id: "overconfidence",
    name: "Overconfidence",
    description: "Being too sure about predictions, leading to oversized bets that fail.",
    severity: highConvLosses.length >= 3 ? "high" : highConvLosses.length >= 1 ? "moderate" : "low",
    detected: highConvLosses.length >= 1,
    evidence: highConvLosses.length >= 1
      ? `${highConvLosses.length} of your high-conviction (4-5) trades ended as losses out of ${totalReviewed.length} reviewed.`
      : "Not enough journal data to assess overconfidence.",
    tip: "Track your conviction levels against outcomes. If high-conviction trades lose often, recalibrate your confidence.",
    icon: Gauge,
  });

  // 6. Anchoring  - holding because of cost basis
  const anchoredPositions = input.holdings.filter((h) => {
    const pnl = h.unrealizedPnlPct;
    return pnl < -20 && h.weight > 0.05;
  });
  biases.push({
    id: "anchoring",
    name: "Anchoring Bias",
    description: "Fixating on your buy price rather than the stock's current outlook.",
    severity: anchoredPositions.length >= 3 ? "high" : anchoredPositions.length >= 1 ? "moderate" : "low",
    detected: anchoredPositions.length >= 1,
    evidence: anchoredPositions.length >= 1
      ? `${anchoredPositions.length} position(s) are significantly below cost basis and still held at meaningful size.`
      : "No clear anchoring pattern detected.",
    tip: "Ask: if you had cash instead of this position, would you buy it at today's price?",
    icon: Anchor,
  });

  // 7. FOMO / Herd Behavior
  const watchToAddActions = input.journalEntries.filter(
    (e) => (e.action === "buy" || e.action === "add") && e.conviction <= 2
  );
  biases.push({
    id: "fomo",
    name: "FOMO / Herd Behavior",
    description: "Buying because everyone else is, not because of a well-reasoned thesis.",
    severity: watchToAddActions.length >= 3 ? "high" : watchToAddActions.length >= 1 ? "moderate" : "low",
    detected: watchToAddActions.length >= 1,
    evidence: watchToAddActions.length >= 1
      ? `${watchToAddActions.length} buy decision(s) were made with low conviction (1-2). This may indicate impulse buying.`
      : "No low-conviction buy patterns detected.",
    tip: "Only buy when you can clearly articulate your thesis. If you can't explain it in a sentence, wait.",
    icon: Users,
  });

  const detectedCount = biases.filter((b) => b.detected).length;
  const totalChecked = biases.length;
  const biasScore = Math.max(0, Math.round(100 - (detectedCount / totalChecked) * 100));

  const sortedDetected = biases
    .filter((b) => b.detected)
    .sort((a, b) => {
      const sev = { high: 3, moderate: 2, low: 1 };
      return sev[b.severity] - sev[a.severity];
    });

  return {
    biases,
    biasScore,
    detectedCount,
    totalChecked,
    topBias: sortedDetected[0] || null,
  };
}
