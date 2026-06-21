"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface SentimentHeadline {
  title: string;
  compound: number;
  label: "bullish" | "bearish" | "neutral";
  published_at: string | null;
  source: string;
  url: string;
}

export interface TickerSentiment {
  ticker: string;
  overall_score: number; // -100..100
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  article_count: number;
  headlines: SentimentHeadline[];
}

/** Portfolio-wide sentiment (all holdings + watchlist). Refreshes every 15 min. */
export function usePortfolioSentiment() {
  const { data, error, isLoading, mutate } = useSWR<TickerSentiment[]>(
    "/sentiment",
    api.get,
    { refreshInterval: 15 * 60_000, revalidateOnFocus: false },
  );

  return {
    tickers: data ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}

/** Sentiment for a single ticker on demand. */
export function useTickerSentiment(ticker: string | null) {
  const { data, error, isLoading } = useSWR<TickerSentiment>(
    ticker ? `/sentiment/${ticker}` : null,
    api.get,
  );

  return { sentiment: data ?? null, error, isLoading };
}
