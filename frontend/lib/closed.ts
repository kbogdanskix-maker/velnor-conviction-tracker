/**
 * Closed positions data layer.
 * Consumes GET /api/v1/closed — returns fully-closed and trimmed positions
 * with realized P&L and post-exit price movement.
 */
import useSWR from "swr";
import { api } from "@/lib/api";

export interface ClosedPosition {
  ticker: string;
  name: string;
  current_price: number | null;
  /** Positive = stock ran UP after you sold (you left gains on the table). */
  since_sold_pct: number | null;
  realized_pnl: number;
  realized_pnl_pct: number | null;
  total_proceeds: number;
  shares_remaining: number;
  fully_closed: boolean;
  /** true = you trimmed but still hold some shares */
  still_held: boolean;
  last_sell_date: string | null;
  last_sell_price: number | null;
  first_buy_date: string | null;
}

const fetcher = <T>(path: string) => api.get<T>(path);

/** All closed (or trimmed) positions, most-recent-exit first. */
export function useClosed() {
  const { data, error, isLoading, mutate } = useSWR<ClosedPosition[]>(
    "/closed",
    fetcher,
  );
  return {
    positions: data ?? [],
    error,
    isLoading,
    mutate,
  };
}
