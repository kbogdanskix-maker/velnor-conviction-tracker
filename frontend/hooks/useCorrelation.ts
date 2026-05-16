"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface CorrelationData {
  tickers: string[];
  matrix: number[][];
  period: string;
}

export function useCorrelation(portfolioId: string | null, period = "1y") {
  const { data, error, isLoading } = useSWR<CorrelationData>(
    portfolioId ? `/portfolios/${portfolioId}/correlation?period=${period}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  return {
    correlation: data ?? null,
    error,
    loading: isLoading,
  };
}
