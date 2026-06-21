"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus, X, Loader2, Wallet, TrendingUp, TrendingDown,
  Building2, CreditCard, PiggyBank, Landmark, Car, Home,
  Briefcase, Shield, Coins, CircleDollarSign, MoreHorizontal, Pencil, Trash2, Download,
} from "lucide-react";
import { exportCSV } from "@/lib/export";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  useNetWorthAssets,
  useNetWorthSummary,
  categoryLabel,
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  type NetWorthAsset,
  type NetWorthAssetCreate,
} from "@/hooks/useNetWorth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import GoalsStrip from "@/components/shared/GoalsStrip";

// ── Category icon map ───────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  checking: Wallet,
  savings: PiggyBank,
  hysa: PiggyBank,
  money_market: CircleDollarSign,
  cd: Landmark,
  real_estate: Home,
  vehicle: Car,
  business: Briefcase,
  retirement_401k: Shield,
  ira: Shield,
  hsa: Shield,
  crypto: Coins,
  other_asset: TrendingUp,
  credit_card: CreditCard,
  student_loan: Building2,
  auto_loan: Car,
  mortgage: Home,
  personal_loan: CircleDollarSign,
  medical_debt: Building2,
  other_debt: TrendingDown,
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { assets, isLoading, mutate } = useNetWorthAssets();
  const { summary, mutate: mutateSummary } = useNetWorthSummary();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<NetWorthAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NetWorthAsset | null>(null);

  const userAssets = useMemo(() => assets.filter((a) => !a.is_liability), [assets]);
  const userLiabilities = useMemo(() => assets.filter((a) => a.is_liability), [assets]);

  const refresh = () => { mutate(); mutateSummary(); };

  if (isLoading) return <NetWorthSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100">Net Worth</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Your complete financial picture
          </p>
        </div>
        <div className="flex items-center gap-2">
          {assets && assets.length > 0 && (
            <button
              onClick={() =>
                exportCSV(
                  assets.map((a) => ({
                    Name: a.name,
                    Category: categoryLabel(a.category),
                    Type: a.is_liability ? "Liability" : "Asset",
                    Value: a.value,
                    Currency: a.currency,
                  })),
                  `velnor-net-worth-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          <button
            onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Net Worth"
            value={summary.net_worth}
            accent
          />
          <SummaryCard
            label="Total Assets"
            value={summary.total_assets}
            sub={`Portfolio: ${formatCurrency(summary.portfolio_value, "USD", true)}`}
          />
          <SummaryCard
            label="Total Liabilities"
            value={summary.total_liabilities}
            negative
          />
          <SummaryCard
            label="Portfolio Value"
            value={summary.portfolio_value}
            sub="Live from holdings"
          />
        </div>
      )}

      {/* Goals in context */}
      <GoalsStrip />

      {/* Assets Section */}
      <section className="space-y-3">
        <h2 className="section-heading">Assets</h2>
        {userAssets.length === 0 ? (
          <div className="vela-card text-center py-8">
            <PiggyBank className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No assets added yet</p>
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="text-xs text-vela-teal mt-2 hover:text-vela-teal-dim transition-colors"
            >
              Add your first account →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {userAssets.map((a) => (
              <AccountCard
                key={a.id}
                item={a}
                onEdit={() => { setEditItem(a); setModalOpen(true); }}
                onDelete={() => setDeleteTarget(a)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Liabilities Section */}
      <section className="space-y-3">
        <h2 className="section-heading">Liabilities</h2>
        {userLiabilities.length === 0 ? (
          <div className="vela-card text-center py-8">
            <CreditCard className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No liabilities  - nice!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {userLiabilities.map((a) => (
              <AccountCard
                key={a.id}
                item={a}
                onEdit={() => { setEditItem(a); setModalOpen(true); }}
                onDelete={() => setDeleteTarget(a)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Portfolio note */}
      <div className="vela-card flex items-center gap-3 text-sm text-zinc-400">
        <TrendingUp className="w-4 h-4 text-vela-teal shrink-0" />
        <span>
          Your investment portfolio ({formatCurrency(summary?.portfolio_value)}) is automatically included in assets from your{" "}
          <Link href="/portfolio" className="text-vela-teal hover:text-vela-teal-dim transition-colors">
            holdings
          </Link>.
        </span>
      </div>

      {/* Add/Edit Modal */}
      <AddAccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={refresh}
        editItem={editItem}
      />

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        item={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onSuccess={refresh}
      />
    </PageTransition>
  );
}


// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent,
  negative,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="vela-card">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <AnimatedNumber
        value={value}
        format={(n) => formatCurrency(n)}
        className={`text-lg sm:text-xl font-bold tabular truncate ${
          accent
            ? value < 0 ? "text-loss" : "text-vela-teal"
            : negative ? "text-loss" : "text-zinc-100"
        }`}
      />
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}


// ── Account Card ────────────────────────────────────────────────────────────

function AccountCard({
  item,
  onEdit,
  onDelete,
}: {
  item: NetWorthAsset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = ICON_MAP[item.category] ?? Wallet;

  return (
    <div className="vela-card group relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              item.is_liability ? "bg-loss/10" : "bg-vela-teal/10"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                item.is_liability ? "text-loss" : "text-vela-teal"
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100 truncate max-w-[160px] sm:max-w-none">{item.name}</p>
            <p className="text-xs text-zinc-500">{categoryLabel(item.category)}</p>
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1 rounded hover:bg-zinc-800 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4 text-zinc-500" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-zinc-900 border border-vela-border rounded-lg p-1 shadow-xl min-w-[120px] z-50"
              sideOffset={4}
              align="end"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 rounded hover:bg-zinc-800 cursor-pointer outline-none"
                onClick={onEdit}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-loss rounded hover:bg-zinc-800 cursor-pointer outline-none"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Value */}
      <p
        className={`text-lg font-bold tabular mt-3 ${
          item.is_liability ? "text-loss" : "text-zinc-100"
        }`}
      >
        {item.is_liability ? "-" : ""}{formatCurrency(item.value)}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500">
        {item.institution && <span className="truncate max-w-[140px]">{item.institution}</span>}
        {item.interest_rate != null && (
          <span className={item.is_liability ? "text-loss/80" : "text-gain/80"}>
            {Number(item.interest_rate).toFixed(2)}% {item.is_liability ? "APR" : "APY"}
          </span>
        )}
        {item.minimum_payment != null && item.is_liability && (
          <span>{formatCurrency(item.minimum_payment)}/mo min</span>
        )}
      </div>
    </div>
  );
}


// ── Add/Edit Modal ──────────────────────────────────────────────────────────

function AddAccountModal({
  open,
  onOpenChange,
  onSuccess,
  editItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem: NetWorthAsset | null;
}) {
  const isEdit = !!editItem;
  const [saving, setSaving] = useState(false);
  const [isLiability, setIsLiability] = useState(editItem?.is_liability ?? false);

  // Form fields
  const [name, setName] = useState(editItem?.name ?? "");
  const [category, setCategory] = useState(editItem?.category ?? "checking");
  const [value, setValue] = useState(editItem?.value?.toString() ?? "");
  const [institution, setInstitution] = useState(editItem?.institution ?? "");
  const [interestRate, setInterestRate] = useState(
    editItem?.interest_rate != null ? editItem.interest_rate.toString() : "",
  );
  const [minimumPayment, setMinimumPayment] = useState(
    editItem?.minimum_payment != null ? editItem.minimum_payment.toString() : "",
  );
  const [notes, setNotes] = useState(editItem?.notes ?? "");

  // Reset on open change
  const handleOpenChange = (v: boolean) => {
    if (v && !isEdit) {
      setIsLiability(false);
      setName("");
      setCategory("checking");
      setValue("");
      setInstitution("");
      setInterestRate("");
      setMinimumPayment("");
      setNotes("");
    }
    if (v && isEdit && editItem) {
      setIsLiability(editItem.is_liability);
      setName(editItem.name);
      setCategory(editItem.category);
      setValue(editItem.value.toString());
      setInstitution(editItem.institution ?? "");
      setInterestRate(editItem.interest_rate != null ? editItem.interest_rate.toString() : "");
      setMinimumPayment(editItem.minimum_payment != null ? editItem.minimum_payment.toString() : "");
      setNotes(editItem.notes ?? "");
    }
    onOpenChange(v);
  };

  const categories = isLiability ? LIABILITY_CATEGORIES : ASSET_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: NetWorthAssetCreate = {
        name: name.trim(),
        category,
        value: Number(value),
        is_liability: isLiability,
        institution: institution.trim() || null,
        interest_rate: interestRate ? Number(interestRate) : null,
        minimum_payment: minimumPayment ? Number(minimumPayment) : null,
        notes: notes.trim() || null,
        as_of_date: new Date().toISOString().slice(0, 10),
      };

      if (isEdit && editItem) {
        await api.patch(`/net-worth/assets/${editItem.id}`, body);
      } else {
        await api.post("/net-worth/assets", body);
      }
      onSuccess();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-vela-border rounded-xl p-6 z-50 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-zinc-100">
              {isEdit ? "Edit account" : "Add account"}
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-300">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Asset / Liability toggle */}
          {!isEdit && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setIsLiability(false); setCategory("checking"); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isLiability
                    ? "bg-vela-teal/15 text-vela-teal"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Asset
              </button>
              <button
                type="button"
                onClick={() => { setIsLiability(true); setCategory("credit_card"); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLiability
                    ? "bg-loss/15 text-loss"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Liability
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isLiability ? "e.g. Chase Sapphire" : "e.g. Ally Savings"}
                className="input-field w-full"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field w-full"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                {isLiability ? "Balance owed" : "Current value"}
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="input-field w-full tabular"
              />
            </div>

            {/* Institution */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                {isLiability ? "Lender" : "Institution"} (optional)
              </label>
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={isLiability ? "e.g. SoFi" : "e.g. Ally Bank"}
                className="input-field w-full"
              />
            </div>

            {/* Interest Rate */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                {isLiability ? "APR %" : "APY %"} (optional)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0.00"
                className="input-field w-full tabular"
              />
            </div>

            {/* Minimum Payment (liabilities only) */}
            {isLiability && (
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  Minimum monthly payment (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimumPayment}
                  onChange={(e) => setMinimumPayment(e.target.value)}
                  placeholder="0.00"
                  className="input-field w-full tabular"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field w-full resize-none"
                placeholder="Any details..."
              />
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim() || !value}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                "Save changes"
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {isLiability ? "Add liability" : "Add asset"}
                </>
              )}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


// ── Delete Confirm ──────────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  item,
  open,
  onOpenChange,
  onSuccess,
}: {
  item: NetWorthAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      await api.delete(`/net-worth/assets/${item.id}`);
      onSuccess();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-zinc-900 border border-vela-border rounded-xl p-6 z-50">
          <Dialog.Title className="text-lg font-semibold text-zinc-100 mb-2">
            Delete {item?.is_liability ? "liability" : "asset"}?
          </Dialog.Title>
          <p className="text-sm text-zinc-400 mb-1">
            <span className="font-medium text-zinc-200">{item?.name}</span>{" "}
             - {formatCurrency(item?.value)}
          </p>
          <p className="text-xs text-zinc-500 mb-5">
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Dialog.Close className="flex-1 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg bg-loss/15 text-loss text-sm font-medium hover:bg-loss/25 transition-colors flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


// ── Loading skeleton ────────────────────────────────────────────────────────

function NetWorthSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="vela-card">
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="skeleton h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="skeleton h-4 w-16" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="vela-card">
            <div className="skeleton h-4 w-32 mb-3" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
