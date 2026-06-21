"use client";

import { useState, useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
} from "lucide-react";
import { formatCurrency, formatQuantity, formatDate } from "@/lib/formatters";
import { useTransactions } from "@/hooks/usePortfolio";
import type { Transaction } from "@/hooks/usePortfolio";
import AddTransactionModal from "./AddTransactionModal";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

interface Props {
  portfolioId: string;
  onMutate: () => void;
}

/* ── Natural language label per transaction ──────────────────────────────── */

function txLabel(tx: Transaction): { verb: string; icon: typeof ArrowDownLeft } {
  switch (tx.transaction_type) {
    case "buy":
      return { verb: "Bought", icon: ArrowDownLeft };
    case "sell":
      return { verb: "Sold", icon: ArrowUpRight };
    case "dividend":
      return { verb: "Dividend from", icon: Banknote };
    default:
      return { verb: tx.transaction_type, icon: ArrowDownLeft };
  }
}

function txBadgeClass(type: string): string {
  switch (type) {
    case "buy":
      return "bg-gain/15 text-gain";
    case "sell":
      return "bg-loss/15 text-loss";
    case "dividend":
      return "bg-vela-teal/15 text-vela-teal";
    default:
      return "bg-zinc-700/50 text-zinc-400";
  }
}

/* ── Group transactions by date ──────────────────────────────────────────── */

function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const sorted = [...txs].sort(
    (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime(),
  );

  const groups: { date: string; items: Transaction[] }[] = [];
  let current: string | null = null;

  for (const tx of sorted) {
    const d = tx.executed_at.slice(0, 10); // "YYYY-MM-DD"
    if (d !== current) {
      groups.push({ date: d, items: [tx] });
      current = d;
    } else {
      groups[groups.length - 1].items.push(tx);
    }
  }

  return groups;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function TransactionsTable({ portfolioId, onMutate }: Props) {
  const { data: transactions, mutate: mutateTransactions } =
    useTransactions(portfolioId);

  // Edit state
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete state
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const groups = useMemo(
    () => groupByDate(transactions ?? []),
    [transactions],
  );

  function handleEditSuccess() {
    mutateTransactions();
    onMutate();
  }

  function handleDeleteSuccess() {
    mutateTransactions();
    onMutate();
  }

  if (!transactions || transactions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date}>
            {/* Date heading */}
            <p className="text-xs text-zinc-500 font-medium mb-2">
              {formatDate(group.date)}
            </p>

            {/* Entries for this date */}
            <div className="space-y-2">
              {group.items.map((tx) => (
                <TimelineRow
                  key={tx.id}
                  tx={tx}
                  onEdit={() => {
                    setEditTx(tx);
                    setEditOpen(true);
                  }}
                  onDelete={() => {
                    setDeleteTx(tx);
                    setDeleteOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <AddTransactionModal
        portfolioId={portfolioId}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleEditSuccess}
        transaction={editTx}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        portfolioId={portfolioId}
        transaction={deleteTx}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}

/* ── Single Timeline Row ─────────────────────────────────────────────────── */

function TimelineRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { verb, icon: Icon } = txLabel(tx);
  const total = Number(tx.quantity) * Number(tx.price) + Number(tx.fees);

  return (
    <div className="vela-card flex items-center gap-3 group">
      {/* Icon badge */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${txBadgeClass(tx.transaction_type)}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100">
          <span className="font-medium">{verb}</span>{" "}
          <span className="tabular">{formatQuantity(tx.quantity)}</span>{" "}
          <span className="font-semibold">{tx.ticker}</span>{" "}
          <span className="text-zinc-500">@</span>{" "}
          <span className="tabular">{formatCurrency(tx.price)}</span>
        </p>
        {tx.notes && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{tx.notes}</p>
        )}
      </div>

      {/* Total + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm tabular font-medium text-zinc-100">
          {formatCurrency(total)}
        </span>

        {/* ⋯ dropdown  - visible on hover */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1 rounded-md text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-100 hover:bg-zinc-800 transition-all focus:outline-none focus:opacity-100">
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
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer outline-none transition-colors"
                onSelect={onEdit}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-vela-border my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-loss hover:bg-loss/10 cursor-pointer outline-none transition-colors"
                onSelect={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
