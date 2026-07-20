"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
import { useJourney, COLOUR_CLASS, COLOUR_HEX, ENTRY_TYPE_LABEL } from "@/lib/journey";
import type { JourneyEvent } from "@/lib/journey";
import { formatCurrency, formatPercent, stripAiMarkdown } from "@/lib/formatters";
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

// ── Small primitives ──────────────────────────────────────────────────────────

/** Mono uppercase micro-label — the signature "instrument" eyebrow. */
function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.18em] text-vela-muted ${className}`}>
      {children}
    </p>
  );
}

/** One cell in the stat rail: label / big value / subtext. */
function StatCell({
  label,
  value,
  valueClass = "text-zinc-100",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="py-1 md:px-5 md:first:pl-0">
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <p className={`font-mono text-xl md:text-2xl font-semibold tabular-nums leading-none ${valueClass}`}>
        {value}
      </p>
      {sub != null && (
        <p className="mt-1.5 font-mono text-[11px] text-vela-muted tabular-nums">{sub}</p>
      )}
    </div>
  );
}

/** Segmented pill group (used for range + event-type filters). */
function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded border border-vela-border overflow-hidden">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-vela-teal/15 text-vela-teal"
                : "text-vela-muted hover:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
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
  payload?: Array<{ value: number; payload: { labelFull: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-vela-card border border-vela-border rounded px-3 py-2 text-xs shadow-xl">
      <p className="font-mono text-[10px] uppercase tracking-wider text-vela-muted mb-0.5">
        {payload[0].payload.labelFull ?? label}
      </p>
      <p className="font-mono text-vela-teal tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function fmtShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function nearestClose(
  eventISO: string,
  priceDates: string[],
  closeByDate: Map<string, number>,
): { date: string; close: number } | null {
  if (priceDates.length === 0) return null;
  const day = eventISO.slice(0, 10);
  // Only map events that fall inside the visible price window — clamping a
  // years-old note onto the first visible point would misstate its "wrote at".
  if (day < priceDates[0] || day > priceDates[priceDates.length - 1]) return null;
  const target = new Date(day).getTime();
  let best = priceDates[0];
  let bestDiff = Math.abs(new Date(priceDates[0]).getTime() - target);
  for (let i = 1; i < priceDates.length; i++) {
    const diff = Math.abs(new Date(priceDates[i]).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = priceDates[i];
    }
  }
  const close = closeByDate.get(best);
  return close === undefined ? null : { date: best, close };
}

// ── Reflect / thesis-review panel (restyled to the template's Reflect column) ──

function ReflectPanel({ ticker }: { ticker: string }) {
  const [state, setState] = useState<{ text: string; loading: boolean; error?: string }>({
    text: "",
    loading: false,
  });

  function handleReview() {
    setState({ text: "", loading: true, error: undefined });
    streamThesisReview(
      ticker,
      (chunk) => setState((p) => ({ ...p, text: p.text + chunk })),
      () => setState((p) => ({ ...p, loading: false })),
      (err) => setState((p) => ({ ...p, loading: false, error: err })),
    );
  }

  const idle = !state.loading && !state.text && !state.error;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-vela-teal text-[10px] leading-none">◆</span>
        <Eyebrow>Reflect · reads your own numbers</Eyebrow>
      </div>

      {idle && (
        <p className="text-[15px] text-zinc-300 leading-relaxed mb-5">
          Walk your own thesis back against what actually happened. Velnor surfaces
          the questions worth asking about your reasoning — grounded in your notes and
          your real numbers, never a call on the stock.
        </p>
      )}

      {state.loading && !state.text && (
        <p className="text-[13px] text-vela-muted italic mb-5">Reading your thesis…</p>
      )}

      {state.error && <p className="text-[13px] text-loss mb-5">{state.error}</p>}

      {state.text && (
        <div className="mb-5">
          <p className="text-[15px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
            <InlineBold text={stripAiMarkdown(state.text)} />
          </p>
          <div className="mt-3">
            <Disclaimer variant="inline" />
          </div>
        </div>
      )}

      <button
        onClick={handleReview}
        disabled={state.loading}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[12px] font-medium
          bg-vela-teal/10 text-vela-teal border border-vela-teal/25
          hover:bg-vela-teal/15 hover:border-vela-teal/40
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        {state.loading ? "Reviewing…" : state.text ? "Ask again" : "Reflect on this thesis"}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type RangeKey = "3M" | "6M" | "1Y";
type FilterKey = "all" | "bull" | "bear" | "update" | "note" | "trade";

const RANGE_MONTHS: Record<RangeKey, number> = { "3M": 3, "6M": 6, "1Y": 24 };

export default function JourneyTickerPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const upperTicker = ticker?.toUpperCase() ?? null;

  const { journey, isLoading, error } = useJourney(upperTicker);

  const [range, setRange] = useState<RangeKey>("1Y");
  const [filter, setFilter] = useState<FilterKey>("all");

  // ── Derived data (hooks must run before any early return) ──────────────────
  const derived = useMemo(() => {
    if (!journey) return null;

    const full = journey.price_line ?? [];
    // Range slice — client-side, over the window we already have.
    let priceLine = full;
    if (full.length > 0 && range !== "1Y") {
      const last = new Date(full[full.length - 1].date);
      const cutoff = new Date(last);
      cutoff.setMonth(cutoff.getMonth() - RANGE_MONTHS[range]);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      priceLine = full.filter((p) => p.date >= cutoffISO);
    }

    const priceData = priceLine.map((pt) => ({
      date: pt.date,
      close: pt.close,
      labelFull: fmtShortDate(pt.date),
    }));
    const priceDates = priceData.map((p) => p.date);
    const closeByDate = new Map<string, number>(priceData.map((p) => [p.date, p.close]));

    // Event markers on the line — only events inside the visible window.
    const markers: { x: string; y: number; fill: string; hollow: boolean }[] = [];
    for (const ev of journey.events) {
      if (!passesFilter(ev, filter)) continue;
      const hit = nearestClose(ev.date, priceDates, closeByDate);
      if (!hit) continue;
      markers.push({
        x: hit.date,
        y: hit.close,
        fill: COLOUR_HEX[ev.colour],
        hollow: !(ev.entry_type === "bull" || ev.entry_type === "bear"),
      });
    }

    const xTickInterval = priceData.length > 0 ? Math.max(1, Math.floor(priceData.length / 6)) : 1;

    // Thesis-log rows (newest first), each with a derived "wrote at / since".
    const currentPx = journey.position?.current_price ?? null;
    const fullDates = full.map((p) => p.date);
    const fullClose = new Map<string, number>(full.map((p) => [p.date, p.close]));
    const rows = journey.events
      .filter((ev) => passesFilter(ev, filter))
      .slice()
      .reverse()
      .map((ev) => {
        const at = nearestClose(ev.date, fullDates, fullClose);
        const sincePct =
          at && currentPx ? ((currentPx - at.close) / at.close) * 100 : null;
        return { ev, wroteAt: at?.close ?? ev.price ?? null, sincePct };
      });

    return { priceData, markers, xTickInterval, rows };
  }, [journey, range, filter]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={`Could not load the journey for ${upperTicker ?? "this ticker"}.`}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!journey || !derived) return null;

  const pos = journey.position;
  const pnlPct = pos?.unrealized_pnl_pct ?? null;
  const pnlPositive = pnlPct !== null && pnlPct >= 0;
  const costTotal = pos ? pos.shares * pos.avg_cost : null;
  const pnlDollar = pos?.market_value != null && costTotal != null ? pos.market_value - costTotal : null;
  const stateCls = COLOUR_CLASS[journey.state_colour];
  const thesisCount = journey.events.filter((e) => e.kind === "thesis").length;

  // First buy → held duration (real, derived from transaction events).
  const firstBuy = journey.events.find((e) => e.kind === "buy");
  const heldLabel = (() => {
    if (!firstBuy) return null;
    const days = (Date.now() - new Date(firstBuy.date).getTime()) / 86_400_000;
    if (days < 0) return null;
    const years = days / 365;
    return years >= 1 ? `${years.toFixed(1)}y held` : `${Math.max(1, Math.round(days / 30))}mo held`;
  })();

  const rangeOpts: { key: RangeKey; label: string }[] = [
    { key: "3M", label: "3M" },
    { key: "6M", label: "6M" },
    { key: "1Y", label: "1Y" },
  ];
  const filterOpts: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "bull", label: "Bull" },
    { key: "bear", label: "Bear" },
    { key: "update", label: "Update" },
    { key: "note", label: "Note" },
    { key: "trade", label: "Trades" },
  ];

  return (
    <PageTransition>
      {/* ── Top breadcrumb rail ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-vela-border/60 pb-3 mb-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          <Link href="/journey" className="text-vela-muted hover:text-vela-teal transition-colors">
            Stock Journey
          </Link>
          <span className="text-vela-subtle">/</span>
          <span className="text-zinc-300">{journey.ticker}</span>
        </div>
        <p className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.18em] text-vela-muted">
          plotted against price · your conviction trail
        </p>
      </div>

      {/* ── Hero: ticker + name + price ──────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-zinc-100 leading-none">
              {journey.ticker}
            </h1>
            {journey.name && journey.name !== journey.ticker && (
              <span className="text-lg text-vela-muted">{journey.name}</span>
            )}
          </div>
        </div>
        {pos?.current_price != null && (
          <div className="text-right">
            <p className="font-mono text-3xl md:text-4xl font-semibold text-zinc-100 tabular-nums leading-none">
              {formatCurrency(pos.current_price)}
            </p>
            {pnlPct !== null && (
              <p className={`mt-1.5 font-mono text-[13px] tabular-nums ${pnlPositive ? "text-gain" : "text-loss"}`}>
                {pnlPositive ? "▲" : "▼"} {formatPercent(Math.abs(pnlPct), false)} unrealized
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Stat rail ────────────────────────────────────────────────────── */}
      {pos && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 border-y border-vela-border/60 py-5 mb-8 md:divide-x md:divide-vela-border/50">
          <StatCell
            label="Unrealized P&L"
            value={
              pnlDollar != null
                ? `${pnlPositive ? "+" : "−"}${formatCurrency(Math.abs(pnlDollar))}`
                : "—"
            }
            valueClass={pnlPositive ? "text-gain" : "text-loss"}
            sub={pnlPct !== null ? formatPercent(pnlPct) : undefined}
          />
          <StatCell
            label="Cost basis"
            value={formatCurrency(pos.avg_cost)}
            sub={`${pos.shares.toLocaleString("en-US")} sh · ${costTotal != null ? formatCurrency(costTotal) : "—"}`}
          />
          <StatCell
            label="Market value"
            value={pos.market_value != null ? formatCurrency(pos.market_value) : "—"}
            sub={heldLabel ?? `${pos.shares.toLocaleString("en-US")} shares`}
          />
          <StatCell
            label="Latest stance"
            value={
              <span className={journey.latest_stance ? COLOUR_CLASS[journey.state_colour].text : "text-vela-subtle"}>
                {journey.latest_stance ? ENTRY_TYPE_LABEL[journey.latest_stance] : "—"}
              </span>
            }
            sub={thesisCount > 0 ? `${thesisCount} thesis ${thesisCount === 1 ? "entry" : "entries"}` : "no thesis yet"}
          />
        </div>
      )}

      {/* ── The journey: header + filters ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Eyebrow>The journey</Eyebrow>
          <span className={`text-[10px] leading-none ${stateCls.text}`}>◆</span>
          <span className={`text-sm font-medium ${stateCls.text}`}>{journey.state}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PillGroup options={rangeOpts} value={range} onChange={setRange} />
          <PillGroup options={filterOpts} value={filter} onChange={setFilter} />
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      {derived.priceData.length > 0 ? (
        <>
          <div className="h-[300px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={derived.priceData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="#131C2C" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval={derived.xTickInterval}
                  tickFormatter={(d: string) => {
                    try {
                      return new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                    } catch {
                      return d.slice(0, 7);
                    }
                  }}
                  tick={{ fill: "#5A6678", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  orientation="right"
                  tick={{ fill: "#5A6678", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip cursor={{ stroke: "#1B2638", strokeWidth: 1 }} content={<PriceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#1AA8BB"
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3, fill: "#1AA8BB", strokeWidth: 0 }}
                  animationDuration={800}
                />
                {derived.markers.map((m, i) => (
                  <ReferenceDot
                    key={i}
                    x={m.x}
                    y={m.y}
                    r={6}
                    fill={m.hollow ? "#0B1322" : m.fill}
                    stroke={m.hollow ? m.fill : "#050A16"}
                    strokeWidth={m.hollow ? 2.5 : 2}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 mb-10 font-mono text-[10px] uppercase tracking-wider text-vela-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-px bg-vela-teal" /> price
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOUR_HEX.gain }} /> bull
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOUR_HEX.loss }} /> bear
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full border-2" style={{ borderColor: COLOUR_HEX.teal }} /> add / update
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full border-2" style={{ borderColor: COLOUR_HEX.neutral }} /> note
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-vela-subtle italic mb-10">Price history unavailable right now.</p>
      )}

      {/* ── Lower: thesis log + reflect ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-x-12 gap-y-10 border-t border-vela-border/60 pt-8">
        {/* Thesis log */}
        <div>
          <Eyebrow className="mb-5">Conviction trail · append-only</Eyebrow>
          {derived.rows.length === 0 ? (
            <p className="text-sm text-vela-muted py-6">
              No entries yet. Write a thesis or log a trade to start the journey.
            </p>
          ) : (
            <div className="space-y-6">
              {derived.rows.map(({ ev, wroteAt, sincePct }, i) => (
                <LogRow key={`${ev.date}-${i}`} ev={ev} wroteAt={wroteAt} sincePct={sincePct} />
              ))}
            </div>
          )}
        </div>

        {/* Reflect column */}
        <div className="lg:border-l lg:border-vela-border/60 lg:pl-12">
          {journey.has_thesis ? (
            <ReflectPanel ticker={journey.ticker} />
          ) : (
            <div>
              <Eyebrow className="mb-4">Reflect</Eyebrow>
              <p className="text-[15px] text-zinc-300 leading-relaxed">
                Write a thesis for {journey.ticker} and Velnor will help you walk your
                own reasoning back against what the price actually did.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

// ── Thesis-log row ────────────────────────────────────────────────────────────

function LogRow({
  ev,
  wroteAt,
  sincePct,
}: {
  ev: JourneyEvent;
  wroteAt: number | null;
  sincePct: number | null;
}) {
  const cls = COLOUR_CLASS[ev.colour];
  const badge = ev.kind === "thesis" && ev.entry_type ? ENTRY_TYPE_LABEL[ev.entry_type] : ev.title;
  const sincePositive = sincePct != null && sincePct >= 0;

  return (
    <div className="relative pl-5">
      {/* spine dot */}
      <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${cls.dot}`} />
      {/* top line */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono text-[10px] uppercase tracking-wider ${cls.text}`}>{badge}</span>
        <span className="font-mono text-[11px] text-vela-muted tabular-nums">{fmtShortDate(ev.date)}</span>
        <span className="flex-1" />
        {wroteAt != null && (
          <span className="font-mono text-[11px] text-vela-muted tabular-nums">
            {ev.kind === "thesis" ? "wrote at " : "at "}
            {formatCurrency(wroteAt)}
            {sincePct != null && (
              <span className={sincePositive ? "text-gain" : "text-loss"}>
                {" · "}
                {formatPercent(sincePct)} since
              </span>
            )}
          </span>
        )}
      </div>
      {/* body */}
      {ev.kind === "thesis" ? (
        <>
          <p className="mt-1.5 text-[15px] font-medium text-zinc-100 leading-snug">
            {ev.title.replace(/^Thesis:\s*/, "")}
          </p>
          {ev.detail && (
            <p className="mt-1 text-[13px] text-vela-muted leading-relaxed">{ev.detail}</p>
          )}
        </>
      ) : (
        ev.detail && <p className="mt-1.5 text-[13px] text-vela-muted leading-relaxed">{ev.detail}</p>
      )}
    </div>
  );
}

// ── Filter predicate ──────────────────────────────────────────────────────────

function passesFilter(ev: JourneyEvent, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "trade") return ev.kind !== "thesis";
  return ev.kind === "thesis" && ev.entry_type === filter;
}
