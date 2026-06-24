"use client";

import Link from "next/link";
import { Route } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Portfolio, PortfolioSummary } from "@/hooks/usePortfolio";
import type { ThesisThreadSummary } from "@/lib/thesis";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Ticker collection ─────────────────────────────────────────────────────────

function useJourneyTickers(): { tickers: string[]; loading: boolean } {
  const { data: portfolios, isLoading: portfoliosLoading } =
    useSWR<Portfolio[]>("/portfolios", api.get, { revalidateOnFocus: false });

  // Grab the first portfolio's summary to get holdings
  const defaultPortfolio =
    portfolios?.find((p) => p.is_default) ?? portfolios?.[0] ?? null;

  const { data: summary, isLoading: summaryLoading } =
    useSWR<PortfolioSummary>(
      defaultPortfolio ? `/portfolios/${defaultPortfolio.id}/summary` : null,
      api.get,
      { revalidateOnFocus: false },
    );

  const { data: thesis, isLoading: thesisLoading } =
    useSWR<ThesisThreadSummary[]>("/thesis", api.get, {
      revalidateOnFocus: false,
    });

  const holdingTickers: string[] =
    summary?.holdings?.map((h) => h.ticker.toUpperCase()) ?? [];

  const thesisTickers: string[] =
    thesis?.map((t) => t.ticker.toUpperCase()) ?? [];

  // Union, dedupe, sort
  const tickers = [
    ...new Set([...holdingTickers, ...thesisTickers]),
  ].sort();

  const loading =
    portfoliosLoading ||
    (!!defaultPortfolio && summaryLoading) ||
    thesisLoading;

  return { tickers, loading };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneyIndexPage() {
  const { tickers, loading } = useJourneyTickers();

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Route className="w-6 h-6 text-vela-teal" />
          Stock Journey
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Every position&apos;s story: your convictions against what actually happened.
        </p>
      </div>

      {tickers.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-4">
          <Route className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No tickers to explore yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Add positions to your portfolio or write a thesis to start tracking the journey.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/portfolio"
              className="btn-primary text-sm"
            >
              Go to Portfolio
            </Link>
            <Link
              href="/thesis"
              className="btn-secondary text-sm"
            >
              Write a Thesis
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tickers.map((ticker) => (
            <Link
              key={ticker}
              href={`/journey/${ticker}`}
              className="vela-card flex flex-col items-center justify-center py-6 gap-1 hover:border-zinc-600 transition-colors text-center group"
            >
              <span className="font-mono text-lg font-bold text-vela-teal group-hover:text-white transition-colors">
                {ticker}
              </span>
              <span className="text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors">
                View journey
              </span>
            </Link>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
