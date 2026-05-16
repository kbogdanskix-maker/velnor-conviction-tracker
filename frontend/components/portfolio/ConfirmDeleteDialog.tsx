"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatQuantity, formatDate } from "@/lib/formatters";
import type { Transaction } from "@/hooks/usePortfolio";

interface Props {
  portfolioId: string;
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function ConfirmDeleteDialog({
  portfolioId,
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!transaction) return;
    setError(null);
    setLoading(true);
    try {
      await api.delete(`/portfolios/${portfolioId}/transactions/${transaction.id}`);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete transaction";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!transaction) return null;

  const typeBadge =
    transaction.transaction_type === "buy"
      ? "bg-gain/15 text-gain"
      : transaction.transaction_type === "sell"
      ? "bg-loss/15 text-loss"
      : "bg-vela-teal/15 text-vela-teal";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-vela-card border border-vela-border rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-vela-border">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              Delete Transaction
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-zinc-400">
              Are you sure you want to delete this transaction? This action cannot be undone and will recalculate your holdings.
            </p>

            {/* Transaction summary */}
            <div className="bg-zinc-800/50 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-100">{transaction.ticker}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge}`}>
                  {transaction.transaction_type}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{formatQuantity(transaction.quantity)} shares @ {formatCurrency(transaction.price)}</span>
                <span>{formatDate(transaction.executed_at)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-loss/15 text-loss hover:bg-loss/25 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
