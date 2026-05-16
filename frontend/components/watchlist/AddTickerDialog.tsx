"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddTickerDialog({ open, onOpenChange, onSuccess }: Props) {
  const [ticker, setTicker] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed) {
      setError("Ticker is required");
      return;
    }

    setLoading(true);
    try {
      await api.post("/watchlist", {
        ticker: trimmed,
        notes: notes.trim() || undefined,
      });
      setTicker("");
      setNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add ticker";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-vela-card border border-vela-border rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-vela-border">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              Add to Watchlist
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Ticker */}
            <div>
              <label className="block text-sm text-zinc-400 font-medium mb-1.5">
                Ticker symbol
              </label>
              <input
                type="text"
                placeholder="NVDA"
                autoFocus
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-zinc-400 font-medium mb-1.5">
                Notes (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Watching for earnings dip"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
              />
            </div>

            {error && <p className="text-sm text-loss">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add to Watchlist
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
