"use client";

import { useState, useMemo } from "react";
import { Newspaper } from "lucide-react";
import { useNewsFeed } from "@/hooks/useNews";
import NewsCard from "@/components/news/NewsCard";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";

export default function NewsPage() {
  const { articles, isLoading, isEmpty } = useNewsFeed();
  const [filter, setFilter] = useState<string | null>(null);

  // Unique tickers from all articles
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.tickers.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [articles]);

  const filtered = filter
    ? articles.filter((a) => a.tickers.includes(filter))
    : articles;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">News</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Stories relevant to your portfolio and watchlist
        </p>
      </div>

      {isEmpty ? (
        <FloatingCard glowColor="rgba(12, 181, 201, 0.08)">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-vela-teal/10 flex items-center justify-center mb-4">
              <Newspaper className="w-6 h-6 text-vela-teal" />
            </div>
            <h2 className="text-base font-medium text-zinc-100 mb-1">
              No news yet
            </h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              Add holdings or watchlist tickers to see relevant stories.
            </p>
          </div>
        </FloatingCard>
      ) : (
        <>
          {/* Ticker filter bar */}
          {allTickers.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilter(null)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  filter === null
                    ? "bg-vela-teal/15 text-vela-teal"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All
              </button>
              {allTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(filter === t ? null : t)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    filter === t
                      ? "bg-vela-teal/15 text-vela-teal"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Articles */}
          <div className="space-y-3">
            {filtered.map((article, i) => (
              <NewsCard key={article.url || i} article={article} />
            ))}
          </div>

          {filtered.length === 0 && filter && (
            <p className="text-sm text-zinc-500 text-center py-8">
              No stories for {filter} right now.
            </p>
          )}
        </>
      )}
    </PageTransition>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-16" />
        <div className="skeleton h-4 w-56 mt-1" />
      </div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-7 w-14 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="vela-card space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
            <div className="flex gap-2">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
