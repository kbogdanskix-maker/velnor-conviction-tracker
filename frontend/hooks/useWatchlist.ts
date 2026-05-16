"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types mirroring backend WatchlistItemOut ────────────────────────────────

export interface WatchlistItem {
  id: string;
  ticker: string;
  asset_type: string;
  notes: string | null;
  added_at: string;
  current_price: number | null;
  day_change_pct: number | null;
}

export interface WatchlistItemCreate {
  ticker: string;
  asset_type?: string;
  notes?: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useWatchlist() {
  const { data, error, isLoading, mutate } = useSWR<WatchlistItem[]>(
    "/watchlist",
    api.get,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  return {
    items: data ?? [],
    error,
    isLoading,
    mutate,
    isEmpty: !isLoading && (!data || data.length === 0),
  };
}
