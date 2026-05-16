"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types mirroring backend schemas ─────────────────────────────────────────

export interface Portfolio {
  id: string;
  name: string;
  currency: string;
  is_default: boolean;
  account_type: string;
  created_at: string;
}

export interface Holding {
  ticker: string;
  asset_type: string;
  quantity: number;
  avg_cost_basis: number;
  total_cost: number;
  currency: string;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  day_change: number | null;
  day_change_pct: number | null;
}

export interface PortfolioSummary {
  total_value: number;
  total_cost: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  realized_pnl: number;
  day_change: number;
  day_change_pct: number;
  holdings: Holding[];
}

export interface Transaction {
  id: string;
  ticker: string;
  asset_type: string;
  transaction_type: string;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  fx_rate: number;
  executed_at: string;
  notes: string | null;
  source: string;
  broker: string | null;
  created_at: string;
}

export interface TransactionCreate {
  ticker: string;
  asset_type?: string;
  transaction_type: string;
  quantity: number;
  price: number;
  fees?: number;
  currency?: string;
  fx_rate?: number;
  executed_at: string;
  notes?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a default portfolio if none exist. Returns the portfolio. */
export async function ensurePortfolio(): Promise<Portfolio> {
  const portfolios = await api.get<Portfolio[]>("/portfolios");
  if (portfolios.length > 0) {
    return portfolios.find((p) => p.is_default) ?? portfolios[0];
  }
  return api.post<Portfolio>("/portfolios", { name: "My Portfolio", currency: "USD" });
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function usePortfolios() {
  return useSWR<Portfolio[]>("/portfolios", api.get, {
    revalidateOnFocus: false,
  });
}

/** Parse Decimal strings from the API into real numbers */
function parseSummary(raw: PortfolioSummary): PortfolioSummary {
  const n = (v: unknown) => (v != null ? Number(v) : 0);
  return {
    ...raw,
    total_value: n(raw.total_value),
    total_cost: n(raw.total_cost),
    unrealized_pnl: n(raw.unrealized_pnl),
    unrealized_pnl_pct: n(raw.unrealized_pnl_pct),
    realized_pnl: n(raw.realized_pnl),
    day_change: n(raw.day_change),
    day_change_pct: n(raw.day_change_pct),
    holdings: (raw.holdings ?? []).map((h) => ({
      ...h,
      quantity: n(h.quantity),
      avg_cost_basis: n(h.avg_cost_basis),
      total_cost: n(h.total_cost),
      current_price: h.current_price != null ? n(h.current_price) : null,
      market_value: h.market_value != null ? n(h.market_value) : null,
      unrealized_pnl: h.unrealized_pnl != null ? n(h.unrealized_pnl) : null,
      unrealized_pnl_pct: h.unrealized_pnl_pct != null ? n(h.unrealized_pnl_pct) : null,
      day_change: h.day_change != null ? n(h.day_change) : null,
      day_change_pct: h.day_change_pct != null ? n(h.day_change_pct) : null,
    })),
  };
}

export function usePortfolioSummary(portfolioId: string | undefined) {
  return useSWR<PortfolioSummary>(
    portfolioId ? `/portfolios/${portfolioId}/summary` : null,
    async (url: string) => parseSummary(await api.get(url)),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
}

export function useTransactions(portfolioId: string | undefined, page = 1) {
  return useSWR<Transaction[]>(
    portfolioId
      ? `/portfolios/${portfolioId}/transactions?page=${page}&page_size=50`
      : null,
    api.get,
  );
}

// ── Portfolio History (Performance Chart) ───────────────────────────────────

export interface PortfolioSnapshotPoint {
  date: string;
  total_value: number;
  total_cost: number;
  pnl: number;
}

export interface PortfolioHistory {
  portfolio_id: string;
  snapshots: PortfolioSnapshotPoint[];
}

export function usePortfolioHistory(portfolioId: string | undefined, days = 365) {
  return useSWR<PortfolioHistory>(
    portfolioId ? `/portfolios/${portfolioId}/history?days=${days}` : null,
    api.get,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
}

/** Take a snapshot of current portfolio value (upserts for today). */
export async function takePortfolioSnapshot(portfolioId: string) {
  return api.post<{ status: string; date: string; total_value: number }>(
    `/portfolios/${portfolioId}/snapshot`,
    {},
  );
}

/**
 * Convenience wrapper — fetches portfolio list, picks the default,
 * and returns the summary for it.
 */
export function useDefaultPortfolio() {
  const { data: portfolios, error: listError, isLoading: listLoading } = usePortfolios();

  const defaultPortfolio = portfolios?.find((p) => p.is_default) ?? portfolios?.[0];

  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = usePortfolioSummary(defaultPortfolio?.id);

  return {
    portfolios: portfolios ?? [],
    portfolio: defaultPortfolio ?? null,
    summary: summary ?? null,
    loading: listLoading || summaryLoading,
    error: listError || summaryError,
    mutateSummary,
    isEmpty: !listLoading && (!portfolios || portfolios.length === 0),
    hasHoldings: (summary?.holdings?.length ?? 0) > 0,
  };
}
