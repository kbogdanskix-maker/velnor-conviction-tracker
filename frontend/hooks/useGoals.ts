"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types mirroring backend schemas ─────────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  cagr: number;
  target_date: string;
  currency: string;
  portfolio_id: string | null;
  linked_tickers: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalCreate {
  name: string;
  icon?: string;
  target_amount: number;
  current_amount?: number;
  monthly_contribution?: number;
  cagr?: number;
  target_date: string;
  currency?: string;
  portfolio_id?: string | null;
  linked_tickers?: string[] | null;
  notes?: string | null;
}

export interface GoalUpdate {
  name?: string;
  icon?: string;
  target_amount?: number;
  current_amount?: number;
  monthly_contribution?: number;
  cagr?: number;
  target_date?: string;
  currency?: string;
  portfolio_id?: string | null;
  linked_tickers?: string[] | null;
  notes?: string | null;
}

// ── Projection math ─────────────────────────────────────────────────────────

export interface ProjectionPoint {
  month: number;
  date: string; // YYYY-MM
  value: number;
  contributed: number;
}

/**
 * Compute monthly projection points using compound interest with contributions.
 * FV = current × (1+r)^n + contribution × [((1+r)^n - 1) / r]
 * where r = monthly rate, n = months elapsed.
 */
export function computeProjection(
  currentAmount: number,
  monthlyContribution: number,
  annualCagr: number,
  totalMonths: number,
): ProjectionPoint[] {
  const monthlyRate = Math.pow(1 + annualCagr / 100, 1 / 12) - 1;
  const points: ProjectionPoint[] = [];
  const now = new Date();

  for (let m = 0; m <= totalMonths; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    let value: number;
    const contributed = currentAmount + monthlyContribution * m;

    if (monthlyRate === 0) {
      value = contributed;
    } else {
      // FV of lump sum + FV of annuity
      value =
        currentAmount * Math.pow(1 + monthlyRate, m) +
        monthlyContribution * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate);
    }

    points.push({ month: m, date: dateStr, value, contributed });
  }

  return points;
}

/**
 * Calculate months between now and a target date.
 */
export function monthsUntil(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useGoals() {
  const { data, error, isLoading, mutate } = useSWR<Goal[]>(
    "/goals",
    api.get,
    { revalidateOnFocus: false },
  );

  return {
    goals: data ?? [],
    error,
    isLoading,
    mutate,
    isEmpty: !isLoading && (!data || data.length === 0),
  };
}
