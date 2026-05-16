"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

interface UserProfile {
  tier: string;
  tier_expires_at?: string | null;
}

const TIER_RANK: Record<string, number> = { horizon: 0, voyager: 1, navigator: 2 };

export function useTier() {
  const { data, error, isLoading } = useSWR<UserProfile>("/auth/me", api.get, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // re-check at most every minute
  });

  return {
    tier: data?.tier ?? "horizon",
    loading: isLoading,
    error,
    isVoyager: TIER_RANK[data?.tier ?? "horizon"] >= 1,
    isNavigator: TIER_RANK[data?.tier ?? "horizon"] >= 2,
  };
}
