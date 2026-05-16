"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface RiskMetrics {
  sharpe_ratio: number | null;
  annualized_volatility: number | null;
  max_drawdown: number | null;
  beta: number | null;
  annualized_return: number | null;
  data_points: number;
}

export function useRiskMetrics(portfolioId: string | undefined) {
  return useSWR<RiskMetrics>(
    portfolioId ? `/portfolios/${portfolioId}/risk` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
}
