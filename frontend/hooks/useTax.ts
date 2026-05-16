"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface TaxHolding {
  ticker: string;
  quantity: number;
  cost_basis: number;
  total_cost: number;
  current_price: number;
  market_value: number;
  unrealized_gain: number;
  unrealized_gain_pct: number;
  first_buy_date: string | null;
  days_held: number | null;
  is_long_term: boolean;
  days_until_long_term: number | null;
  tax_status: "long-term" | "short-term";
}

export interface HarvestingOpportunity {
  ticker: string;
  unrealized_loss: number;
  loss_pct: number;
  is_long_term: boolean;
  potential_offset: number;
}

export interface TaxSummary {
  holdings: TaxHolding[];
  total_unrealized_gain: number;
  total_short_term: number;
  total_long_term: number;
  harvesting_opportunities: HarvestingOpportunity[];
}

export function useTaxSummary(portfolioId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TaxSummary>(
    portfolioId ? `/portfolios/${portfolioId}/tax` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    tax: data ?? null,
    error,
    isLoading,
    mutate,
  };
}
