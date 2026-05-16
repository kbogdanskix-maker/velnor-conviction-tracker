"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export type JournalAction = "buy" | "sell" | "hold" | "trim" | "add" | "watch";
export type JournalOutcome = "win" | "loss" | "breakeven" | "pending";

export interface JournalEntry {
  id: string;
  ticker: string;
  action: JournalAction;
  conviction: number;
  rationale: string;
  price_at_decision: number | null;
  target_price: number | null;
  stop_loss: number | null;
  time_horizon: string | null;
  tags: string | null;
  outcome: JournalOutcome | null;
  outcome_notes: string | null;
  price_at_review: number | null;
  reviewed_at: string | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreate {
  ticker: string;
  action: JournalAction;
  conviction: number;
  rationale: string;
  price_at_decision?: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  time_horizon?: string | null;
  tags?: string | null;
  decided_at?: string;
}

export interface JournalEntryUpdate {
  ticker?: string;
  action?: JournalAction;
  conviction?: number;
  rationale?: string;
  price_at_decision?: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  time_horizon?: string | null;
  tags?: string | null;
  outcome?: JournalOutcome;
  outcome_notes?: string | null;
  price_at_review?: number | null;
  reviewed_at?: string;
}

export interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  pending: number;
  win_rate: number | null;
  avg_conviction: number;
  win_avg_conviction: number | null;
  loss_avg_conviction: number | null;
  action_counts: Record<string, number>;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useJournal() {
  const { data, error, isLoading, mutate } = useSWR<JournalEntry[]>(
    "/journal",
    api.get,
    { revalidateOnFocus: false },
  );

  return {
    entries: data ?? [],
    error,
    isLoading,
    mutate,
    isEmpty: !isLoading && (!data || data.length === 0),
  };
}

export function useJournalStats() {
  const { data, error, isLoading } = useSWR<JournalStats>(
    "/journal/stats",
    api.get,
    { revalidateOnFocus: false },
  );

  return { stats: data ?? null, error, isLoading };
}
