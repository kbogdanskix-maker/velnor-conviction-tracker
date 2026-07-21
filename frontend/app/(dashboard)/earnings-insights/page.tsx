"use client";

import { useState, useCallback } from "react";
import {
  Zap, RefreshCw, ChevronDown, ChevronUp, Loader2, AlertCircle,
} from "lucide-react";
import { useDefaultPortfolio, usePortfolioSummary } from "@/hooks/usePortfolio";
import { formatCurrency, stripAiMarkdown } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import TierGate from "@/components/shared/TierGate";
import Disclaimer from "@/components/shared/Disclaimer";
import { apiStream } from "@/lib/api";
import { TopBar, PageHero, Section, Eyebrow, Prose } from "@/components/instrument";

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

// ── Earnings row ─────────────────────────────────────────────────────────────

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
    <div className="py-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="w-9 h-9 shrink-0 rounded border border-vela-border
              flex items-center justify-center font-mono text-[10px] tracking-wide text-vela-muted"
          >
            {ticker.slice(0, 4)}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[14px] font-medium tracking-wide text-zinc-100">{ticker}</p>
            {marketValue != null && (
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-vela-muted">
                {formatCurrency(marketValue)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {unrealizedPnl != null && (
            <div className={`text-right ${isProfit ? "text-gain" : "text-loss"}`}>
              <p className="font-mono text-[12px] tabular-nums">
                {isProfit ? "+" : ""}{formatCurrency(unrealizedPnl)}
              </p>
              {unrealizedPnlPct != null && (
                <p className="font-mono text-[10.5px] tabular-nums">
                  {isProfit ? "+" : ""}{unrealizedPnlPct.toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {/* Expand / collapse */}
          {state.text ? (
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${ticker} briefing` : `Expand ${ticker} briefing`}
              className="p-1.5 rounded border border-transparent text-vela-muted
                hover:text-zinc-100 hover:border-vela-border transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          ) : null}

          {/* Generate / refresh */}
          <button
            onClick={generate}
            disabled={state.loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border
              font-mono text-[10px] uppercase tracking-wider transition-colors ${
              state.text
                ? "border-vela-border text-vela-muted hover:text-zinc-100 hover:border-vela-teal/40"
                : "bg-vela-teal/10 border-vela-teal/25 text-vela-teal hover:bg-vela-teal/15 hover:border-vela-teal/40"
            }`}
          >
            {state.loading ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
            ) : state.text ? (
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Zap className="w-3.5 h-3.5 shrink-0" />
            )}
            {state.text ? (state.loading ? "Refreshing" : "Re-run") : (state.loading ? "Analyzing" : "Analyze")}
          </button>
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && (state.text || state.error) && (
        <div className="mt-4 border-t border-vela-border pt-4">
          {state.error ? (
            <p className="flex items-start gap-2 font-mono text-[11px] leading-relaxed text-loss">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {state.error}
            </p>
          ) : (
            <div className="max-w-[680px]">
              <p className="text-[13.5px] leading-[1.55] text-vela-body whitespace-pre-wrap">
                {stripAiMarkdown(state.text)}
                {state.loading && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-1.5 h-3.5 bg-vela-teal ml-0.5 animate-pulse align-middle"
                  />
                )}
              </p>
              {state.cached && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted">
                  Cached summary
                </p>
              )}
              {state.text && <Disclaimer variant="inline" />}
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
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "Earnings" }]}
        note={
          sorted.length > 0
            ? `${sorted.length} ${sorted.length === 1 ? "name" : "names"} · cached 12h`
            : "no equity holdings"
        }
      />

      <PageHero
        title="Earnings"
        meta="AI briefings on the names you hold"
        figure={sorted.length > 0 ? String(sorted.length) : undefined}
        figureSub={sorted.length > 0 ? (sorted.length === 1 ? "name covered" : "names covered") : undefined}
        figureSubClass="text-vela-body"
      />

      {sorted.length === 0 ? (
        <div className="mt-8 border border-vela-border px-6 py-14 text-center">
          <Eyebrow>No equity holdings</Eyebrow>
          <Prose className="mt-2.5 mx-auto max-w-[360px]">
            Add stocks to your portfolio and each one gets an earnings briefing here.
          </Prose>
        </div>
      ) : (
        /* AI briefings gated to Voyager+ (backend enforces too) */
        <TierGate requiredTier="voyager">
          <Section
            label="Briefings"
            prose="Each briefing is built from live yfinance data, covering EPS history, revenue trends and analyst targets, plus recent news. Results are cached for 12 hours."
          >
            <div className="border-y border-vela-border divide-y divide-vela-border">
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

            <p className="mt-3 font-mono text-[11px] text-vela-muted">
              Run one with Analyze. Descriptive summaries only, not a recommendation.
            </p>
          </Section>
        </TierGate>
      )}
    </PageTransition>
  );
}
