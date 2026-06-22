"use client";

import { useState } from "react";
import {
  MessageCircle, TrendingUp, TrendingDown, Minus,
  RefreshCw, ExternalLink, Search, ChevronDown, ChevronUp,
  Newspaper,
} from "lucide-react";
import { usePortfolioSentiment, useTickerSentiment, type TickerSentiment } from "@/hooks/useSentiment";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  // score is -100..100, map to 0..180 degrees
  const clamp = Math.max(-100, Math.min(100, score));
  const deg = ((clamp + 100) / 200) * 180;
  const color =
    clamp >= 20 ? "#34d399"   // emerald-400
    : clamp <= -20 ? "#f43f5e" // rose-500
    : "#a1a1aa";               // zinc-400

  return (
    <div className="relative flex items-end justify-center" style={{ width: 80, height: 44 }}>
      {/* Track */}
      <svg width="80" height="44" viewBox="0 0 80 44" fill="none">
        <path
          d="M6 40 A34 34 0 0 1 74 40"
          stroke="#27272a"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6 40 A34 34 0 0 1 74 40"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="106.8"
          strokeDashoffset={106.8 - (deg / 180) * 106.8}
          fill="none"
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
        />
      </svg>
      {/* Needle */}
      <div
        className="absolute bottom-0 left-1/2 origin-bottom"
        style={{
          width: 2,
          height: 28,
          marginLeft: -1,
          marginBottom: 6,
          background: color,
          borderRadius: 2,
          transform: `rotate(${deg - 90}deg)`,
          transition: "transform 0.8s ease, background 0.4s ease",
        }}
      />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2" style={{ borderColor: color }} />
    </div>
  );
}

// ── Sentiment bar ────────────────────────────────────────────────────────────

function SentimentBar({ bullish, bearish, neutral }: { bullish: number; bearish: number; neutral: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
      <div className="bg-emerald-400/70 transition-all duration-500" style={{ width: `${bullish}%` }} />
      <div className="bg-zinc-600 transition-all duration-500" style={{ width: `${neutral}%` }} />
      <div className="bg-rose-500/70 transition-all duration-500" style={{ width: `${bearish}%` }} />
    </div>
  );
}

// ── Score label ──────────────────────────────────────────────────────────────

function ScoreLabel({ score }: { score: number }) {
  if (score >= 20) return <span className="text-emerald-400 font-semibold">Bullish</span>;
  if (score <= -20) return <span className="text-rose-500 font-semibold">Bearish</span>;
  return <span className="text-zinc-400 font-semibold">Neutral</span>;
}

// ── Headline row ─────────────────────────────────────────────────────────────

function HeadlineRow({ h }: { h: TickerSentiment["headlines"][0] }) {
  const dotColor =
    h.label === "bullish" ? "bg-emerald-400"
    : h.label === "bearish" ? "bg-rose-500"
    : "bg-zinc-500";

  return (
    <a
      href={h.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 py-2 hover:bg-zinc-800/40 rounded px-2 -mx-2 transition-colors group"
    >
      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 group-hover:text-zinc-100 leading-snug transition-colors line-clamp-2">
          {h.title}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{h.source}</p>
      </div>
      <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

// ── Ticker card ──────────────────────────────────────────────────────────────

function TickerCard({ s }: { s: TickerSentiment }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor =
    s.overall_score >= 20 ? "text-emerald-400"
    : s.overall_score <= -20 ? "text-rose-500"
    : "text-zinc-400";
  const borderColor =
    s.overall_score >= 20 ? "border-emerald-400/20"
    : s.overall_score <= -20 ? "border-rose-500/20"
    : "border-zinc-800";

  return (
    <div className={`vela-card border ${borderColor} transition-colors`}>
      {/* Header row */}
      <div className="flex items-start gap-4">
        <ScoreGauge score={s.overall_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono font-bold text-zinc-100 text-base">{s.ticker}</span>
            <ScoreLabel score={s.overall_score} />
          </div>
          <div className={`text-2xl font-display font-bold tabular-nums ${scoreColor}`}>
            {s.overall_score > 0 ? "+" : ""}{s.overall_score}
          </div>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {s.article_count} article{s.article_count !== 1 ? "s" : ""} scored
          </p>
        </div>
        {/* Breakdown */}
        <div className="text-right shrink-0 hidden sm:block">
          <div className="flex items-center gap-3 text-[10px] mb-1.5">
            <span className="text-emerald-400">{s.bullish_pct}% bull</span>
            <span className="text-zinc-500">{s.neutral_pct}% neut</span>
            <span className="text-rose-500">{s.bearish_pct}% bear</span>
          </div>
          <SentimentBar bullish={s.bullish_pct} bearish={s.bearish_pct} neutral={s.neutral_pct} />
        </div>
      </div>

      {/* Mobile breakdown */}
      <div className="sm:hidden mt-2">
        <div className="flex items-center gap-3 text-[10px] mb-1">
          <span className="text-emerald-400">{s.bullish_pct}% bull</span>
          <span className="text-zinc-500">{s.neutral_pct}% neut</span>
          <span className="text-rose-500">{s.bearish_pct}% bear</span>
        </div>
        <SentimentBar bullish={s.bullish_pct} bearish={s.bearish_pct} neutral={s.neutral_pct} />
      </div>

      {/* Headlines toggle */}
      {s.headlines.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Newspaper className="w-3 h-3" />
            {expanded ? "Hide" : "Show"} headlines
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="mt-2 space-y-0.5 border-t border-zinc-800 pt-2">
              {s.headlines.map((h, i) => (
                <HeadlineRow key={i} h={h} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lookup panel ─────────────────────────────────────────────────────────────

function TickerLookup() {
  const [input, setInput] = useState("");
  const [queried, setQueried] = useState<string | null>(null);
  const { sentiment, isLoading } = useTickerSentiment(queried);

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) setQueried(t);
  }

  return (
    <div className="vela-card space-y-3">
      <h2 className="section-heading">Look Up Any Ticker</h2>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/50 transition-colors"
            placeholder="e.g. TSLA, NVDA, META"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!input.trim()}
          className="px-4 py-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/20 text-sm hover:bg-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Analyze
        </button>
      </div>

      {isLoading && queried && (
        <div className="text-center py-6 text-sm text-zinc-500">
          <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
          Fetching & scoring news for {queried}…
        </div>
      )}

      {sentiment && !isLoading && (
        <TickerCard s={sentiment} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SentimentPage() {
  const { tickers, isLoading, error, refresh } = usePortfolioSentiment();

  const mostBullish = tickers.length > 0
    ? tickers.reduce((a, b) => a.overall_score > b.overall_score ? a : b)
    : null;
  const mostBearish = tickers.length > 0
    ? tickers.reduce((a, b) => a.overall_score < b.overall_score ? a : b)
    : null;
  const avgScore = tickers.length > 0
    ? Math.round(tickers.reduce((s, t) => s + t.overall_score, 0) / tickers.length)
    : 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-teal-400" />
            News Sentiment
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Real news headlines scored with VADER NLP, refreshed every 4 hours
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Portfolio summary */}
      {!isLoading && tickers.length > 0 && (
        <RevealOnScroll>
          <div className="grid grid-cols-3 gap-4">
            <div className="vela-card text-center">
              <p className="text-xs text-zinc-500 mb-1">Portfolio Avg</p>
              <p className={`text-2xl font-display font-bold tabular-nums ${avgScore >= 20 ? "text-emerald-400" : avgScore <= -20 ? "text-rose-500" : "text-zinc-300"}`}>
                {avgScore > 0 ? "+" : ""}{avgScore}
              </p>
              <ScoreLabel score={avgScore} />
            </div>
            {mostBullish && (
              <div className="vela-card text-center border border-emerald-400/15">
                <p className="text-xs text-zinc-500 mb-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> Most Bullish
                </p>
                <p className="font-mono font-bold text-zinc-100">{mostBullish.ticker}</p>
                <p className="text-emerald-400 font-bold tabular-nums">+{mostBullish.overall_score}</p>
              </div>
            )}
            {mostBearish && mostBearish.ticker !== mostBullish?.ticker && (
              <div className="vela-card text-center border border-rose-500/15">
                <p className="text-xs text-zinc-500 mb-1 flex items-center justify-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-500" /> Most Bearish
                </p>
                <p className="font-mono font-bold text-zinc-100">{mostBearish.ticker}</p>
                <p className="text-rose-500 font-bold tabular-nums">{mostBearish.overall_score}</p>
              </div>
            )}
          </div>
        </RevealOnScroll>
      )}

      {/* Per-ticker cards */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="vela-card text-center py-10 text-zinc-500 text-sm">
          Failed to load sentiment data. Make sure your portfolio has holdings.
        </div>
      ) : tickers.length === 0 ? (
        <div className="vela-card text-center py-12 space-y-2">
          <MessageCircle className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-medium">No holdings or watchlist items yet</p>
          <p className="text-zinc-600 text-sm">Add positions to your portfolio or watchlist to see sentiment scores.</p>
        </div>
      ) : (
        <RevealOnScroll delay={0.05}>
          <div className="space-y-3">
            <h2 className="section-heading">Your Holdings &amp; Watchlist</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tickers.map((s) => (
                <TickerCard key={s.ticker} s={s} />
              ))}
            </div>
          </div>
        </RevealOnScroll>
      )}

      {/* Ad-hoc lookup */}
      <RevealOnScroll delay={0.1}>
        <TickerLookup />
      </RevealOnScroll>

      {/* Methodology note */}
      <RevealOnScroll delay={0.15}>
        <div className="flex gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-800/30">
          <Minus className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Scores are computed with <strong className="text-zinc-400">VADER NLP</strong> on recent headlines from Yahoo Finance.
            VADER measures text polarity, not price direction. A headline can sound positive while the stock falls.
            Use as one signal among many, not a trading signal.
          </p>
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}
