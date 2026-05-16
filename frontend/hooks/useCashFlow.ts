"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CashFlowEntry {
  id: string;
  name: string;
  entry_type: "income" | "fixed_expense" | "variable_expense";
  category: string;
  amount: number;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashFlowEntryCreate {
  name: string;
  entry_type: "income" | "fixed_expense" | "variable_expense";
  category: string;
  amount: number;
  currency?: string;
  notes?: string | null;
}

export interface CashFlowEntryUpdate {
  name?: string;
  entry_type?: "income" | "fixed_expense" | "variable_expense";
  category?: string;
  amount?: number;
  currency?: string;
  notes?: string | null;
  is_active?: boolean;
}

export interface CashFlowSummary {
  total_income: number;
  total_fixed: number;
  total_variable: number;
  total_expenses: number;
  savings: number;
  savings_rate: number;
  entries: CashFlowEntry[];
}

// ── Category helpers ────────────────────────────────────────────────────────

export const INCOME_CATEGORIES = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "rental", label: "Rental Income" },
  { value: "dividends", label: "Dividends" },
  { value: "side_hustle", label: "Side Hustle" },
  { value: "other_income", label: "Other Income" },
] as const;

export const FIXED_EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent / Mortgage" },
  { value: "insurance", label: "Insurance" },
  { value: "utilities", label: "Utilities" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "loan_payment", label: "Loan Payment" },
  { value: "phone", label: "Phone" },
  { value: "other_fixed", label: "Other Fixed" },
] as const;

export const VARIABLE_EXPENSE_CATEGORIES = [
  { value: "groceries", label: "Groceries" },
  { value: "dining", label: "Dining Out" },
  { value: "transport", label: "Transport" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "travel", label: "Travel" },
  { value: "other_variable", label: "Other Variable" },
] as const;

export function cfCategoryLabel(category: string): string {
  const all = [...INCOME_CATEGORIES, ...FIXED_EXPENSE_CATEGORIES, ...VARIABLE_EXPENSE_CATEGORIES];
  return all.find((c) => c.value === category)?.label ?? category;
}

export function categoriesForType(type: "income" | "fixed_expense" | "variable_expense") {
  switch (type) {
    case "income": return INCOME_CATEGORIES;
    case "fixed_expense": return FIXED_EXPENSE_CATEGORIES;
    case "variable_expense": return VARIABLE_EXPENSE_CATEGORIES;
  }
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useCashFlowSummary() {
  const { data, error, isLoading, mutate } = useSWR<CashFlowSummary>(
    "/cash-flow/summary",
    api.get,
    { revalidateOnFocus: false },
  );

  return {
    summary: data ?? null,
    entries: data?.entries ?? [],
    error,
    isLoading,
    mutate,
  };
}
