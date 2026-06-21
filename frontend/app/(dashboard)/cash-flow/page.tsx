"use client";

import { useState, useMemo } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, DollarSign, Plus, Pencil, Trash2,
  PiggyBank, MoreHorizontal, TrendingUp, Download,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  useCashFlowSummary,
  cfCategoryLabel,
  categoriesForType,
  type CashFlowEntry,
  type CashFlowEntryCreate,
} from "@/hooks/useCashFlow";
import { api } from "@/lib/api";
import { exportCSV } from "@/lib/export";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import GoalsStrip from "@/components/shared/GoalsStrip";

// ── Page ────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const { summary, entries, isLoading, mutate } = useCashFlowSummary();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CashFlowEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashFlowEntry | null>(null);

  const income = useMemo(() => entries.filter((e) => e.entry_type === "income"), [entries]);
  const fixed = useMemo(() => entries.filter((e) => e.entry_type === "fixed_expense"), [entries]);
  const variable = useMemo(() => entries.filter((e) => e.entry_type === "variable_expense"), [entries]);

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(e: CashFlowEntry) { setEditing(e); setModalOpen(true); }

  async function handleDelete() {
    if (!deleteTarget) return;
    await api.delete(`/cash-flow/entries/${deleteTarget.id}`);
    setDeleteTarget(null);
    mutate();
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const savingsRate = summary?.savings_rate ?? 0;
  const savingsColor = savingsRate >= 20 ? "text-gain" : savingsRate >= 0 ? "text-vela-teal" : "text-loss";

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-vela-teal" />
            Cash Flow
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Monthly income, expenses & savings rate</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() =>
                exportCSV(
                  entries.map((e) => ({
                    Name: e.name,
                    Type: e.entry_type === "income" ? "Income" : e.entry_type === "fixed_expense" ? "Fixed Expense" : "Variable Expense",
                    Category: cfCategoryLabel(e.category),
                    "Monthly Amount": e.amount,
                    Notes: e.notes ?? "",
                  })),
                  `velnor-cashflow-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          <button onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Income" value={summary?.total_income ?? 0} icon={<ArrowDownCircle className="w-4 h-4" />} color="text-gain" />
        <SummaryCard label="Fixed Expenses" value={summary?.total_fixed ?? 0} icon={<ArrowUpCircle className="w-4 h-4" />} color="text-loss" negative />
        <SummaryCard label="Variable Expenses" value={summary?.total_variable ?? 0} icon={<ArrowUpCircle className="w-4 h-4" />} color="text-loss" negative />
        <div className="vela-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <p className="text-xs text-zinc-500">Monthly Savings</p>
          </div>
          <AnimatedNumber
            value={summary?.savings ?? 0}
            format={(n) => formatCurrency(n)}
            className={`text-lg font-bold tabular ${savingsColor}`}
          />
          <p className={`text-xs font-medium tabular mt-0.5 ${savingsColor}`}>
            <AnimatedNumber
              value={savingsRate}
              format={(n) => formatPercent(n, false)}
              className=""
            />{" "}savings rate
          </p>
        </div>
      </div>

      {/* Goals in context — how much of your saving funds your goals */}
      <RevealOnScroll>
        <GoalsStrip monthlySavings={summary?.savings} />
      </RevealOnScroll>

      {/* Savings rate bar */}
      {(summary?.total_income ?? 0) > 0 && (
        <RevealOnScroll>
        <div className="vela-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-300">Budget Breakdown</p>
            <p className="text-xs text-zinc-500">
              {formatCurrency(summary?.total_expenses ?? 0)} of {formatCurrency(summary?.total_income ?? 0)}
            </p>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex">
            {(summary?.total_fixed ?? 0) > 0 && (
              <div
                className="bg-rose-500 h-full"
                style={{ width: `${((summary?.total_fixed ?? 0) / (summary?.total_income ?? 1)) * 100}%` }}
              />
            )}
            {(summary?.total_variable ?? 0) > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${((summary?.total_variable ?? 0) / (summary?.total_income ?? 1)) * 100}%` }}
              />
            )}
            {(summary?.savings ?? 0) > 0 && (
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${((summary?.savings ?? 0) / (summary?.total_income ?? 1)) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Fixed</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Variable</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Savings</span>
          </div>
        </div>
        </RevealOnScroll>
      )}

      {/* Entry sections */}
      <RevealOnScroll delay={0.1}>
      <EntrySection title="Income" icon={<TrendingUp className="w-4 h-4" />} entries={income} onEdit={openEdit} onDelete={setDeleteTarget} color="gain" />
      <EntrySection title="Fixed Expenses" icon={<ArrowUpCircle className="w-4 h-4" />} entries={fixed} onEdit={openEdit} onDelete={setDeleteTarget} color="loss" />
      <EntrySection title="Variable Expenses" icon={<ArrowUpCircle className="w-4 h-4" />} entries={variable} onEdit={openEdit} onDelete={setDeleteTarget} color="amber" />

      {entries.length === 0 && (
        <div className="vela-card text-center py-16">
          <DollarSign className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-200 mb-1">No cash flow entries yet</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Add your monthly income and expenses to track your savings rate
          </p>
          <button onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add first entry
          </button>
        </div>
      )}
      </RevealOnScroll>

      {/* Add / Edit Modal */}
      <AddEntryModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSaved={mutate}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        entry={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </PageTransition>
    </TierGate>
  );
}


// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color, negative }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  negative?: boolean;
}) {
  return (
    <div className="vela-card">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
          {icon}
        </div>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
      <AnimatedNumber
        value={value}
        format={(n) => `${negative && n > 0 ? "-" : ""}${formatCurrency(n)}`}
        className={`text-lg font-bold tabular ${color}`}
      />
    </div>
  );
}


// ── Entry Section ───────────────────────────────────────────────────────────

function EntrySection({ title, icon, entries, onEdit, onDelete, color }: {
  title: string;
  icon: React.ReactNode;
  entries: CashFlowEntry[];
  onEdit: (e: CashFlowEntry) => void;
  onDelete: (e: CashFlowEntry) => void;
  color: "gain" | "loss" | "amber";
}) {
  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);
  const colorClass = color === "gain" ? "text-gain" : color === "loss" ? "text-loss" : "text-amber-400";

  return (
    <div className="vela-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            {icon}
          </div>
          <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        </div>
        <p className={`text-sm font-bold tabular ${colorClass}`}>{formatCurrency(total)}/mo</p>
      </div>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between py-2 border-b border-vela-border last:border-0">
            <div>
              <p className="text-sm font-medium text-zinc-200">{e.name}</p>
              <p className="text-xs text-zinc-500">{cfCategoryLabel(e.category)}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold tabular ${colorClass}`}>{formatCurrency(e.amount)}</p>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[140px] bg-zinc-900 border border-vela-border rounded-lg p-1 shadow-xl z-50"
                    sideOffset={4}
                    align="end"
                  >
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 outline-none"
                      onSelect={() => onEdit(e)}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-loss rounded-md cursor-pointer hover:bg-zinc-800 outline-none"
                      onSelect={() => onDelete(e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Add / Edit Modal ────────────────────────────────────────────────────────

function AddEntryModal({ open, onClose, editing, onSaved }: {
  open: boolean;
  onClose: () => void;
  editing: CashFlowEntry | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [entryType, setEntryType] = useState<"income" | "fixed_expense" | "variable_expense">("income");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate on edit
  const populateForm = () => {
    if (editing) {
      setName(editing.name);
      setEntryType(editing.entry_type);
      setCategory(editing.category);
      setAmount(String(editing.amount));
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setEntryType("income");
      setCategory("salary");
      setAmount("");
      setNotes("");
    }
  };

  const categories = categoriesForType(entryType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: CashFlowEntryCreate = {
        name,
        entry_type: entryType,
        category: category || categories[0].value,
        amount: Number(amount),
        notes: notes || null,
      };
      if (editing) {
        await api.patch(`/cash-flow/entries/${editing.id}`, body);
      } else {
        await api.post("/cash-flow/entries", body);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          onOpenAutoFocus={populateForm}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-zinc-900 border border-vela-border rounded-xl p-6 shadow-xl"
        >
          <Dialog.Title className="text-lg font-semibold text-zinc-100 mb-4">
            {editing ? "Edit Entry" : "Add Cash Flow Entry"}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Type</label>
              <select
                value={entryType}
                onChange={(e) => {
                  const t = e.target.value as typeof entryType;
                  setEntryType(t);
                  setCategory(categoriesForType(t)[0].value);
                }}
                className="input-field w-full"
              >
                <option value="income">Income</option>
                <option value="fixed_expense">Fixed Expense</option>
                <option value="variable_expense">Variable Expense</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={entryType === "income" ? "e.g. Salary" : "e.g. Rent"}
                required
                className="input-field w-full"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field w-full"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Monthly Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
                className="input-field w-full tabular"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="input-field w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button type="submit" disabled={saving || !name || !amount} className="btn-primary text-sm">
                {saving ? "Saving…" : editing ? "Save" : "Add"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


// ── Confirm Delete ──────────────────────────────────────────────────────────

function ConfirmDeleteDialog({ entry, onClose, onConfirm }: {
  entry: CashFlowEntry | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog.Root open={!!entry} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-zinc-900 border border-vela-border rounded-xl p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-zinc-100 mb-2">
            Delete Entry
          </Dialog.Title>
          <p className="text-sm text-zinc-400 mb-4">
            Remove <span className="font-medium text-zinc-200">{entry?.name}</span> ({formatCurrency(entry?.amount ?? 0)}/mo)?
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="bg-loss hover:bg-loss/80 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
