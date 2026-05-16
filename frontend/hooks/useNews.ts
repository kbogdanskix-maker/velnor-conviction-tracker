"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface NewsArticle {
  title: string;
  summary: string;
  published_at: string;
  source: string;
  url: string;
  thumbnail: string | null;
  tickers: string[];
}

/** Combined news feed for user's holdings + watchlist. */
export function useNewsFeed() {
  const { data, error, isLoading } = useSWR<NewsArticle[]>(
    "/news",
    api.get,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );

  return {
    articles: data ?? [],
    error,
    isLoading,
    isEmpty: !isLoading && (!data || data.length === 0),
  };
}

/** News for a single ticker. */
export function useTickerNews(ticker: string | null) {
  const { data, error, isLoading } = useSWR<NewsArticle[]>(
    ticker ? `/news/${ticker}` : null,
    api.get,
  );

  return {
    articles: data ?? [],
    error,
    isLoading,
  };
}
