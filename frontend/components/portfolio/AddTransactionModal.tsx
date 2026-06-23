"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Transaction, TransactionCreate } from "@/hooks/usePortfolio";

interface Props {
  portfolioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pass an existing transaction to open in edit mode */
  transaction?: Transaction | null;
}

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "reit", label: "REIT" },
  { value: "bond_etf", label: "Bond ETF" },
  { value: "crypto", label: "Crypto" },
] as const;

const INITIAL: TransactionCreate = {
  ticker: "",
  transaction_type: "buy",
  asset_type: "stock",
  quantity: 0,
  price: 0,
  fees: 0,
  currency: "USD",
  executed_at: new Date().toISOString().slice(0, 16),
  notes: "",
};

export default function AddTransactionModal({
  portfolioId,
  open,
  onOpenChange,
  onSuccess,
  transaction,
}: Props) {
  const isEdit = !!transaction;
  const [form, setForm] = useState<TransactionCreate>({ ...INITIAL });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price suggestion state
  const [priceFetching, setPriceFetching] = useState(false);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [userEditedPrice, setUserEditedPrice] = useState(false);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (transaction && open) {
      setForm({
        ticker: transaction.ticker,
        transaction_type: transaction.transaction_type,
        asset_type: transaction.asset_type || "stock",
        quantity: transaction.quantity,
        price: transaction.price,
        fees: transaction.fees,
        currency: transaction.currency,
        fx_rate: transaction.fx_rate,
        executed_at: new Date(transaction.executed_at).toISOString().slice(0, 16),
        notes: transaction.notes || "",
      });
      setUserEditedPrice(true); // don't auto-overwrite when editing existing
      setPriceHint(null);
    } else if (!transaction && open) {
      setForm({ ...INITIAL, executed_at: new Date().toISOString().slice(0, 16) });
      setUserEditedPrice(false);
      setPriceHint(null);
    }
  }, [transaction, open]);

  // Auto-fetch closing price when ticker + date change
  const fetchPrice = useCallback(async (ticker: string, dateStr: string) => {
    const trimmed = ticker.trim().toUpperCase();
    if (trimmed.length < 1 || !dateStr) return;

    const dateOnly = dateStr.slice(0, 10); // YYYY-MM-DD from datetime-local
    setPriceFetching(true);
    setPriceHint(null);
    try {
      const res = await api.get<{ ticker: string; date: string; price: number | null }>(
        `/markets/price/${trimmed}?on=${dateOnly}`
      );
      if (res.price !== null) {
        if (!userEditedPrice) {
          setForm((prev) => ({ ...prev, price: res.price! }));
        }
        setPriceHint(`Close on ${dateOnly}: $${res.price!.toFixed(2)}`);
      }
    } catch {
      // silently fail  - user can still type manually
    } finally {
      setPriceFetching(false);
    }
  }, [userEditedPrice]);

  // Debounce price fetch on ticker or date change
  useEffect(() => {
    if (!open) return;
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);

    fetchTimerRef.current = setTimeout(() => {
      if (form.ticker.trim().length >= 1 && form.executed_at) {
        fetchPrice(form.ticker, form.executed_at);
      }
    }, 600);

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [form.ticker, form.executed_at, open, fetchPrice]);

  function update<K extends keyof TransactionCreate>(key: K, value: TransactionCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePriceChange(value: string) {
    setUserEditedPrice(true);
    update("price", parseFloat(value) || 0);
  }

  function applyHintPrice() {
    if (!priceHint) return;
    const match = priceHint.match(/\$([0-9.]+)/);
    if (match) {
      update("price", parseFloat(match[1]));
      setUserEditedPrice(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.ticker.trim()) {
      setError("Ticker is required");
      return;
    }
    if (form.quantity <= 0) {
      setError("Quantity must be positive");
      return;
    }
    if (form.price <= 0) {
      setError("Price must be positive");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        ticker: form.ticker.toUpperCase().trim(),
        executed_at: new Date(form.executed_at).toISOString(),
      };

      if (isEdit) {
        await api.patch(`/portfolios/${portfolioId}/transactions/${transaction.id}`, payload);
      } else {
        await api.post(`/portfolios/${portfolioId}/transactions`, payload);
      }

      setForm({ ...INITIAL, executed_at: new Date().toISOString().slice(0, 16) });
      setUserEditedPrice(false);
      setPriceHint(null);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "add"} transaction`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-vela-card border border-vela-border rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-vela-border">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              {isEdit ? "Edit Transaction" : "Add Transaction"}
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(["buy", "sell", "dividend"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update("transaction_type", t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    form.transaction_type === t
                      ? t === "buy"
                        ? "bg-gain/15 text-gain"
                        : t === "sell"
                        ? "bg-loss/15 text-loss"
                        : "bg-vela-teal/15 text-vela-teal"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Ticker */}
            <div>
              <label className="block text-sm text-zinc-400 font-medium mb-1.5">Ticker</label>
              <input
                type="text"
                placeholder="AAPL"
                value={form.ticker}
                onChange={(e) => {
                  update("ticker", e.target.value);
                  setUserEditedPrice(false);
                }}
                className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
              />
            </div>

            {/* Quantity + Price row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 font-medium mb-1.5">Shares</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantity || ""}
                  onChange={(e) => update("quantity", parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 tabular placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm text-zinc-400 font-medium mb-1.5">
                  Price
                  {priceFetching && <Loader2 className="w-3 h-3 animate-spin text-vela-teal" />}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.price || ""}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 tabular placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
                {priceHint && (
                  <button
                    type="button"
                    onClick={applyHintPrice}
                    className="text-[11px] text-vela-teal hover:text-vela-teal-dim mt-1 transition-colors"
                  >
                    {priceHint}
                  </button>
                )}
              </div>
            </div>

            {/* Fees + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 font-medium mb-1.5">Fees</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.fees || ""}
                  onChange={(e) => update("fees", parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 tabular placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 font-medium mb-1.5">Date</label>
                <input
                  type="datetime-local"
                  value={form.executed_at}
                  onChange={(e) => {
                    update("executed_at", e.target.value);
                    setUserEditedPrice(false);
                  }}
                  className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Asset Type */}
            <div>
              <label className="block text-sm text-zinc-400 font-medium mb-1.5">Asset Type</label>
              <div className="flex gap-2 flex-wrap">
                {ASSET_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update("asset_type", t.value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      (form.asset_type || "stock") === t.value
                        ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-zinc-400 font-medium mb-1.5">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Earnings play"
                value={form.notes || ""}
                onChange={(e) => update("notes", e.target.value)}
                className="w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
              />
            </div>

            {/* Total preview */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-md">
              <span className="text-xs text-zinc-500">Total</span>
              <span className="text-sm font-medium text-zinc-100 tabular">
                ${((form.quantity || 0) * (form.price || 0) + (form.fees || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {error && (
              <p className="text-sm text-loss">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isEdit ? "Save Changes" : `Add ${form.transaction_type}`}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
