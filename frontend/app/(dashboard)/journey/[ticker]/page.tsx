"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { useJourney, COLOUR_CLASS, COLOUR_HEX, ENTRY_TYPE_LABEL, ENTRY_TYPE_CHIP } from "@/lib/journey";
import type { JourneyEvent, JourneyColour, ThesisEntryType } from "@/lib/journey";
import { formatCurrency, formatPercent, formatDate, stripAiMarkdown } from "@/lib/formatters";
import { apiStreamPost } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import Disclaimer from "@/components/shared/Disclaimer";

// ── Streaming helper ──────────────────────────────────────────────────────────

async function streamThesisReview(
  ticker: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const res = await apiStreamPost("/ai/thesis-review", { ticker });
    if (res.status === 429) {
      onError("Daily AI limit reached. Resets at midnight.");
      return;
    }
    if (!res.ok || !res.body) {
      onError("Failed to connect.");
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
          if (msg.done) onDone();
          if (msg.error) onError(msg.error);
        } catch { /* ignore malformed */ }
      }
    }
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
  }
}

// ── Inline bold renderer ──────────────────────────────────────────────────────

/**
 * Splits text on **bold** markers and renders them as <strong> spans.
 * Keeps it simple — no heavy markdown lib dependency.
 */
function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-zinc-100 font-semibold">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Thesis review panel ───────────────────────────────────────────────────────

interface ThesisReviewState {
  text: string;
  loading: boolean;
  error?: string;
}

function ThesisReviewPanel({ ticker }: { ticker: string }) {
  const [state, setState] = useState<ThesisReviewState>({
    text: "",
    loading: false,
  });

  function handleReview() {
    setState({ text: "", loading: true, error: undefined });

    streamThesisReview(
      ticker,
      (chunk) => {
        setState((prev) => ({ ...prev, text: prev.text + chunk }));
      },
      () => {
        setState((prev) => ({ ...prev, loading: false }));
      },
      (err) => {
        setState((prev) => ({ ...prev, loading: false, error: err }));
      },
    );
  }

  return (
    <div className="vela-card space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Thesis Review
        </p>
        <button
          onClick={handleReview}
          disabled={state.loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium
            bg-vela-teal/10 text-vela-teal border border-vela-teal/25
            hover:bg-vela-teal/15 hover:border-vela-teal/40
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {state.loading ? "Reviewing..." : "Review this thesis"}
        </button>
      </div>

      {/* Loading state */}
      {state.loading && state.text === "" && (
        <p className="text-[12px] text-zinc-500 italic">Reviewing your thesis...</p>
      )}

      {/* Error state */}
      {state.error && (
        <p className="text-[12px] text-loss">{state.error}</p>
      )}

      {/* Streamed answer */}
      {state.text && (
        <div className="space-y-2">
          <p
            className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap"
          >
            <InlineBold text={stripAiMarkdown(state.text)} />
          </p>
          <Disclaimer variant="inline" />
        </div>
      )}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-vela-card border border-vela-border rounded px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="font-mono text-vela-teal tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

// ── State chip ────────────────────────────────────────────────────────────────

function StateChip({ label, colour }: { label: string; colour: JourneyColour }) {
  const cls = COLOUR_CLASS[colour];
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${cls.chipBg}`}
    >
      {label}
    </span>
  );
}

// ── Entry-type badge ──────────────────────────────────────────────────────────

function EntryTypeBadge({ type }: { type: ThesisEntryType }) {
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${ENTRY_TYPE_CHIP[type]}`}
    >
      {ENTRY_TYPE_LABEL[type]}
    </span>
  );
}

// ── Timeline event row ────────────────────────────────────────────────────────

function EventRow({ event }: { event: JourneyEvent }) {
  const shortDate = (() => {
    try {
      return new Date(event.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });
    } catch {
      return event.date.slice(0, 10);
    }
  })();

  const dotColour = COLOUR_CLASS[event.colour].dot;

  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      {/* Spine dot — positioned over the border-l rule */}
      <div className="flex flex-col items-center shrink-0 w-4">
        <span
          className={`w-2 h-2 rounded-full shrink-0 mt-1 -ml-[3px] ${dotColour}`}
        />
      </div>

      {/* Row content */}
      <div className="flex-1 min-w-0 pb-0">
        {/* Top line: date + title + chip */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-mono text-[11px] text-vela-muted tabular-nums shrink-0">
            {shortDate}
          </span>
          <span className="text-sm font-medium text-zinc-100">{event.title}</span>
          {event.kind === "thesis" && event.entry_type && (
            <EntryTypeBadge type={event.entry_type} />
          )}
          {event.price != null && (
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              @ {formatCurrency(event.price)}
            </span>
          )}
        </div>
        {/* Detail text */}
        {event.detail && (
          <p className="text-xs text-zinc-500 leading-snug mt-0.5">{event.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Nearest-date mapper ───────────────────────────────────────────────────────

/**
 * Given a YYYY-MM-DD event date and the array of price-line date strings,
 * returns the nearest price-line date (by calendar distance) or null if the
 * price_line is empty.
 */
function nearestPriceDate(
  eventDate: string,
  priceDates: string[],
): string | null {
  if (priceDates.length === 0) return null;
  const target = new Date(eventDate).getTime();
  let best = priceDates[0];
  let bestDiff = Math.abs(new Date(priceDates[0]).getTime() - target);
  for (let i = 1; i < priceDates.length; i++) {
    const diff = Math.abs(new Date(priceDates[i]).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = priceDates[i];
    }
  }
  return best;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JourneyTickerPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const upperTicker = ticker?.toUpperCase() ?? null;

  const { journey, isLoading, error } = useJourney(upperTicker);

  if (isLoading) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={`Could not load the journey for ${upperTicker ?? "this ticker"}.`}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!journey) return null;

  const pos = journey.position;
  const pnlPct = pos?.unrealized_pnl_pct ?? null;
  const pnlPositive = pnlPct !== null && pnlPct >= 0;

  const eventsDesc = [...journey.events].reverse();

  // Build price data keyed on YYYY-MM-DD (used by ReferenceDot x values)
  const priceData = (journey.price_line ?? []).map((pt) => ({
    date: pt.date,           // YYYY-MM-DD — the axis dataKey
    close: pt.close,
    label: (() => {
      try {
        return new Date(pt.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      } catch {
        return pt.date.slice(5, 10);
      }
    })(),
  }));

  // Index of close by YYYY-MM-DD for O(1) lookup
  const closeByDate = new Map<string, number>(
    priceData.map((pt) => [pt.date, pt.close]),
  );
  const priceDates = priceData.map((pt) => pt.date);

  // Derive event markers: map each event to the nearest price-line date
  interface EventMarker {
    x: string;
    y: number;
    fill: string;
  }
  const eventMarkers: EventMarker[] = [];
  for (const event of journey.events) {
    const eventDay = event.date.slice(0, 10); // YYYY-MM-DD
    const mapped = nearestPriceDate(eventDay, priceDates);
    if (mapped === null) continue;
    const close = closeByDate.get(mapped);
    if (close === undefined) continue;
    eventMarkers.push({
      x: mapped,
      y: close,
      fill: COLOUR_HEX[event.colour],
    });
  }

  // Thin out x-axis ticks — show ~6 ticks
  const xTickInterval =
    priceData.length > 0 ? Math.max(1, Math.floor(priceData.length / 6)) : 1;

  return (
    <PageTransition className="space-y-6">
      {/* Back nav */}
      <Link
        href="/journey"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Journeys
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl font-bold text-vela-teal">
              {journey.ticker}
            </span>
            <StateChip label={journey.state} colour={journey.state_colour} />
          </div>
          {journey.name && (
            <p className="text-sm text-zinc-400">{journey.name}</p>
          )}
        </div>
      </div>

      {/* Position card */}
      {pos && (
        <div className="vela-card">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
            Current Position
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500">Shares</p>
              <p className="font-mono text-base font-semibold text-zinc-100 tabular-nums">
                {pos.shares.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Avg Cost</p>
              <p className="font-mono text-base font-semibold text-zinc-100 tabular-nums">
                {formatCurrency(pos.avg_cost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Current Price</p>
              <p className="font-mono text-base font-semibold text-zinc-100 tabular-nums">
                {pos.current_price != null ? formatCurrency(pos.current_price) : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Market Value</p>
              <p className="font-mono text-base font-semibold text-zinc-100 tabular-nums">
                {pos.market_value != null ? formatCurrency(pos.market_value) : "--"}
              </p>
            </div>
          </div>
          {pnlPct !== null && (
            <div className="mt-3 pt-3 border-t border-vela-border">
              <p className="text-xs text-zinc-500 mb-0.5">Unrealized P&amp;L</p>
              <p
                className={`font-mono text-xl font-bold tabular-nums ${
                  pnlPositive ? "text-gain" : "text-loss"
                }`}
              >
                {pnlPositive ? "▲" : "▼"} {formatPercent(Math.abs(pnlPct))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Price line with event markers */}
      {priceData.length > 0 ? (
        <div className="vela-card">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">
            Price History (1Y)
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={priceData}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1B2638"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  interval={xTickInterval}
                  tickFormatter={(d: string) => {
                    try {
                      return new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    } catch {
                      return d.slice(5, 10);
                    }
                  }}
                  tick={{ fill: "#5A6678", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#5A6678", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={52}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  cursor={{ stroke: "#1B2638", strokeWidth: 1 }}
                  content={<PriceTooltip />}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#1AA8BB"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: "#1AA8BB", strokeWidth: 0 }}
                  animationDuration={900}
                />
                {eventMarkers.map((marker, i) => (
                  <ReferenceDot
                    key={i}
                    x={marker.x}
                    y={marker.y}
                    r={4}
                    fill={marker.fill}
                    stroke="#050A16"
                    strokeWidth={1.5}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-600 italic">
          Price history unavailable right now.
        </p>
      )}

      {/* Conviction trail — hairline-spine timeline */}
      <div className="vela-card">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">
          Conviction Trail
        </p>

        {eventsDesc.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">
            No events yet. Add a thesis or log a trade to start the journey.
          </p>
        ) : (
          /* Hairline spine: border-l runs the full height of this container */
          <div className="border-l border-vela-border pl-0">
            {eventsDesc.map((event, i) => (
              <EventRow key={`${event.date}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* AI thesis review — only shown when thesis entries exist */}
      {journey.has_thesis && (
        <ThesisReviewPanel ticker={journey.ticker} />
      )}
    </PageTransition>
  );
}
