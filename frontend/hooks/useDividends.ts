"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface DividendHolding {
  ticker: string;
  quantity: number;
  current_price: number;
  market_value: number;
  dividend_rate: number | null;
  dividend_yield: number | null;
  annual_income: number;
  ex_dividend_date: string | null;
  payout_ratio: number | null;
  five_year_avg_yield: number | null;
  last_dividend_value: number | null;
}

export interface DividendSummary {
  holdings: DividendHolding[];
  total_annual_income: number;
  portfolio_yield: number;
  total_portfolio_value: number;
  next_ex_dates: { ticker: string; date: string }[];
}

export function useDividendSummary(portfolioId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DividendSummary>(
    portfolioId ? `/portfolios/${portfolioId}/dividends` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    dividends: data ?? null,
    error,
    isLoading,
    mutate,
  };
}
