"use client";

import { useMemo, useState, useCallback } from "react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary } from "@/hooks/useDividends";
import { useTaxSummary } from "@/hooks/useTax";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import type { CardContext, LearningCard } from "@/lib/learning-cards";
import { getTriggeredCards, LEARNING_CARDS } from "@/lib/learning-cards";

const DISMISS_KEY = "vela_dismissed_cards";

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(ids)));
}

/**
 * Evaluates the user's financial state against all learning card triggers.
 * Returns contextual cards sorted by priority.
 */
export function useLearningCards() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = !!summary?.holdings?.length;

  const { dividends } = useDividendSummary(hasHoldings ? portfolioId : null);
  const { tax } = useTaxSummary(hasHoldings ? portfolioId : null);
  const { summary: nwSummary } = useNetWorthSummary();
  const { summary: cfSummary } = useCashFlowSummary();
  const { goals } = useGoals();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const dismiss = useCallback((cardId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const resetDismissed = useCallback(() => {
    setDismissedIds(new Set());
    saveDismissedIds(new Set());
  }, []);

  // Build the context object
  const ctx = useMemo<CardContext | null>(() => {
    if (!summary) return null;

    const totalValue = summary.total_value || 1;
    const holdings = summary.holdings.map((h) => ({
      ticker: h.ticker,
      shares: h.quantity,
      avg_cost: h.avg_cost_basis,
      current_price: h.current_price ?? h.avg_cost_basis,
      market_value: h.market_value ?? h.total_cost,
      weight: (h.market_value ?? h.total_cost) / totalValue,
      gain_pct: (h.unrealized_pnl_pct ?? 0) / 100,
      loss_pct: (h.unrealized_pnl_pct ?? 0) / 100,
    }));

    return {
      holdings,
      portfolioValue: summary.total_value,
      dividends: dividends
        ? {
            total_annual_income: dividends.total_annual_income,
            portfolio_yield: dividends.portfolio_yield,
            holdings: dividends.holdings.map((h) => ({
              ticker: h.ticker,
              yield: h.dividend_yield ?? 0,
              payout_ratio: h.payout_ratio,
            })),
          }
        : undefined,
      tax: tax
        ? {
            short_term_gains: tax.total_short_term,
            long_term_gains: tax.total_long_term,
            harvestable_losses: tax.harvesting_opportunities.reduce(
              (sum, o) => sum + Math.abs(o.unrealized_loss),
              0,
            ),
            holdings: tax.holdings.map((h) => ({
              ticker: h.ticker,
              days_held: h.days_held ?? 0,
              is_long_term: h.is_long_term,
              days_until_long_term: h.days_until_long_term,
              unrealized_gain: h.unrealized_gain,
            })),
          }
        : undefined,
      netWorth: nwSummary
        ? {
            net_worth: nwSummary.net_worth,
            total_assets: nwSummary.total_assets,
            total_liabilities: nwSummary.total_liabilities,
          }
        : undefined,
      cashFlow:
        cfSummary && cfSummary.total_income > 0
          ? {
              savings_rate: cfSummary.savings_rate,
              total_income: cfSummary.total_income,
              savings: cfSummary.savings,
            }
          : undefined,
      goals: goals.map((g) => ({
        name: g.name,
        current_amount: g.current_amount,
        target_amount: g.target_amount,
        target_date: g.target_date,
      })),
    };
  }, [summary, dividends, tax, nwSummary, cfSummary, goals]);

  // Evaluate triggers
  const cards = useMemo<LearningCard[]>(() => {
    if (!ctx) return [];
    return getTriggeredCards(ctx, dismissedIds);
  }, [ctx, dismissedIds]);

  // All cards (for /learn page, ignore triggers)
  const allCards = LEARNING_CARDS;

  return {
    /** Contextual cards triggered by current state, sorted by priority */
    cards,
    /** All defined cards (for browse page) */
    allCards,
    /** Dismiss a card by id */
    dismiss,
    /** Reset all dismissed cards */
    resetDismissed,
    /** Number dismissed */
    dismissedCount: dismissedIds.size,
    /** Whether we have enough data to show cards */
    ready: !!ctx,
  };
}
