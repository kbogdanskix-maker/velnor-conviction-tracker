"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types mirroring backend response ────────────────────────────────────────

export interface TickerInfo {
  ticker: string;
  // Identity
  name: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  quote_type: string | null;
  // Valuation
  market_cap: number | null;
  trailing_pe: number | null;
  forward_pe: number | null;
  beta: number | null;
  // Dividends
  dividend_yield: number | null;
  dividend_rate: number | null;
  payout_ratio: number | null;
  ex_dividend_date: string | null;
  last_dividend_value: number | null;
  last_dividend_date: string | null;
  five_year_avg_yield: number | null;
  // Range & Volume
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  average_volume: number | null;
  // Margins
  gross_margins: number | null;
  operating_margins: number | null;
  profit_margins: number | null;
  // Error case
  error?: string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTickerInfo(ticker: string | null) {
  const { data, error, isLoading } = useSWR<TickerInfo>(
    ticker ? `/markets/info/${ticker}` : null,
    api.get,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // don't refetch within 1 min
    },
  );

  return {
    info: data ?? null,
    error,
    isLoading,
    hasError: !!data?.error,
  };
}
