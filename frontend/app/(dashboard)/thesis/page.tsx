"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  BookOpen, Plus, Pencil, Trash2, MoreHorizontal, TrendingUp, TrendingDown,
  Minus, Cloud, CloudOff, CheckCircle2, XCircle, CircleDashed, CircleDot,
  Target, BarChart3, Brain, AlertTriangle,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import { useCloudStore } from "@/hooks/useCloudStore";

// ── Types ───────────────────────────────────────────────────────────────────

type Outcome = "pending" | "correct" | "incorrect" | "partial";

interface Thesis {
  id: string;
  ticker: string;
  stance: "bullish" | "bearish" | "neutral";
  title: string;
  body: string;
  outcome?: Outcome;
  outcome_notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const OUTCOME_META: Record<Outcome, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: "Pending",   color: "text-zinc-500",   bg: "bg-zinc-700/30",   icon: CircleDashed },
  correct:   { label: "Correct",   color: "text-gain",       bg: "bg-gain/15",       icon: CheckCircle2 },
  incorrect: { label: "Wrong",     color: "text-loss",       bg: "bg-loss/15",       icon: XCircle },
  partial:   { label: "Partially", color: "text-amber-400",  bg: "bg-amber-400/15",  icon: CircleDot },
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function ThesisPage() {
  const { data: cloudData, save: cloudSave, isLoading: cloudLoading, isCloud } = useCloudStore<Thesis[]>("theses");
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Thesis | null>(null);
  const [filterStance, setFilterStance] = useState<string>("all");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");

  // Sync cloud data into local state
  const synced = useRef(false);
  useEffect(() => {
    if (cloudData && Array.isArray(cloudData) && !synced.current) {
      setTheses(cloudData);
      synced.current = true;
    }
  }, [cloudData]);

  function persist(updated: Thesis[]) {
    setTheses(updated);
    cloudSave(updated);
  }

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(t: Thesis) { setEditing(t); setModalOpen(true); }

  function handleDelete() {
    if (!deleteTarget) return;
    persist(theses.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function setOutcome(id: string, outcome: Outcome) {
    persist(theses.map((t) => t.id === id ? { ...t, outcome, updated_at: new Date().toISOString() } : t));
  }

  // Filtering
  const filtered = useMemo(() => {
    let list = theses;
    if (filterStance !== "all") list = list.filter((t) => t.stance === filterStance);
    if (filterOutcome !== "all") list = list.filter((t) => (t.outcome ?? "pending") === filterOutcome);
    return list;
  }, [theses, filterStance, filterOutcome]);

  // Scorecard stats
  const stats = useMemo(() => {
    const evaluated = theses.filter((t) => t.outcome && t.outcome !== "pending");
    const correct = theses.filter((t) => t.outcome === "correct").length;
    const incorrect = theses.filter((t) => t.outcome === "incorrect").length;
    const partial = theses.filter((t) => t.outcome === "partial").length;
    const pending = theses.filter((t) => !t.outcome || t.outcome === "pending").length;
    const total = evaluated.length;
    const accuracy = total > 0 ? ((correct + partial * 0.5) / total) * 100 : 0;

    // Per-stance breakdown
    const bullishEval = theses.filter((t) => t.stance === "bullish" && t.outcome && t.outcome !== "pending");
    const bullishCorrect = bullishEval.filter((t) => t.outcome === "correct" || t.outcome === "partial").length;
    const bullishAcc = bullishEval.length > 0 ? (bullishCorrect / bullishEval.length) * 100 : null;

    const bearishEval = theses.filter((t) => t.stance === "bearish" && t.outcome && t.outcome !== "pending");
    const bearishCorrect = bearishEval.filter((t) => t.outcome === "correct" || t.outcome === "partial").length;
    const bearishAcc = bearishEval.length > 0 ? (bearishCorrect / bearishEval.length) * 100 : null;

    return { correct, incorrect, partial, pending, total, accuracy, bullishAcc, bearishAcc };
  }, [theses]);

  // Insights
  const insights = useMemo(() => {
    const msgs: { icon: typeof Brain; text: string; color: string }[] = [];
    if (stats.total < 3) return msgs;

    if (stats.accuracy >= 70) {
      msgs.push({ icon: Target, text: `Strong conviction accuracy at ${stats.accuracy.toFixed(0)}%. Your research process is working.`, color: "text-gain" });
    } else if (stats.accuracy >= 50) {
      msgs.push({ icon: Brain, text: `${stats.accuracy.toFixed(0)}% accuracy — around a coin flip. Consider tightening your thesis criteria.`, color: "text-amber-400" });
    } else {
      msgs.push({ icon: AlertTriangle, text: `${stats.accuracy.toFixed(0)}% accuracy is below chance. Review what's going wrong in your analysis.`, color: "text-loss" });
    }

    if (stats.bullishAcc !== null && stats.bearishAcc !== null) {
      const diff = stats.bullishAcc - stats.bearishAcc;
      if (diff > 20) {
        msgs.push({ icon: TrendingUp, text: `You're better at spotting winners (${stats.bullishAcc.toFixed(0)}%) than shorts (${stats.bearishAcc.toFixed(0)}%). Consider reducing bearish bets.`, color: "text-vela-teal" });
      } else if (diff < -20) {
        msgs.push({ icon: TrendingDown, text: `Stronger at bearish calls (${stats.bearishAcc.toFixed(0)}%) than bullish (${stats.bullishAcc.toFixed(0)}%). You may have a negativity edge — or a confirmation bias on longs.`, color: "text-vela-teal" });
      }
    }

    if (stats.incorrect > stats.correct && stats.total >= 5) {
      msgs.push({ icon: Brain, text: "More wrong calls than right ones. Consider: Are you acting on conviction or FOMO? Review your worst misses for patterns.", color: "text-zinc-400" });
    }

    return msgs;
  }, [stats]);

  const stanceIcon = (stance: string) => {
    if (stance === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-gain" />;
    if (stance === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-loss" />;
    return <Minus className="w-3.5 h-3.5 text-zinc-400" />;
  };

  const stanceBadge = (stance: string) => {
    const cls = stance === "bullish" ? "bg-gain/15 text-gain" : stance === "bearish" ? "bg-loss/15 text-loss" : "bg-zinc-700/50 text-zinc-400";
    return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{stance}</span>;
  };

  const hasEvaluated = stats.total > 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-vela-teal" />
            Thesis
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5 flex items-center gap-2">
            Write down your investment reasoning
            {isCloud ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-vela-teal"><Cloud className="w-3 h-3" /> Synced</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600"><CloudOff className="w-3 h-3" /> Local</span>
            )}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Thesis
        </button>
      </div>

      {/* Scorecard */}
      {hasEvaluated && (
        <RevealOnScroll>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="vela-card">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Accuracy</p>
              <AnimatedNumber
                value={stats.accuracy}
                format={(n) => `${n.toFixed(0)}%`}
                className={`text-xl font-bold tabular ${stats.accuracy >= 60 ? "text-gain" : stats.accuracy >= 40 ? "text-amber-400" : "text-loss"}`}
              />
              <p className="text-[10px] text-zinc-600 mt-0.5">{stats.total} evaluated</p>
            </div>
            <div className="vela-card">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Correct</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tabular text-gain">{stats.correct}</span>
                {stats.partial > 0 && (
                  <span className="text-xs tabular text-amber-400">+{stats.partial} partial</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{stats.incorrect} wrong</p>
            </div>
            <div className="vela-card">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Bullish Calls</p>
              <p className={`text-xl font-bold tabular ${stats.bullishAcc !== null ? (stats.bullishAcc >= 50 ? "text-gain" : "text-loss") : "text-zinc-600"}`}>
                {stats.bullishAcc !== null ? `${stats.bullishAcc.toFixed(0)}%` : "—"}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">hit rate</p>
            </div>
            <div className="vela-card">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Bearish Calls</p>
              <p className={`text-xl font-bold tabular ${stats.bearishAcc !== null ? (stats.bearishAcc >= 50 ? "text-gain" : "text-loss") : "text-zinc-600"}`}>
                {stats.bearishAcc !== null ? `${stats.bearishAcc.toFixed(0)}%` : "—"}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">hit rate</p>
            </div>
          </div>
        </RevealOnScroll>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <RevealOnScroll delay={0.05}>
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ins.color}`} />
                  <p className="text-xs text-zinc-300 leading-relaxed">{ins.text}</p>
                </div>
              );
            })}
          </div>
        </RevealOnScroll>
      )}

      {/* Filters */}
      {theses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* Stance filters */}
          {["all", "bullish", "bearish", "neutral"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStance(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filterStance === s
                  ? "bg-vela-teal/15 text-vela-teal"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}

          {/* Separator */}
          {hasEvaluated && <div className="w-px h-6 bg-zinc-700/50 self-center mx-1" />}

          {/* Outcome filters */}
          {hasEvaluated && (["correct", "incorrect", "partial", "pending"] as Outcome[]).map((o) => {
            const meta = OUTCOME_META[o];
            const Icon = meta.icon;
            return (
              <button
                key={o}
                onClick={() => setFilterOutcome(filterOutcome === o ? "all" : o)}
                className={`text-xs px-2.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1 ${
                  filterOutcome === o
                    ? `${meta.bg} ${meta.color}`
                    : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Thesis list */}
      {filtered.length === 0 ? (
        <div className="vela-card text-center py-16">
          <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-200 mb-1">
            {theses.length === 0 ? "No theses yet" : "No matching theses"}
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            {theses.length === 0 ? "Write down why you're buying or avoiding a stock" : "Try a different filter"}
          </p>
          {theses.length === 0 && (
            <button onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Write your first thesis
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const outcome = t.outcome ?? "pending";
            const meta = OUTCOME_META[outcome];
            const OutcomeIcon = meta.icon;

            return (
              <div key={t.id} className="vela-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {stanceIcon(t.stance)}
                    <span className="text-sm font-bold text-vela-teal">{t.ticker}</span>
                    {stanceBadge(t.stance)}
                    {outcome !== "pending" && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                        <OutcomeIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    )}
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="min-w-[160px] bg-zinc-900 border border-vela-border rounded-lg p-1 shadow-xl z-50" sideOffset={4} align="end">
                        <DropdownMenu.Label className="px-3 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider">
                          Evaluate
                        </DropdownMenu.Label>
                        {(["correct", "incorrect", "partial", "pending"] as Outcome[]).map((o) => {
                          const m = OUTCOME_META[o];
                          const OIcon = m.icon;
                          return (
                            <DropdownMenu.Item
                              key={o}
                              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-zinc-800 outline-none ${
                                outcome === o ? m.color + " font-medium" : "text-zinc-300"
                              }`}
                              onSelect={() => setOutcome(t.id, o)}
                            >
                              <OIcon className={`w-3.5 h-3.5 ${outcome === o ? m.color : ""}`} />
                              {m.label}
                              {outcome === o && <span className="ml-auto text-[10px]">✓</span>}
                            </DropdownMenu.Item>
                          );
                        })}
                        <DropdownMenu.Separator className="h-px bg-zinc-800 my-1" />
                        <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 outline-none" onSelect={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-loss rounded-md cursor-pointer hover:bg-zinc-800 outline-none" onSelect={() => setDeleteTarget(t)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
                <h3 className="text-sm font-medium text-zinc-200 mb-1">{t.title}</h3>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{t.body}</p>

                {/* Outcome notes */}
                {t.outcome_notes && (
                  <div className={`mt-2 pt-2 border-t border-zinc-800/50 text-xs ${meta.color}`}>
                    <span className="text-zinc-500">Outcome: </span>{t.outcome_notes}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] text-zinc-600">
                    {formatDate(t.updated_at)}
                  </p>
                  {outcome === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setOutcome(t.id, "correct")}
                        className="p-1 rounded hover:bg-gain/15 text-zinc-600 hover:text-gain transition-colors"
                        title="Mark correct"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setOutcome(t.id, "partial")}
                        className="p-1 rounded hover:bg-amber-400/15 text-zinc-600 hover:text-amber-400 transition-colors"
                        title="Mark partially correct"
                      >
                        <CircleDot className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setOutcome(t.id, "incorrect")}
                        className="p-1 rounded hover:bg-loss/15 text-zinc-600 hover:text-loss transition-colors"
                        title="Mark incorrect"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <ThesisModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={(thesis) => {
          if (editing) {
            persist(theses.map((t) => t.id === editing.id ? thesis : t));
          } else {
            persist([thesis, ...theses]);
          }
        }}
      />

      {/* Delete Dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-zinc-900 border border-vela-border rounded-xl p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-zinc-100 mb-2">Delete Thesis</Dialog.Title>
            <p className="text-sm text-zinc-400 mb-4">
              Remove your {deleteTarget?.stance} thesis on <span className="font-medium text-zinc-200">{deleteTarget?.ticker}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={handleDelete} className="bg-loss hover:bg-loss/80 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors">Delete</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PageTransition>
  );
}


// ── Thesis Modal ────────────────────────────────────────────────────────────

function ThesisModal({ open, onClose, editing, onSave }: {
  open: boolean;
  onClose: () => void;
  editing: Thesis | null;
  onSave: (t: Thesis) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [stance, setStance] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("pending");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  function populate() {
    if (editing) {
      setTicker(editing.ticker);
      setStance(editing.stance);
      setTitle(editing.title);
      setBody(editing.body);
      setOutcome(editing.outcome ?? "pending");
      setOutcomeNotes(editing.outcome_notes ?? "");
    } else {
      setTicker("");
      setStance("bullish");
      setTitle("");
      setBody("");
      setOutcome("pending");
      setOutcomeNotes("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      ticker: ticker.toUpperCase(),
      stance,
      title,
      body,
      outcome,
      outcome_notes: outcomeNotes || undefined,
      created_at: editing?.created_at ?? now,
      updated_at: now,
    });
    onClose();
  }

  const showOutcomeSection = !!editing; // only show outcome fields when editing

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          onOpenAutoFocus={populate}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-zinc-900 border border-vela-border rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        >
          <Dialog.Title className="text-lg font-semibold text-zinc-100 mb-4">
            {editing ? "Edit Thesis" : "New Thesis"}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Ticker</label>
                <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" required className="input-field w-full uppercase" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Stance</label>
                <select value={stance} onChange={(e) => setStance(e.target.value as typeof stance)} className="input-field w-full">
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI monetization thesis" required className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Your reasoning</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Why are you bullish/bearish? What's your edge? What would change your mind?" required className="input-field w-full resize-none" />
            </div>

            {/* Outcome section — only when editing */}
            {showOutcomeSection && (
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <p className="text-xs text-zinc-400 font-medium">Evaluate this thesis</p>
                <div className="flex gap-2">
                  {(["pending", "correct", "partial", "incorrect"] as Outcome[]).map((o) => {
                    const meta = OUTCOME_META[o];
                    const Icon = meta.icon;
                    const active = outcome === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setOutcome(o)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors border ${
                          active
                            ? `${meta.bg} ${meta.color} border-current`
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                {outcome !== "pending" && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">What happened? (optional)</label>
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      rows={2}
                      placeholder="What did you get right or wrong? What would you do differently?"
                      className="input-field w-full resize-none"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button type="submit" disabled={!ticker || !title || !body} className="btn-primary text-sm">
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
