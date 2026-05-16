import useSWR from "swr";
import { api } from "@/lib/api";

export interface ScreenerStock {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  trailing_pe: number | null;
  forward_pe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margins: number | null;
  gross_margins: number | null;
  operating_margins: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  price: number | null;
  change_pct: number | null;
}

export function useScreener() {
  const { data, error, isLoading } = useSWR<ScreenerStock[]>(
    "/screener",
    api.get,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5 min dedup
    },
  );

  return {
    stocks: data ?? [],
    isLoading,
    error,
  };
}
