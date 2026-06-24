"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useJourney, COLOUR_CLASS, ENTRY_TYPE_LABEL, ENTRY_TYPE_CHIP } from "@/lib/journey";
import type { JourneyEvent, JourneyColour, ThesisEntryType } from "@/lib/journey";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

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
  const cls = COLOUR_CLASS[event.colour];
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

  return (
    <div className="flex items-start gap-3 py-3 border-b border-vela-border last:border-b-0">
      {/* Dot + vertical connector */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} />
      </div>

      {/* Date */}
      <span className="font-mono text-xs text-zinc-500 tabular-nums w-[72px] shrink-0 pt-0.5">
        {shortDate}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
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
        {event.detail && (
          <p className="text-xs text-zinc-500 leading-snug">{event.detail}</p>
        )}
      </div>
    </div>
  );
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

  // Format date labels for x-axis — only month + day to keep them short
  const priceData = (journey.price_line ?? []).map((pt) => ({
    ...pt,
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

  // Thin out x-axis ticks so they don't crowd — show ~6 ticks
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

      {/* Price line */}
      {priceData.length > 0 ? (
        <div className="vela-card">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">
            Price History (1Y)
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={priceData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="journeyTealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1AA8BB" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1AA8BB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1B2638"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  interval={xTickInterval}
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
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#1AA8BB"
                  strokeWidth={1.5}
                  fill="url(#journeyTealGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#1AA8BB", strokeWidth: 0 }}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-600 italic">
          Price history unavailable right now.
        </p>
      )}

      {/* Event timeline */}
      <div className="vela-card">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
          Conviction Trail
        </p>

        {eventsDesc.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">
            No events yet. Add a thesis or log a trade to start the journey.
          </p>
        ) : (
          <div>
            {eventsDesc.map((event, i) => (
              <EventRow key={`${event.date}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
