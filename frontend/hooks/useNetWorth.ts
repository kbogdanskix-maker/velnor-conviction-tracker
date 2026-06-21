"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface NetWorthAsset {
  id: string;
  name: string;
  category: string;
  value: number;
  currency: string;
  is_liability: boolean;
  institution: string | null;
  interest_rate: number | null;
  minimum_payment: number | null;
  notes: string | null;
  as_of_date: string;
  created_at: string;
  updated_at: string;
}

export interface NetWorthAssetCreate {
  name: string;
  category: string;
  value: number;
  currency?: string;
  is_liability?: boolean;
  institution?: string | null;
  interest_rate?: number | null;
  minimum_payment?: number | null;
  notes?: string | null;
  as_of_date: string;
}

export interface NetWorthAssetUpdate {
  name?: string;
  category?: string;
  value?: number;
  currency?: string;
  is_liability?: boolean;
  institution?: string | null;
  interest_rate?: number | null;
  minimum_payment?: number | null;
  notes?: string | null;
  as_of_date?: string;
}

export interface NetWorthSummary {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  portfolio_value: number;
  assets: NetWorthAsset[];
}

// ── Category helpers ────────────────────────────────────────────────────────

export const ASSET_CATEGORIES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "hysa", label: "High-Yield Savings" },
  { value: "money_market", label: "Money Market" },
  { value: "cd", label: "CD" },
  { value: "real_estate", label: "Real Estate" },
  { value: "vehicle", label: "Vehicle" },
  { value: "business", label: "Business" },
  { value: "retirement_401k", label: "401(k)" },
  { value: "ira", label: "IRA" },
  { value: "hsa", label: "HSA" },
  { value: "crypto", label: "Crypto" },
  { value: "other_asset", label: "Other Asset" },
] as const;

export const LIABILITY_CATEGORIES = [
  { value: "credit_card", label: "Credit Card" },
  { value: "student_loan", label: "Student Loan" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "medical_debt", label: "Medical Debt" },
  { value: "other_debt", label: "Other Debt" },
] as const;

export function categoryLabel(category: string): string {
  const all = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];
  return all.find((c) => c.value === category)?.label ?? category;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useNetWorthAssets() {
  const { data, error, isLoading, mutate } = useSWR<NetWorthAsset[]>(
    "/net-worth/assets",
    api.get,
    { revalidateOnFocus: false },
  );

  return {
    assets: data ?? [],
    error,
    isLoading,
    mutate,
    isEmpty: !isLoading && (!data || data.length === 0),
  };
}

export function useNetWorthSummary() {
  const { data, error, isLoading, mutate } = useSWR<NetWorthSummary>(
    "/net-worth/summary",
    api.get,
    // Fetches live quotes server-side for portfolio value; dedupe so multiple
    // consumers / focus revalidations share one request (see usePortfolioSummary).
    { revalidateOnFocus: true, refreshInterval: 5 * 60 * 1000, dedupingInterval: 30_000 },
  );

  return {
    summary: data ?? null,
    error,
    isLoading,
    mutate,
  };
}
