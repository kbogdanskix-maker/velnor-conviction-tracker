"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Portfolio, PortfolioSummary } from "@/hooks/usePortfolio";
import type { ThesisThreadSummary } from "@/lib/thesis";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import { TopBar, PageHero, Section, Prose } from "@/components/instrument";

// ── Ticker collection ─────────────────────────────────────────────────────────

function useJourneyTickers(): {
  tickers: string[];
  heldCount: number;
  thesisCount: number;
  loading: boolean;
} {
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

  return {
    tickers,
    heldCount: new Set(holdingTickers).size,
    thesisCount: new Set(thesisTickers).size,
    loading,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneyIndexPage() {
  const { tickers, heldCount, thesisCount, loading } = useJourneyTickers();

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Stock Journey" }]}
        note={
          tickers.length > 0
            ? `${tickers.length} ${tickers.length === 1 ? "name" : "names"} · ${heldCount} held · ${thesisCount} with a thesis`
            : "nothing to plot yet"
        }
      />

      <PageHero
        title="Stock Journey"
        meta="your convictions against what actually happened"
        figure={tickers.length > 0 ? String(tickers.length) : undefined}
        figureSub={tickers.length > 0 ? "names to explore" : undefined}
        figureSubClass="text-vela-body"
      />

      {tickers.length === 0 ? (
        <div className="border-y border-vela-border py-16 flex flex-col items-center text-center gap-5 mt-8">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-100">
              Nothing to plot yet
            </h2>
            <Prose className="mt-2 max-w-md">
              Add a position or write a thesis, and its journey starts building from
              the first thing you record.
            </Prose>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/portfolio"
              className="inline-flex items-center px-3.5 py-2 rounded
                bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
                font-mono text-[10px] uppercase tracking-wider
                hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
            >
              Add a position
            </Link>
            <Link
              href="/thesis"
              className="inline-flex items-center px-3.5 py-2 rounded
                border border-vela-border text-vela-muted
                font-mono text-[10px] uppercase tracking-wider
                hover:text-zinc-100 hover:border-vela-teal/40 transition-colors"
            >
              Write a thesis
            </Link>
          </div>
        </div>
      ) : (
        <Section
          label="Names"
          prose="Every position's story: what you wrote, fixed at the price you wrote it."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-vela-border border border-vela-border">
            {tickers.map((ticker) => (
              <Link
                key={ticker}
                href={`/journey/${ticker}`}
                className="bg-vela-bg flex flex-col items-center justify-center py-7 gap-1.5
                  hover:bg-white/[0.025] transition-colors text-center group min-w-0"
              >
                <span className="font-mono text-lg font-semibold text-zinc-100 truncate max-w-full px-2">
                  {ticker}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted group-hover:text-vela-teal transition-colors">
                  View journey
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </PageTransition>
  );
}
