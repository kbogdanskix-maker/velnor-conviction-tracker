"use client";

import { useState } from "react";
import { Plus, Eye, Trash2, MoreHorizontal } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistItem } from "@/hooks/useWatchlist";
import AddTickerDialog from "@/components/watchlist/AddTickerDialog";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import { TopBar, PageHero, StatStrip, StatCell, Section, Eyebrow, Prose } from "@/components/instrument";

export default function WatchlistPage() {
  const { items, isLoading, mutate, isEmpty } = useWatchlist();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  async function handleRemove(ticker: string) {
    setDeleting(ticker);
    try {
      await api.delete(`/watchlist/${ticker}`);
      mutate();
    } catch {
      // silently fail  - SWR will re-fetch
    } finally {
      setDeleting(null);
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4 border-b border-vela-border pb-3 mb-7">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-3 w-24 hidden sm:block" />
        </div>
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-3 w-32 mt-3" />
        <div className="border-y border-vela-border divide-y divide-vela-border mt-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Derived figures ────────────────────────────────────────────────────────

  const quoted = items.filter((i) => i.day_change_pct != null);
  const avgMove = quoted.length
    ? quoted.reduce((sum, i) => sum + Number(i.day_change_pct), 0) / quoted.length
    : null;
  const advancing = quoted.filter((i) => Number(i.day_change_pct) > 0).length;
  const declining = quoted.filter((i) => Number(i.day_change_pct) < 0).length;
  const widest = quoted.length
    ? [...quoted].sort(
        (a, b) => Math.abs(Number(b.day_change_pct)) - Math.abs(Number(a.day_change_pct)),
      )[0]
    : null;
  const avgPositive = (avgMove ?? 0) >= 0;

  const addButton = (
    <button
      onClick={() => setDialogOpen(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded
        bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
        font-mono text-[10px] uppercase tracking-wider
        hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
    >
      <Plus className="w-3.5 h-3.5 shrink-0" />
      Add ticker
    </button>
  );

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Watchlist" }]}
        note={
          items.length
            ? `${items.length} ${items.length === 1 ? "ticker" : "tickers"} · quotes refresh each minute`
            : "nothing tracked yet"
        }
      />

      <PageHero
        title="Watchlist"
        meta="Names you are following, not holding"
        figure={avgMove != null ? formatPercent(avgMove) : undefined}
        figureSub={avgMove != null ? "average move today" : undefined}
        figureSubClass={avgPositive ? "text-gain" : "text-loss"}
      />

      {isEmpty ? (
        <EmptyWatchlist onAdd={() => setDialogOpen(true)} />
      ) : (
        <>
          <StatStrip className="mt-6">
            <StatCell
              label="Tracked"
              value={items.length}
              sub={`${quoted.length} quoted`}
            />
            <StatCell
              label="Advancing"
              value={advancing}
              valueClass={advancing > 0 ? "text-gain" : "text-zinc-100"}
              sub="up today"
            />
            <StatCell
              label="Declining"
              value={declining}
              valueClass={declining > 0 ? "text-loss" : "text-zinc-100"}
              sub="down today"
            />
            <StatCell
              label="Widest move"
              value={widest ? widest.ticker : "—"}
              sub={widest ? formatPercent(Number(widest.day_change_pct)) : "no quotes"}
              subClass={
                widest && Number(widest.day_change_pct) >= 0 ? "text-gain" : "text-loss"
              }
            />
          </StatStrip>

          <Section
            label="Tracked"
            labelAside={`— ${items.length}`}
            prose="Tap a ticker to open its quote detail. Removing a name here does not touch your positions."
            controls={addButton}
          >
            <div className="border-y border-vela-border divide-y divide-vela-border">
              {items.map((item) => (
                <WatchlistRow
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  onSelect={() => setSelectedTicker(item.ticker)}
                  isDeleting={deleting === item.ticker}
                />
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Add ticker dialog */}
      <AddTickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => mutate()}
      />

      {/* Ticker detail modal */}
      <TickerDetailModal
        ticker={selectedTicker}
        open={!!selectedTicker}
        onOpenChange={(open) => {
          if (!open) setSelectedTicker(null);
        }}
      />
    </PageTransition>
  );
}

// ── Watchlist row ────────────────────────────────────────────────────────────

function WatchlistRow({
  item,
  onRemove,
  onSelect,
  isDeleting,
}: {
  item: WatchlistItem;
  onRemove: (ticker: string) => void;
  onSelect: () => void;
  isDeleting: boolean;
}) {
  const changePct = Number(item.day_change_pct);
  const hasChange = item.day_change_pct != null && !Number.isNaN(changePct);
  const positive = changePct >= 0;

  return (
    <div
      onClick={onSelect}
      className="group flex items-center justify-between gap-4 py-3.5
        cursor-pointer transition-colors hover:bg-vela-teal/[0.03]"
    >
      {/* Left: ticker + optional notes */}
      <div className="min-w-0">
        <span className="font-mono text-[15px] font-medium tracking-wide text-zinc-100">
          {item.ticker}
        </span>
        {item.notes && (
          <p className="mt-1 text-[12.5px] leading-snug text-vela-body truncate">
            {item.notes}
          </p>
        )}
      </div>

      {/* Right: quote + row actions */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="font-mono text-[15px] tabular-nums text-zinc-100">
            {item.current_price != null ? formatCurrency(item.current_price) : "—"}
          </p>
          <p
            className={`mt-0.5 font-mono text-[12px] tabular-nums ${
              hasChange ? (positive ? "text-gain" : "text-loss") : "text-vela-muted"
            }`}
          >
            {hasChange ? `${positive ? "▲" : "▼"} ${formatPercent(Math.abs(changePct), false)}` : "—"}
          </p>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label={`Actions for ${item.ticker}`}
                className="p-1 rounded text-vela-subtle sm:opacity-0 sm:group-hover:opacity-100
                  hover:text-zinc-100 transition-all focus:outline-none focus:opacity-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="min-w-[140px] bg-vela-card border border-vela-border rounded z-50 py-1"
              >
                <DropdownMenu.Item
                  disabled={isDeleting}
                  onSelect={() => onRemove(item.ticker)}
                  className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wider
                    text-loss hover:bg-loss/10 cursor-pointer outline-none transition-colors
                    data-[disabled]:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  Remove
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyWatchlist({ onAdd }: { onAdd: () => void }) {
  return (
    <Section label="Tracked" labelAside="— empty">
      <div className="border border-vela-border px-6 py-14 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded border border-vela-border flex items-center justify-center mb-4">
          <Eye className="w-4 h-4 text-vela-teal" />
        </div>
        <Eyebrow>No tickers yet</Eyebrow>
        <Prose className="mt-2.5 max-w-[340px]">
          Add tickers to follow their price and daily move without opening a position.
        </Prose>
        <button
          onClick={onAdd}
          className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded
            bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
            font-mono text-[10px] uppercase tracking-wider
            hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          Add your first ticker
        </button>
      </div>
    </Section>
  );
}
