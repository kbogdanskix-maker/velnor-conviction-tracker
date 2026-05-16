"use client";

import { ExternalLink } from "lucide-react";
import { formatTimeAgo } from "@/lib/formatters";
import type { NewsArticle } from "@/hooks/useNews";

interface Props {
  article: NewsArticle;
  compact?: boolean;
}

export default function NewsCard({ article, compact }: Props) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="vela-card block hover:border-zinc-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group"
    >
      <div className="flex gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 mb-1">
            {article.title}
          </h3>

          {!compact && article.summary && (
            <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 mb-2">
              {article.summary}
            </p>
          )}

          {/* Footer: source + time + tickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">
              {article.source}
            </span>
            <span className="text-xs text-zinc-600">&middot;</span>
            <span className="text-xs text-zinc-500 tabular">
              {formatTimeAgo(article.published_at)}
            </span>

            {article.tickers.length > 0 && (
              <>
                <span className="text-xs text-zinc-600">&middot;</span>
                {article.tickers.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-vela-teal/15 text-vela-teal"
                  >
                    {t}
                  </span>
                ))}
                {article.tickers.length > 3 && (
                  <span className="text-[11px] text-zinc-500">
                    +{article.tickers.length - 3}
                  </span>
                )}
              </>
            )}

            <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-vela-teal transition-colors ml-auto shrink-0" />
          </div>
        </div>

        {/* Thumbnail */}
        {!compact && article.thumbnail && (
          <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-zinc-800">
            <img
              src={article.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </a>
  );
}
