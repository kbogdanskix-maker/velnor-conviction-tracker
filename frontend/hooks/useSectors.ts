"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SectorHolding {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  market_value: number;
  weight: number;
}

export interface SectorEntry {
  name: string;
  value: number;
  weight: number;
}

export interface IndustryEntry {
  name: string;
  sector: string;
  value: number;
  weight: number;
}

export interface SectorBreakdown {
  holdings: SectorHolding[];
  sectors: SectorEntry[];
  industries: IndustryEntry[];
  total_value: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSectorBreakdown(portfolioId: string | null) {
  const { data, error, isLoading } = useSWR<SectorBreakdown>(
    portfolioId ? `/portfolios/${portfolioId}/sectors` : null,
    api.get,
    { revalidateOnFocus: false },
  );

  return {
    breakdown: data ?? null,
    error,
    loading: isLoading,
  };
}
