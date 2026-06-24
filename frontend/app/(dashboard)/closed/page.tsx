"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Archive, ChevronRight } from "lucide-react";
import { useClosed } from "@/lib/closed";
import { useThesisList, createThread, addEntry } from "@/lib/thesis";
import { formatCurrency, formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import type { ClosedPosition } from "@/lib/closed";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(value: number | null): string {
  if (value === null) return "--";
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
  return "text-vela-muted";
}

/**
 * Since-sold colouring: REGRET-based, not sign-based.
 * Positive since_sold = stock ran up after exit = amber/cautionary.
 * Negative since_sold = stock dropped after exit = gain (good exit).
 */
function sinceSoldClass(pct: number): string {
  if (pct > 0) return "text-amber-400";
  if (pct < 0) return "text-gain";
  return "text-vela-muted";
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
      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-400">
        Trimmed
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 text-vela-muted">
      Closed
    </span>
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
    <div className="mt-4 pt-4 border-t border-vela-border space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
        Lesson
      </p>
      <textarea
        className="w-full bg-zinc-900 border border-vela-border rounded text-sm text-zinc-200 placeholder:text-zinc-600 px-3 py-2 resize-none focus:outline-none focus:border-vela-teal/50 transition-colors"
        rows={2}
        placeholder="What did this trade teach you?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="text-xs font-mono px-3 py-1.5 rounded bg-vela-teal/10 text-vela-teal border border-vela-teal/20 hover:bg-vela-teal/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save to thesis"}
        </button>
        {savedMsg && (
          <span className="text-xs text-zinc-500 font-mono">
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

  return (
    <div className="vela-card space-y-0">
      {/* Top: ticker + name + chip + link */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Link
            href={`/journey/${pos.ticker.toUpperCase()}`}
            className="font-mono text-base font-bold text-vela-teal hover:underline underline-offset-2 shrink-0"
          >
            {pos.ticker.toUpperCase()}
          </Link>
          <StatusChip pos={pos} />
          {pos.name && (
            <span className="text-xs text-zinc-500 truncate">{pos.name}</span>
          )}
        </div>
        <Link
          href={`/journey/${pos.ticker.toUpperCase()}`}
          className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
          aria-label={`View ${pos.ticker} journey`}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {/* Realized P&L */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Realized P&amp;L
          </p>
          <p
            className={`font-mono text-base font-semibold tabular-nums ${realizedPnlClass(pos.realized_pnl)}`}
          >
            {pnlArrow} {fmtPnlDollar(pos.realized_pnl)}
          </p>
          {pos.realized_pnl_pct !== null && (
            <p
              className={`font-mono text-xs tabular-nums ${realizedPnlClass(pos.realized_pnl)}`}
            >
              {fmtPct(pos.realized_pnl_pct)}
            </p>
          )}
        </div>

        {/* Since sold */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Since you sold
          </p>
          {pos.since_sold_pct !== null ? (
            <>
              <p
                className={`font-mono text-base font-semibold tabular-nums ${sinceSoldClass(pos.since_sold_pct)}`}
              >
                {fmtPct(pos.since_sold_pct)}
              </p>
              <p className="text-[10px] font-mono text-zinc-600">
                {sinceSoldTag(pos.since_sold_pct)}
              </p>
            </>
          ) : (
            <p className="font-mono text-base text-zinc-600 tabular-nums">--</p>
          )}
        </div>

        {/* Sold date + price */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Sold
          </p>
          <p className="font-mono text-sm text-zinc-300 tabular-nums">
            {formatDate(pos.last_sell_date)}
          </p>
          {pos.last_sell_price !== null && (
            <p className="font-mono text-xs text-zinc-500 tabular-nums">
              @ {formatCurrency(pos.last_sell_price)}
            </p>
          )}
        </div>

        {/* Proceeds */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Proceeds
          </p>
          <p className="font-mono text-sm text-zinc-300 tabular-nums">
            {formatCurrency(pos.total_proceeds)}
          </p>
          {pos.first_buy_date && (
            <p className="font-mono text-xs text-zinc-500 tabular-nums">
              held since {formatDate(pos.first_buy_date)}
            </p>
          )}
        </div>
      </div>

      {/* Lesson capture */}
      <LessonCapture pos={pos} onSaved={() => {}} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="vela-card flex flex-col items-center justify-center py-16 text-center gap-3">
      <Archive className="w-8 h-8 text-zinc-700 shrink-0" />
      <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
        No closed positions yet. When you sell, the post-mortem lands here.
      </p>
    </div>
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

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-zinc-500 shrink-0" />
          <h1 className="text-lg font-semibold text-zinc-100">
            Closed &amp; Lessons
          </h1>
        </div>
        <p className="text-sm text-zinc-500">
          Every position you have sold, and what happened after.
        </p>
      </div>

      {/* Position list or empty */}
      {positions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {positions.map((pos) => (
            <PositionRow key={pos.ticker} pos={pos} />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
