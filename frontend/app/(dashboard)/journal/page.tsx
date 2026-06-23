"use client";

import { useState, useMemo } from "react";
import {
  BookOpen, Plus, X, ChevronDown, TrendingUp, TrendingDown,
  Pause, Eye, ArrowUpRight, ArrowDownRight, MoreHorizontal,
  Check, Clock, Minus,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useJournal, useJournalStats } from "@/hooks/useJournal";
import { api } from "@/lib/api";
import { formatTimeAgo } from "@/lib/formatters";
import type {
  JournalEntry, JournalEntryCreate, JournalEntryUpdate,
  JournalAction, JournalOutcome,
} from "@/hooks/useJournal";
import PageTransition from "@/components/celestial/PageTransition";

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIONS: { value: JournalAction; label: string; icon: typeof TrendingUp; color: string }[] = [
  { value: "buy", label: "Buy", icon: ArrowUpRight, color: "text-emerald-400" },
  { value: "sell", label: "Sell", icon: ArrowDownRight, color: "text-rose-400" },
  { value: "add", label: "Add More", icon: Plus, color: "text-emerald-400" },
  { value: "trim", label: "Trim", icon: TrendingDown, color: "text-amber-400" },
  { value: "hold", label: "Hold", icon: Pause, color: "text-blue-400" },
  { value: "watch", label: "Watch", icon: Eye, color: "text-zinc-400" },
];

const OUTCOMES: { value: JournalOutcome; label: string; icon: typeof Check; color: string }[] = [
  { value: "win", label: "Win", icon: Check, color: "text-emerald-400" },
  { value: "loss", label: "Loss", icon: X, color: "text-rose-400" },
  { value: "breakeven", label: "Breakeven", icon: Minus, color: "text-zinc-400" },
  { value: "pending", label: "Pending", icon: Clock, color: "text-amber-400" },
];

const HORIZONS = ["days", "weeks", "months", "1-2 years", "3-5 years", "5+ years"];

function getActionConfig(action: string) {
  return ACTIONS.find((a) => a.value === action) ?? ACTIONS[0];
}

function getOutcomeConfig(outcome: string) {
  return OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[3];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { entries, mutate, isEmpty, isLoading } = useJournal();
  const { stats } = useJournalStats();
  const [addOpen, setAddOpen] = useState(false);
  const [reviewEntry, setReviewEntry] = useState<JournalEntry | null>(null);
  const [filterAction, setFilterAction] = useState<JournalAction | null>(null);
  const [filterOutcome, setFilterOutcome] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = entries;
    if (filterAction) list = list.filter((e) => e.action === filterAction);
    if (filterOutcome === "reviewed") list = list.filter((e) => e.outcome && e.outcome !== "pending");
    else if (filterOutcome === "pending") list = list.filter((e) => !e.outcome || e.outcome === "pending");
    return list;
  }, [entries, filterAction, filterOutcome]);

  async function handleDelete(id: string) {
    await api.delete(`/journal/${id}`);
    mutate();
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-vela-teal" />
            Decision Journal
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Log your investment decisions, track your rationale, and review outcomes.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-vela-teal text-zinc-950 rounded-lg text-sm font-medium hover:bg-teal-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="vela-card text-center py-3">
            <p className="text-2xl font-bold tabular text-zinc-100">{stats.total}</p>
            <p className="text-xs text-zinc-500">Decisions</p>
          </div>
          <div className="vela-card text-center py-3">
            <p className="text-2xl font-bold tabular text-emerald-400">
              {stats.win_rate !== null ? `${(stats.win_rate * 100).toFixed(0)}%` : "--"}
            </p>
            <p className="text-xs text-zinc-500">Win Rate</p>
          </div>
          <div className="vela-card text-center py-3">
            <p className="text-2xl font-bold tabular text-zinc-100">
              {stats.avg_conviction != null && stats.avg_conviction > 0 ? stats.avg_conviction.toFixed(1) : "--"}
            </p>
            <p className="text-xs text-zinc-500">Avg Conviction</p>
          </div>
          <div className="vela-card text-center py-3">
            <p className="text-2xl font-bold tabular text-amber-400">{stats.pending}</p>
            <p className="text-xs text-zinc-500">Pending Review</p>
          </div>
        </div>
      )}

      {/* Conviction insight */}
      {stats && stats.win_avg_conviction !== null && stats.loss_avg_conviction !== null && (
        <div className="vela-card border-vela-teal/20 px-4 py-3">
          <p className="text-xs text-zinc-400">
            Your winning trades had an average conviction of{" "}
            <span className="text-emerald-400 font-medium">{stats.win_avg_conviction}</span>,
            while losing trades averaged{" "}
            <span className="text-rose-400 font-medium">{stats.loss_avg_conviction}</span>.
            {stats.win_avg_conviction > stats.loss_avg_conviction
              ? " Higher conviction correlates with better outcomes for you."
              : " Consider being more selective with lower-conviction trades."}
          </p>
        </div>
      )}

      {/* Filters */}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setFilterAction(null); setFilterOutcome(null); }}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              !filterAction && !filterOutcome
                ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </button>
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => setFilterAction(filterAction === a.value ? null : a.value)}
              className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                filterAction === a.value
                  ? "bg-vela-teal/15 text-vela-teal border-vela-teal/30"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {a.label}
            </button>
          ))}
          <span className="w-px h-4 bg-zinc-700" />
          <button
            onClick={() => setFilterOutcome(filterOutcome === "pending" ? null : "pending")}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              filterOutcome === "pending"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Needs Review
          </button>
          <button
            onClick={() => setFilterOutcome(filterOutcome === "reviewed" ? null : "reviewed")}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              filterOutcome === "reviewed"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Reviewed
          </button>
        </div>
      )}

      {/* Entry list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="vela-card animate-pulse h-28" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No decisions logged yet</p>
            <p className="text-zinc-500 text-sm mt-1">
              Start logging your investment decisions to track your thinking and improve over time.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-4 px-4 py-2 bg-vela-teal text-zinc-950 rounded-lg text-sm font-medium hover:bg-teal-400 transition-colors"
          >
            Log First Decision
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onReview={() => setReviewEntry(entry)}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
          {filtered.length === 0 && entries.length > 0 && (
            <p className="text-center text-zinc-500 text-sm py-8">No entries match this filter.</p>
          )}
        </div>
      )}

      {/* Add modal */}
      <AddEntryModal open={addOpen} onClose={() => setAddOpen(false)} onSave={() => mutate()} />

      {/* Review modal */}
      {reviewEntry && (
        <ReviewModal
          entry={reviewEntry}
          onClose={() => setReviewEntry(null)}
          onSave={() => { mutate(); setReviewEntry(null); }}
        />
      )}

      {/* Disclaimer */}
      {entries.length > 0 && (
        <div className="text-center pt-4 pb-8 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            The journal is for personal reflection. Past outcomes do not predict future results.
          </p>
        </div>
      )}
    </PageTransition>
  );
}

// ── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onReview,
  onDelete,
}: {
  entry: JournalEntry;
  onReview: () => void;
  onDelete: () => void;
}) {
  const actionConf = getActionConfig(entry.action);
  const ActionIcon = actionConf.icon;
  const hasOutcome = entry.outcome && entry.outcome !== "pending";

  return (
    <div className="vela-card">
      <div className="flex items-start gap-3">
        {/* Action badge */}
        <div className={`mt-0.5 p-1.5 rounded-md bg-zinc-800 ${actionConf.color}`}>
          <ActionIcon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-100">{entry.ticker}</span>
            <span className={`text-xs font-medium ${actionConf.color}`}>{actionConf.label}</span>
            <ConvictionDots level={entry.conviction} />
            {entry.time_horizon && (
              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                {entry.time_horizon}
              </span>
            )}
            <span className="text-[10px] text-zinc-600 ml-auto">
              {formatTimeAgo(entry.decided_at)}
            </span>
          </div>

          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">
            {entry.rationale}
          </p>

          {/* Price info */}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500">
            {entry.price_at_decision && (
              <span>Entry: <span className="text-zinc-300 tabular">${Number(entry.price_at_decision).toFixed(2)}</span></span>
            )}
            {entry.target_price && (
              <span>Target: <span className="text-emerald-400 tabular">${Number(entry.target_price).toFixed(2)}</span></span>
            )}
            {entry.stop_loss && (
              <span>Stop: <span className="text-rose-400 tabular">${Number(entry.stop_loss).toFixed(2)}</span></span>
            )}
          </div>

          {/* Outcome badge */}
          {hasOutcome && (
            <div className="mt-2 flex items-center gap-2">
              <OutcomeBadge outcome={entry.outcome!} />
              {entry.outcome_notes && (
                <span className="text-[10px] text-zinc-500 truncate">{entry.outcome_notes}</span>
              )}
            </div>
          )}

          {/* Tags */}
          {entry.tags && (
            <div className="flex gap-1 mt-2">
              {entry.tags.split(",").map((tag) => (
                <span key={tag} className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[140px] bg-zinc-900 border border-zinc-700 rounded-lg p-1 shadow-xl z-50"
              sideOffset={5}
              align="end"
            >
              {!hasOutcome && (
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md cursor-pointer outline-none"
                  onSelect={onReview}
                >
                  <Check className="w-3.5 h-3.5" />
                  Review Outcome
                </DropdownMenu.Item>
              )}
              {hasOutcome && (
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md cursor-pointer outline-none"
                  onSelect={onReview}
                >
                  <Check className="w-3.5 h-3.5" />
                  Update Review
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-zinc-800 rounded-md cursor-pointer outline-none"
                onSelect={onDelete}
              >
                <X className="w-3.5 h-3.5" />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

// ── Conviction dots ──────────────────────────────────────────────────────────

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Conviction: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level ? "bg-vela-teal" : "bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

// ── Outcome badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const conf = getOutcomeConfig(outcome);
  const Icon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${conf.color} bg-zinc-800`}>
      <Icon className="w-2.5 h-2.5" />
      {conf.label}
    </span>
  );
}

// ── Add Entry Modal ──────────────────────────────────────────────────────────

function AddEntryModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState<JournalAction>("buy");
  const [conviction, setConviction] = useState(3);
  const [rationale, setRationale] = useState("");
  const [priceAtDecision, setPriceAtDecision] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTicker(""); setAction("buy"); setConviction(3); setRationale("");
    setPriceAtDecision(""); setTargetPrice(""); setStopLoss("");
    setTimeHorizon(""); setTags("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !rationale.trim()) return;
    setSaving(true);
    try {
      const body: JournalEntryCreate = {
        ticker: ticker.trim().toUpperCase(),
        action,
        conviction,
        rationale: rationale.trim(),
        ...(priceAtDecision ? { price_at_decision: Number(priceAtDecision) } : {}),
        ...(targetPrice ? { target_price: Number(targetPrice) } : {}),
        ...(stopLoss ? { stop_loss: Number(stopLoss) } : {}),
        ...(timeHorizon ? { time_horizon: timeHorizon } : {}),
        ...(tags ? { tags: tags.trim() } : {}),
      };
      await api.post("/journal", body);
      onSave();
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl p-6 z-50 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-vela-teal" />
            Log Decision
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Ticker + Action */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Ticker</label>
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Action</label>
                <div className="flex flex-wrap gap-1">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setAction(a.value)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                        action === a.value
                          ? `${a.color} border-current bg-zinc-800`
                          : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conviction */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Conviction (1-5)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={conviction}
                  onChange={(e) => setConviction(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vela-teal
                    [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-sm font-semibold text-vela-teal tabular w-6 text-center">{conviction}</span>
              </div>
            </div>

            {/* Rationale */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Rationale</label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Why are you making this decision? What's your thesis?"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none resize-none"
                required
              />
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={priceAtDecision}
                  onChange={(e) => setPriceAtDecision(e.target.value)}
                  placeholder="$0.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none tabular"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Target Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="$0.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none tabular"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="$0.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none tabular"
                />
              </div>
            </div>

            {/* Time horizon + Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Time Horizon</label>
                <select
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none"
                >
                  <option value="">Select...</option>
                  {HORIZONS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Tags</label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="momentum, earnings"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !ticker.trim() || !rationale.trim()}
                className="flex-1 px-4 py-2 bg-vela-teal text-zinc-950 rounded-lg text-sm font-medium hover:bg-teal-400 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Log Decision"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({
  entry,
  onClose,
  onSave,
}: {
  entry: JournalEntry;
  onClose: () => void;
  onSave: () => void;
}) {
  const [outcome, setOutcome] = useState<JournalOutcome>(
    (entry.outcome as JournalOutcome) || "pending"
  );
  const [outcomeNotes, setOutcomeNotes] = useState(entry.outcome_notes || "");
  const [priceAtReview, setPriceAtReview] = useState(
    entry.price_at_review ? String(entry.price_at_review) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: JournalEntryUpdate = {
        outcome,
        outcome_notes: outcomeNotes.trim() || null,
        price_at_review: priceAtReview ? Number(priceAtReview) : null,
        reviewed_at: new Date().toISOString(),
      };
      await api.patch(`/journal/${entry.id}`, body);
      onSave();
    } finally {
      setSaving(false);
    }
  }

  // Calculate return if both prices available
  const entryPrice = Number(entry.price_at_decision);
  const reviewPrice = priceAtReview ? Number(priceAtReview) : 0;
  const returnPct = entryPrice && reviewPrice
    ? ((reviewPrice - entryPrice) / entryPrice) * 100
    : null;

  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-6 z-50">
          <Dialog.Title className="text-lg font-semibold text-zinc-100">
            Review: {entry.ticker} {getActionConfig(entry.action).label}
          </Dialog.Title>

          {/* Original rationale */}
          <div className="mt-3 p-3 bg-zinc-800 rounded-lg">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Original Rationale</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{entry.rationale}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Outcome */}
            <div>
              <label className="text-xs text-zinc-500 block mb-2">Outcome</label>
              <div className="flex gap-2">
                {OUTCOMES.filter((o) => o.value !== "pending").map((o) => {
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setOutcome(o.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        outcome === o.value
                          ? `${o.color} border-current bg-zinc-800`
                          : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price at review */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Current/Exit Price</label>
              <input
                type="number"
                step="0.01"
                value={priceAtReview}
                onChange={(e) => setPriceAtReview(e.target.value)}
                placeholder="$0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none tabular"
              />
              {returnPct !== null && (
                <p className={`text-xs mt-1 ${returnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}% return
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">What did you learn?</label>
              <textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="What went right or wrong? Would you make the same decision again?"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-vela-teal outline-none resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || outcome === "pending"}
                className="flex-1 px-4 py-2 bg-vela-teal text-zinc-950 rounded-lg text-sm font-medium hover:bg-teal-400 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Review"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
