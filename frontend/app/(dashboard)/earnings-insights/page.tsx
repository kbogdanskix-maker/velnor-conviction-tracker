"use client";

import { useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Zap, RefreshCw, ChevronDown, ChevronUp,
  BarChart2, Loader2, AlertCircle, Newspaper,
} from "lucide-react";
import { useDefaultPortfolio, usePortfolioSummary } from "@/hooks/usePortfolio";
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import TierGate from "@/components/shared/TierGate";
import { apiStream } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface EarningsState {
  text: string;
  loading: boolean;
  error: string | null;
  cached: boolean;
}

// ── SSE streaming helper ─────────────────────────────────────────────────────

async function streamEarnings(
  ticker: string,
  onChunk: (text: string) => void,
  onDone: (cached: boolean) => void,
  onError: (err: string) => void,
) {
  try {
    const res = await apiStream(`/ai/earnings/${ticker}`);

    if (res.status === 403) {
      onError("AI earnings briefings are a Voyager feature. Upgrade to analyze your holdings.");
      return;
    }
    if (res.status === 429) {
      onError("Daily AI insight limit reached. Resets at midnight, or upgrade to Navigator for unlimited.");
      return;
    }
    if (!res.ok || !res.body) {
      onError("Failed to fetch earnings summary.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const msg = JSON.parse(raw);
          if (msg.text) onChunk(msg.text);
          if (msg.done) onDone(!!msg.cached);
          if (msg.error) onError(msg.error);
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
  }
}

// ── Earnings card ────────────────────────────────────────────────────────────

function EarningsCard({
  ticker,
  marketValue,
  unrealizedPnl,
  unrealizedPnlPct,
}: {
  ticker: string;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
}) {
  const [state, setState] = useState<EarningsState>({
    text: "",
    loading: false,
    error: null,
    cached: false,
  });
  const [expanded, setExpanded] = useState(false);

  const generate = useCallback(async () => {
    setState({ text: "", loading: true, error: null, cached: false });
    setExpanded(true);

    await streamEarnings(
      ticker,
      (chunk) => setState((s) => ({ ...s, text: s.text + chunk })),
      (cached) => setState((s) => ({ ...s, loading: false, cached })),
      (err) => setState((s) => ({ ...s, loading: false, error: err })),
    );
  }, [ticker]);

  const isProfit = (unrealizedPnl ?? 0) >= 0;

  return (
    <div className="vela-card group transition-all duration-200 hover:border-zinc-600">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-zinc-300 tabular-nums">
              {ticker.slice(0, 4)}
            </span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100 text-sm">{ticker}</p>
            {marketValue != null && (
              <p className="text-xs text-zinc-500 tabular-nums">{formatCurrency(marketValue)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {unrealizedPnl != null && (
            <div className={`text-right ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              <p className="text-xs font-medium tabular-nums">
                {isProfit ? "+" : ""}{formatCurrency(unrealizedPnl)}
              </p>
              {unrealizedPnlPct != null && (
                <p className="text-[10px] tabular-nums">
                  {isProfit ? "+" : ""}{unrealizedPnlPct.toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {/* Generate / refresh button */}
          {state.text ? (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          ) : null}

          <button
            onClick={generate}
            disabled={state.loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              state.text
                ? "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
            }`}
          >
            {state.loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : state.text ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {state.text ? (state.loading ? "Refreshing…" : "Re-run") : (state.loading ? "Analyzing…" : "Analyze")}
          </button>
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && (state.text || state.error) && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          {state.error ? (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          ) : (
            <div className="relative">
              <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
                {state.text}
                {state.loading && (
                  <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
              {state.cached && (
                <p className="text-[10px] text-zinc-600 mt-2">Cached summary</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EarningsInsightsPage() {
  const { portfolio, loading: pLoading } = useDefaultPortfolio();
  const { data: summary, isLoading: sLoading } = usePortfolioSummary(portfolio?.id);

  const loading = pLoading || sLoading;

  const holdings = summary?.holdings ?? [];
  // Sort by market value descending
  const sorted = [...holdings]
    .filter((h) => h.asset_type !== "crypto" && h.asset_type !== "bond")
    .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0));

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-amber-400" />
            Earnings Insights
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            AI-powered earnings briefings for your holdings
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Newspaper className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No equity holdings found</p>
            <p className="text-sm text-zinc-500 mt-1">
              Add stocks to your portfolio to see AI earnings briefings.
            </p>
          </div>
        </div>
      ) : (
        /* AI briefings gated to Voyager+ (backend enforces too) */
        <TierGate requiredTier="voyager">
          <RevealOnScroll>
            <div className="vela-card flex items-start gap-3 bg-amber-500/5 border-amber-500/15">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                Briefings are generated from live yfinance data (EPS history, revenue trends, analyst targets) and recent news.
                Click <span className="text-amber-400 font-medium">Analyze</span> on any holding to generate. Results are cached for 12 hours.
              </p>
            </div>
          </RevealOnScroll>

          <div className="space-y-3">
            {sorted.map((h, i) => (
              <RevealOnScroll key={h.ticker} delay={i * 0.03}>
                <EarningsCard
                  ticker={h.ticker}
                  marketValue={h.market_value}
                  unrealizedPnl={h.unrealized_pnl}
                  unrealizedPnlPct={h.unrealized_pnl_pct}
                />
              </RevealOnScroll>
            ))}
          </div>
        </TierGate>
      )}
    </PageTransition>
  );
}
