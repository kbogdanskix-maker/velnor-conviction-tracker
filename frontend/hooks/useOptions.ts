"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface OptionContract {
  strike: number;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  impliedVolatility: number | null;
  openInterest: number | null;
  volume: number | null;
}

export interface OptionsChain {
  ticker: string;
  expiries: string[];
  chains: Record<string, { calls: OptionContract[]; puts: OptionContract[] }>;
  currentPrice: number;
}

export function useOptionsChain(ticker: string | null) {
  return useSWR<OptionsChain>(
    ticker ? `/quotes/options/${ticker}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
}
