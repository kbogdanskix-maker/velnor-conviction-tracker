"use client";

import { useState } from "react";
import { Plus, Eye, Trash2, MoreHorizontal } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistItem } from "@/hooks/useWatchlist";
import AddTickerDialog from "@/components/watchlist/AddTickerDialog";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent, changePillClass } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";

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
      // silently fail — SWR will re-fetch
    } finally {
      setDeleting(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-32" />
            <div className="skeleton h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="vela-card">
              <div className="skeleton h-4 w-16 mb-2" />
              <div className="skeleton h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Watchlist</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {items.length} ticker{items.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add ticker
        </button>
      </div>

      {/* Content */}
      {isEmpty ? (
        <EmptyWatchlist onAdd={() => setDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              onSelect={() => setSelectedTicker(item.ticker)}
              isDeleting={deleting === item.ticker}
            />
          ))}
        </div>
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

// ── Watchlist Card ─────────────────────────────────────────────────────────

function WatchlistCard({
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

  return (
    <div
      onClick={onSelect}
      className="vela-card flex items-center justify-between cursor-pointer hover:border-zinc-600 transition-colors group"
    >
      {/* Left: ticker + optional notes */}
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-zinc-100">
            {item.ticker}
          </span>
          <span className={changePillClass(changePct)}>
            {item.day_change_pct != null ? formatPercent(changePct) : "—"}
          </span>
        </div>
        <p className="text-sm text-zinc-400 tabular">
          {item.current_price != null ? formatCurrency(item.current_price) : "—"}
          {item.notes && (
            <span className="text-zinc-500 ml-2 truncate">· {item.notes}</span>
          )}
        </p>
      </div>

      {/* Right: actions (visible on hover) */}
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1 rounded-md text-zinc-600 sm:opacity-0 sm:group-hover:opacity-100 hover:text-zinc-100 hover:bg-zinc-800 transition-all focus:outline-none focus:opacity-100">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="min-w-[140px] bg-vela-card border border-vela-border rounded-md shadow-xl z-50 py-1 animate-in fade-in-0 zoom-in-95"
            >
              <DropdownMenu.Item
                disabled={isDeleting}
                onSelect={() => onRemove(item.ticker)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-loss hover:bg-loss/10 cursor-pointer outline-none transition-colors data-[disabled]:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyWatchlist({ onAdd }: { onAdd: () => void }) {
  return (
    <FloatingCard glowColor="rgba(99, 102, 241, 0.10)">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-vela-teal/10 flex items-center justify-center mb-4">
          <Eye className="w-6 h-6 text-vela-teal" />
        </div>
        <h3 className="text-lg font-medium text-zinc-100 mb-1">No tickers yet</h3>
        <p className="text-sm text-zinc-500 mb-6 max-w-xs">
          Add tickers to your watchlist to track prices and daily moves in real time.
        </p>
        <button onClick={onAdd} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add your first ticker
        </button>
      </div>
    </FloatingCard>
  );
}
