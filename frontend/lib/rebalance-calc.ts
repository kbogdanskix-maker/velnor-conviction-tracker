/**
 * Portfolio Rebalancing Calculator
 *
 * Given current holdings and target allocation, computes the trades
 * needed to rebalance. Supports equal-weight, custom-weight, and
 * market-cap-proxy strategies.
 */

export interface HoldingAllocation {
  ticker: string;
  currentValue: number;
  currentWeight: number; // 0-1
  targetWeight: number; // 0-1
  drift: number; // target - current (percentage points)
  tradeAmount: number; // positive = buy, negative = sell
  tradeShares: number;
  currentPrice: number;
}

export interface RebalanceResult {
  holdings: HoldingAllocation[];
  totalValue: number;
  maxDrift: number; // largest absolute drift
  totalBuys: number;
  totalSells: number;
  numTrades: number;
  isBalanced: boolean; // all within threshold
}

export type Strategy = "equal" | "custom";

export interface RebalanceInput {
  holdings: {
    ticker: string;
    marketValue: number;
    currentPrice: number;
    quantity: number;
  }[];
  strategy: Strategy;
  customTargets?: Record<string, number>; // ticker -> target weight (0-1)
  driftThreshold: number; // e.g. 0.05 = 5% drift allowed
  cashToInvest?: number; // additional cash to deploy
}

export function calculateRebalance(input: RebalanceInput): RebalanceResult {
  const { holdings, strategy, customTargets, driftThreshold, cashToInvest = 0 } = input;

  const currentTotal = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalValue = currentTotal + cashToInvest;

  if (totalValue <= 0 || holdings.length === 0) {
    return {
      holdings: [],
      totalValue: 0,
      maxDrift: 0,
      totalBuys: 0,
      totalSells: 0,
      numTrades: 0,
      isBalanced: true,
    };
  }

  // Compute target weights
  const targetWeights: Record<string, number> = {};

  if (strategy === "equal") {
    const equalWeight = 1 / holdings.length;
    for (const h of holdings) {
      targetWeights[h.ticker] = equalWeight;
    }
  } else if (strategy === "custom" && customTargets) {
    // Use custom targets, normalize to sum to 1
    const total = Object.values(customTargets).reduce((s, v) => s + v, 0);
    for (const h of holdings) {
      targetWeights[h.ticker] = (customTargets[h.ticker] ?? 0) / (total || 1);
    }
  }

  // Calculate allocations
  const result: HoldingAllocation[] = holdings.map((h) => {
    const currentWeight = h.marketValue / totalValue;
    const targetWeight = targetWeights[h.ticker] ?? currentWeight;
    const drift = (targetWeight - currentWeight) * 100; // percentage points
    const targetValue = targetWeight * totalValue;
    const tradeAmount = targetValue - h.marketValue;
    const tradeShares = h.currentPrice > 0
      ? Math.round((tradeAmount / h.currentPrice) * 100) / 100
      : 0;

    return {
      ticker: h.ticker,
      currentValue: h.marketValue,
      currentWeight,
      targetWeight,
      drift,
      tradeAmount,
      tradeShares,
      currentPrice: h.currentPrice,
    };
  });

  // Sort by drift magnitude (biggest first)
  result.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  const drifts = result.map((h) => Math.abs(h.drift));
  const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;
  const totalBuys = result
    .filter((h) => h.tradeAmount > 0)
    .reduce((s, h) => s + h.tradeAmount, 0);
  const totalSells = result
    .filter((h) => h.tradeAmount < 0)
    .reduce((s, h) => s + Math.abs(h.tradeAmount), 0);
  const numTrades = result.filter((h) => Math.abs(h.drift) > driftThreshold * 100).length;
  const isBalanced = maxDrift <= driftThreshold * 100;

  return {
    holdings: result,
    totalValue,
    maxDrift,
    totalBuys,
    totalSells,
    numTrades,
    isBalanced,
  };
}
