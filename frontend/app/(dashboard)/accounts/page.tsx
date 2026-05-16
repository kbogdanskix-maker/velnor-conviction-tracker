"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useCloudStore } from "@/hooks/useCloudStore";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Plus, X, Building2, Landmark, Wallet, CreditCard, Briefcase, PiggyBank,
  TrendingUp, Edit2, Trash2, CheckCircle2, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

/* ── types ──────────────────────────────────────────────────── */

interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  notes?: string;
  linkedPortfolio?: boolean; // true = pulls from portfolio hook
}

type AccountType = "brokerage" | "retirement" | "savings" | "checking" | "crypto" | "other";

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: typeof Building2; color: string }[] = [
  { value: "brokerage", label: "Brokerage", icon: TrendingUp, color: "#14b8a6" },
  { value: "retirement", label: "Retirement", icon: Landmark, color: "#8b5cf6" },
  { value: "savings", label: "Savings", icon: PiggyBank, color: "#34d399" },
  { value: "checking", label: "Checking", icon: Wallet, color: "#38bdf8" },
  { value: "crypto", label: "Crypto", icon: CreditCard, color: "#f59e0b" },
  { value: "other", label: "Other", icon: Briefcase, color: "#a1a1aa" },
];

const TYPE_MAP = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t]));

/* ── component ──────────────────────────────────────────────── */

export default function AccountsPage() {
  const { data: accounts, save, isLoading } = useCloudStore<Account[]>("accounts");
  const { summary } = useDefaultPortfolio();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const synced = useRef(false);

  // Sync cloud data on first load
  useEffect(() => {
    if (!isLoading && accounts && !synced.current) {
      synced.current = true;
    }
  }, [isLoading, accounts]);

  // Add portfolio-linked account value
  const enrichedAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((a) => {
      if (a.linkedPortfolio && summary) {
        return { ...a, balance: summary.total_value ?? a.balance };
      }
      return a;
    });
  }, [accounts, summary]);

  const totalBalance = enrichedAccounts.reduce((s, a) => s + a.balance, 0);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedAccounts.forEach((a) => {
      map[a.type] = (map[a.type] || 0) + a.balance;
    });
    return ACCOUNT_TYPES
      .filter((t) => map[t.value])
      .map((t) => ({ name: t.label, value: map[t.value], color: t.color }));
  }, [enrichedAccounts]);

  function handleSave(account: Account) {
    const list = accounts || [];
    const exists = list.find((a) => a.id === account.id);
    const updated = exists
      ? list.map((a) => (a.id === account.id ? account : a))
      : [...list, account];
    save(updated);
    setShowAdd(false);
    setEditId(null);
  }

  function handleDelete(id: string) {
    save((accounts || []).filter((a) => a.id !== id));
  }

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100">Accounts</h1>
            <p className="text-zinc-400 text-sm mt-1">All your financial accounts in one view</p>
          </div>
          <button
            onClick={() => { setEditId(null); setShowAdd(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vela-teal/15 text-vela-teal text-sm font-medium hover:bg-vela-teal/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>

        {/* ── Summary Row ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FloatingCard delay={0}>
            <div className="p-5">
              <p className="text-xs text-zinc-400 font-medium mb-2">TOTAL BALANCE</p>
              <p className="text-3xl font-display font-bold text-zinc-100 tabular-nums">{formatCurrency(totalBalance)}</p>
              <p className="text-xs text-zinc-500 mt-1">{enrichedAccounts.length} account{enrichedAccounts.length !== 1 ? "s" : ""}</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.1}>
            <div className="p-5">
              <p className="text-xs text-zinc-400 font-medium mb-2">INVESTMENT ACCOUNTS</p>
              <p className="text-2xl font-display font-bold text-teal-400 tabular-nums">
                {formatCurrency(enrichedAccounts.filter((a) => a.type === "brokerage" || a.type === "retirement").reduce((s, a) => s + a.balance, 0))}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Brokerage + Retirement</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.2}>
            <div className="p-5">
              <p className="text-xs text-zinc-400 font-medium mb-2">CASH ACCOUNTS</p>
              <p className="text-2xl font-display font-bold text-sky-400 tabular-nums">
                {formatCurrency(enrichedAccounts.filter((a) => a.type === "savings" || a.type === "checking").reduce((s, a) => s + a.balance, 0))}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Savings + Checking</p>
            </div>
          </FloatingCard>
        </div>

        {/* ── Allocation Chart + Account List ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie */}
          {byType.length > 0 && (
            <RevealOnScroll>
              <FloatingCard delay={0.3}>
                <div className="p-5">
                  <h2 className="font-display font-semibold text-zinc-100 mb-4">By Type</h2>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byType}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          dataKey="value" nameKey="name"
                          stroke="none"
                        >
                          {byType.map((d, i) => (
                            <Cell key={i} fill={d.color} fillOpacity={0.85} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                          formatter={(v: number) => [formatCurrency(v), ""]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {byType.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              </FloatingCard>
            </RevealOnScroll>
          )}

          {/* Account List */}
          <div className={`${byType.length > 0 ? "lg:col-span-2" : "lg:col-span-3"} space-y-3`}>
            {enrichedAccounts.length === 0 && !showAdd ? (
              <FloatingCard delay={0.4}>
                <div className="text-center py-16 text-zinc-400">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium text-zinc-300 mb-1">No accounts added</p>
                  <p className="mb-4">Track all your financial accounts in one place.</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="px-4 py-2 rounded-lg bg-vela-teal/15 text-vela-teal text-sm font-medium hover:bg-vela-teal/25 transition-colors"
                  >
                    Add Your First Account
                  </button>
                </div>
              </FloatingCard>
            ) : (
              enrichedAccounts.map((account, i) => {
                const typeInfo = TYPE_MAP[account.type] || TYPE_MAP.other;
                const Icon = typeInfo.icon;
                const pctOfTotal = totalBalance > 0 ? (account.balance / totalBalance) * 100 : 0;

                return (
                  <RevealOnScroll key={account.id}>
                    <FloatingCard delay={0.4 + i * 0.05}>
                      <div className="p-4 flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${typeInfo.color}15` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-100 truncate">{account.name}</p>
                            {account.linkedPortfolio && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-vela-teal/10 text-vela-teal/70">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{account.institution} · {typeInfo.label}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-zinc-100 tabular-nums">{formatCurrency(account.balance)}</p>
                          <p className="text-xs text-zinc-500 tabular-nums">{pctOfTotal.toFixed(1)}%</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditId(account.id); setShowAdd(true); }}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </FloatingCard>
                  </RevealOnScroll>
                );
              })
            )}
          </div>
        </div>

        {/* ── Add/Edit Modal ──────────────────────────────────── */}
        {showAdd && (
          <AccountModal
            account={editId ? enrichedAccounts.find((a) => a.id === editId) : undefined}
            onSave={handleSave}
            onClose={() => { setShowAdd(false); setEditId(null); }}
          />
        )}
      </div>
    </PageTransition>
  );
}

/* ── Account Modal ──────────────────────────────────────────── */

function AccountModal({
  account,
  onSave,
  onClose,
}: {
  account?: Account;
  onSave: (a: Account) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "brokerage");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [balance, setBalance] = useState(account?.balance?.toString() ?? "");
  const [linked, setLinked] = useState(account?.linkedPortfolio ?? false);
  const [notes, setNotes] = useState(account?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: account?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      institution: institution.trim(),
      balance: parseFloat(balance) || 0,
      linkedPortfolio: linked,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-zinc-100">
            {account ? "Edit Account" : "Add Account"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium">Account Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fidelity Brokerage"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal"
              required
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Type</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {ACCOUNT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      type === t.value
                        ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Institution</label>
            <input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Fidelity, Vanguard, Chase"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal"
              required
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Balance ($)</label>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linked}
              onChange={(e) => setLinked(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/50"
            />
            <span className="text-sm text-zinc-300">Link to portfolio (auto-update balance)</span>
          </label>

          <div>
            <label className="text-xs text-zinc-400 font-medium">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Account number ending, purpose, etc."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-vela-teal resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-vela-teal text-zinc-950 font-semibold text-sm hover:bg-vela-teal/90 transition-colors"
          >
            {account ? "Save Changes" : "Add Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
