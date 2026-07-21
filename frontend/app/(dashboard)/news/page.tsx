"use client";

import { useState, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useNewsFeed, type NewsArticle } from "@/hooks/useNews";
import { formatTimeAgo } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import { TopBar, PageHero, Section, PillGroup, Eyebrow, Prose } from "@/components/instrument";

/** Sentinel key for the "all tickers" pill. `filter` itself stays `string | null`. */
const ALL_KEY = "__all__";

export default function NewsPage() {
  const { articles, isLoading, isEmpty } = useNewsFeed();
  const [filter, setFilter] = useState<string | null>(null);

  // Unique tickers from all articles
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.tickers.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [articles]);

  const sourceCount = useMemo(
    () => new Set(articles.map((a) => a.source).filter(Boolean)).size,
    [articles],
  );

  const filtered = filter
    ? articles.filter((a) => a.tickers.includes(filter))
    : articles;

  if (isLoading) return <LoadingSkeleton />;

  const pillOptions = [
    { key: ALL_KEY, label: "All" },
    ...allTickers.map((t) => ({ key: t, label: t })),
  ];

  const tickerFilter =
    allTickers.length > 1 ? (
      <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
        <PillGroup
          options={pillOptions}
          value={filter ?? ALL_KEY}
          onChange={(k) =>
            setFilter((prev) => {
              if (k === ALL_KEY) return null;
              return prev === k ? null : k;
            })
          }
          ariaLabel="Filter stories by ticker"
        />
      </div>
    ) : undefined;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "News" }]}
        note={
          isEmpty
            ? "nothing in the feed yet"
            : `${articles.length} ${articles.length === 1 ? "story" : "stories"} · refreshed every 5 min`
        }
      />

      <PageHero
        title="News"
        meta="Stories touching the names you hold or follow"
        figure={isEmpty ? undefined : filtered.length}
        figureSub={
          isEmpty
            ? undefined
            : filter
              ? `mentioning ${filter}`
              : `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`
        }
      />

      {isEmpty ? (
        <Section label="Feed" labelAside="— empty">
          <div className="border border-vela-border px-6 py-14 text-center">
            <Eyebrow>Nothing to read yet</Eyebrow>
            <Prose className="mx-auto mt-2.5 max-w-[340px]">
              The feed is built from your positions and your lookout list. Add a ticker to either one
              and stories will start arriving here.
            </Prose>
          </div>
        </Section>
      ) : (
        <Section
          label="Stories"
          labelAside={`— ${filtered.length}`}
          prose="Headlines are pulled from public wires. Nothing here is filtered or ranked by us, and none of it is a view on your positions."
          controls={tickerFilter}
        >
          {filtered.length === 0 ? (
            <div className="border border-vela-border px-6 py-12 text-center">
              <Eyebrow>No stories for {filter}</Eyebrow>
              <Prose className="mx-auto mt-2.5 max-w-[320px]">
                Nothing has come through for this ticker recently. Clear the filter to see the rest of
                the feed.
              </Prose>
            </div>
          ) : (
            <div className="divide-y divide-vela-border border-y border-vela-border">
              {filtered.map((article, i) => (
                <ArticleRow key={article.url || i} article={article} />
              ))}
            </div>
          )}
        </Section>
      )}
    </PageTransition>
  );
}

// ── Article row ──────────────────────────────────────────────────────────────

function ArticleRow({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 py-4 transition-colors hover:bg-vela-teal/[0.03]"
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-zinc-100 transition-colors group-hover:text-vela-teal">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-vela-body">
            {article.summary}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="truncate font-mono text-[11px] text-vela-muted">{article.source}</span>
          <span aria-hidden="true" className="font-mono text-[11px] text-vela-subtle">
            /
          </span>
          <span className="font-mono text-[11px] tabular-nums text-vela-muted">
            {formatTimeAgo(article.published_at)}
          </span>

          {article.tickers.length > 0 && (
            <>
              <span aria-hidden="true" className="font-mono text-[11px] text-vela-subtle">
                /
              </span>
              {article.tickers.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded bg-vela-teal/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-vela-teal"
                >
                  {t}
                </span>
              ))}
              {article.tickers.length > 3 && (
                <span className="font-mono text-[10px] tabular-nums text-vela-muted">
                  +{article.tickers.length - 3}
                </span>
              )}
            </>
          )}

          <ExternalLink
            aria-hidden="true"
            className="ml-auto h-3 w-3 shrink-0 text-vela-muted transition-colors group-hover:text-vela-teal"
          />
        </div>
      </div>

      {article.thumbnail && (
        <div className="hidden h-20 w-20 shrink-0 overflow-hidden rounded border border-vela-border sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </a>
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div>
      <div className="mb-7 flex items-center justify-between gap-4 border-b border-vela-border pb-3">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton hidden h-3 w-40 sm:block" />
      </div>
      <div className="skeleton h-10 w-40" />
      <div className="skeleton mt-3 h-3 w-64" />
      <div className="mt-9 border-t border-vela-border pt-7">
        <div className="skeleton h-3 w-24" />
        <div className="mt-5 divide-y divide-vela-border border-y border-vela-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-4">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton mt-2 h-3 w-full" />
              <div className="skeleton mt-2 h-3 w-5/6" />
              <div className="mt-2.5 flex gap-2">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-12" />
                <div className="skeleton h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
