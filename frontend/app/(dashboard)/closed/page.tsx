"use client";

import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useClosed } from "@/lib/closed";
import { useThesisList, createThread, addEntry } from "@/lib/thesis";
import { formatCurrency, formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Eyebrow,
  Prose,
} from "@/components/instrument";
import type { ClosedPosition } from "@/lib/closed";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function fmtPnlDollar(value: number): string {
  const abs = formatCurrency(Math.abs(value));
  if (value >= 0) return `+${abs}`;
  return `-${abs.replace("-", "")}`;
}

/** Realized P&L: gain green vs. loss red — standard semantics. */
function realizedPnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-zinc-100";
}

/**
 * Since-sold colouring: REGRET-based, not sign-based.
 * Positive since_sold = stock ran up after exit = amber/cautionary.
 * Negative since_sold = stock dropped after exit = gain (good exit).
 */
function sinceSoldClass(pct: number): string {
  if (pct > 0) return "text-amber-400";
  if (pct < 0) return "text-gain";
  return "text-zinc-100";
}

function sinceSoldTag(pct: number): string {
  if (pct > 0) return "ran without you";
  if (pct < 0) return "dodged the drop";
  return "flat";
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ pos }: { pos: ClosedPosition }) {
  if (pos.still_held) {
    return (
      <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-amber-400">
        Trimmed
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded border border-vela-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-vela-muted">
      Closed
    </span>
  );
}

// ── Stat cell (row-level) ─────────────────────────────────────────────────────

function RowStat({
  label,
  value,
  valueClass = "text-zinc-100",
  sub,
  subClass = "text-vela-muted",
}: {
  label: ReactNode;
  value: ReactNode;
  valueClass?: string;
  sub?: ReactNode;
  subClass?: string;
}) {
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`mt-1.5 font-mono text-[15px] font-semibold tabular-nums leading-none truncate ${valueClass}`}
      >
        {value}
      </p>
      {sub != null && (
        <p className={`mt-1 font-mono text-[11px] tabular-nums truncate ${subClass}`}>{sub}</p>
      )}
    </div>
  );
}

// ── Lesson capture ────────────────────────────────────────────────────────────

function LessonCapture({
  pos,
  onSaved,
}: {
  pos: ClosedPosition;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const { threads, mutate: mutateThesis } = useThesisList();

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const body = `Lesson (sold): ${trimmed}`;
      const existing = threads.find(
        (t) => t.ticker.toLowerCase() === pos.ticker.toLowerCase(),
      );

      if (existing) {
        await addEntry(existing.id, { body, entry_type: "note" });
      } else {
        await createThread({
          ticker: pos.ticker.toUpperCase(),
          title: `${pos.ticker.toUpperCase()} -- post-mortem`,
          initial_body: body,
          entry_type: "note",
        });
      }

      setText("");
      setSavedMsg(true);
      await mutateThesis();
      onSaved();
      setTimeout(() => setSavedMsg(false), 3000);
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false);
    }
  }, [text, saving, threads, pos.ticker, mutateThesis, onSaved]);

  return (
    <div className="mt-5 space-y-2">
      <Eyebrow>Lesson</Eyebrow>
      <textarea
        className="w-full max-w-[640px] rounded border border-vela-border bg-vela-card px-3 py-2 text-[13.5px]
          leading-[1.55] text-zinc-100 placeholder:text-vela-muted resize-none
          focus:outline-none focus:border-vela-teal/50 transition-colors"
        rows={2}
        placeholder="What did this trade teach you?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="inline-flex items-center rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5
            font-mono text-[10px] uppercase tracking-wider text-vela-teal
            hover:bg-vela-teal/15 hover:border-vela-teal/40
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save to thesis"}
        </button>
        {savedMsg && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-vela-muted">
            Saved to thesis
          </span>
        )}
      </div>
    </div>
  );
}

// ── Position row ──────────────────────────────────────────────────────────────

function PositionRow({ pos }: { pos: ClosedPosition }) {
  const pnlPositive = pos.realized_pnl >= 0;
  const pnlArrow = pnlPositive ? "▲" : "▼";
  const ticker = pos.ticker.toUpperCase();

  return (
    <article className="py-6 first:pt-0">
      {/* Identity */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <Link
            href={`/journey/${ticker}`}
            className="shrink-0 font-mono text-[15px] font-semibold tracking-[0.02em] text-vela-teal hover:underline underline-offset-4"
          >
            {ticker}
          </Link>
          <StatusChip pos={pos} />
          {pos.name && pos.name !== pos.ticker && (
            <span className="truncate text-[13px] text-vela-body">{pos.name}</span>
          )}
        </div>
        <Link
          href={`/journey/${ticker}`}
          className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider
            text-vela-muted hover:text-vela-teal transition-colors"
          aria-label={`View ${pos.ticker} journey`}
        >
          <span className="hidden sm:inline">Journey</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>

      {/* Figures */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
        <RowStat
          label="Realized P&L"
          value={`${pnlArrow} ${fmtPnlDollar(pos.realized_pnl)}`}
          valueClass={realizedPnlClass(pos.realized_pnl)}
          sub={pos.realized_pnl_pct !== null ? fmtPct(pos.realized_pnl_pct) : undefined}
          subClass={realizedPnlClass(pos.realized_pnl)}
        />

        <RowStat
          label="Since you sold"
          value={pos.since_sold_pct !== null ? fmtPct(pos.since_sold_pct) : "—"}
          valueClass={
            pos.since_sold_pct !== null ? sinceSoldClass(pos.since_sold_pct) : "text-vela-muted"
          }
          sub={pos.since_sold_pct !== null ? sinceSoldTag(pos.since_sold_pct) : undefined}
        />

        <RowStat
          label="Sold"
          value={formatDate(pos.last_sell_date)}
          sub={pos.last_sell_price !== null ? `@ ${formatCurrency(pos.last_sell_price)}` : undefined}
        />

        <RowStat
          label="Proceeds"
          value={formatCurrency(pos.total_proceeds)}
          sub={pos.first_buy_date ? `held since ${formatDate(pos.first_buy_date)}` : undefined}
        />
      </div>

      {/* Lesson capture */}
      <LessonCapture pos={pos} onSaved={() => {}} />
    </article>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Panel className="px-6 py-14 text-center">
      <Eyebrow>No exits yet</Eyebrow>
      <Prose className="mx-auto mt-3 max-w-[380px]">
        Nothing has been sold yet. When you close or trim a position, the post-mortem lands here
        with what the stock did after you left.
      </Prose>
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClosedPage() {
  const { positions, isLoading, error } = useClosed();

  if (isLoading) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState
        message="Could not load closed positions."
        onRetry={() => window.location.reload()}
      />
    );
  }

  const count = positions.length;
  const totalRealized = positions.reduce((sum, p) => sum + p.realized_pnl, 0);
  const realizedPositive = totalRealized >= 0;
  const trimmedCount = positions.filter((p) => p.still_held).length;
  const closedCount = count - trimmedCount;
  const ranWithout = positions.filter(
    (p) => p.since_sold_pct !== null && p.since_sold_pct > 0,
  ).length;
  const dodged = positions.filter(
    (p) => p.since_sold_pct !== null && p.since_sold_pct < 0,
  ).length;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Closed & Lessons" }]}
        note={
          count > 0
            ? `${count} ${count === 1 ? "exit" : "exits"} · most recent first`
            : "no exits yet"
        }
      />

      <PageHero
        title="Closed & Lessons"
        meta={
          <>
            Post-mortem ledger
            <span aria-hidden="true" className="mx-2 text-vela-subtle">
              /
            </span>
            <Link
              href="/calibration"
              className="text-vela-teal hover:underline underline-offset-4"
            >
              See your calibration
            </Link>
          </>
        }
        figure={count > 0 ? fmtPnlDollar(totalRealized) : undefined}
        figureSub={count > 0 ? "realized, all exits" : undefined}
        figureSubClass={realizedPositive ? "text-gain" : "text-loss"}
      />

      {count === 0 ? (
        <div className="mt-8">
          <EmptyState />
        </div>
      ) : (
        <>
          <StatStrip className="mt-6">
            <StatCell
              label="Realized P&L"
              value={fmtPnlDollar(totalRealized)}
              valueClass={realizedPnlClass(totalRealized)}
              sub={`${count} ${count === 1 ? "exit" : "exits"}`}
            />
            <StatCell
              label="Fully closed"
              value={String(closedCount)}
              sub={`${trimmedCount} trimmed`}
            />
            <StatCell
              label="Ran without you"
              value={String(ranWithout)}
              sub="up since you sold"
            />
            <StatCell
              label="Dodged the drop"
              value={String(dodged)}
              sub="down since you sold"
            />
          </StatStrip>

          <Section
            label="Exits"
            prose="Every position you have sold: what the sale realized, where the price went afterwards, and the lesson you wrote down."
          >
            <div className="divide-y divide-vela-border">
              {positions.map((pos) => (
                <PositionRow key={pos.ticker} pos={pos} />
              ))}
            </div>
          </Section>
        </>
      )}
    </PageTransition>
  );
}
