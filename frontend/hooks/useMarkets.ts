"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface MarketIndex {
  ticker: string;
  name: string;
  price?: number;
  prev_close?: number;
  change?: number;
  change_pct?: number;
  volume?: number;
  market_cap?: number;
  currency?: string;
}

export interface Mover {
  ticker: string;
  price?: number;
  prev_close?: number;
  change?: number;
  change_pct?: number;
  volume?: number;
  market_cap?: number;
  currency?: string;
}

interface MarketOverview {
  us_indices: MarketIndex[];
  international_indices: MarketIndex[];
}

interface TopMovers {
  gainers: Mover[];
  losers: Mover[];
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useMarketOverview() {
  const { data, error, isLoading } = useSWR<MarketOverview>(
    "/markets/overview",
    api.get,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  return {
    usIndices: data?.us_indices ?? [],
    intlIndices: data?.international_indices ?? [],
    error,
    isLoading,
  };
}

export function useTopMovers() {
  const { data, error, isLoading } = useSWR<TopMovers>(
    "/markets/movers",
    api.get,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );

  return {
    gainers: data?.gainers ?? [],
    losers: data?.losers ?? [],
    error,
    isLoading,
  };
}
