"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Plus, Trash2, MoreHorizontal, ChevronRight, ChevronLeft,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDate } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import {
  useThesisList,
  useThesisThread,
  createThread,
  addEntry,
  deleteThread,
  ENTRY_TYPE_STYLE,
  type ThesisEntryType,
  type ThesisThreadSummary,
} from "@/lib/thesis";

// ── Migration ────────────────────────────────────────────────────────────────

const MIGRATION_DONE_KEY = "vela_thesis_migration_v1_done";
const LEGACY_LS_KEY = "vela_theses";

/** Legacy schema stored by useCloudStore */
interface LegacyThesis {
  id: string;
  ticker: string;
  stance: "bullish" | "bearish" | "neutral";
  title: string;
  body: string;
  outcome?: string;
  outcome_notes?: string;
  created_at: string;
  updated_at: string;
}

function stanceToEntryType(stance: string): ThesisEntryType {
  if (stance === "bullish") return "bull";
  if (stance === "bearish") return "bear";
  return "note";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<ThesisEntryType, string> = {
  bull: "Bull",
  bear: "Bear",
  update: "Update",
  note: "Note",
};

function EntryTypeChip({ type }: { type: ThesisEntryType }) {
  const style = ENTRY_TYPE_STYLE[type];
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${style.className}`}>
      {style.label}
    </span>
  );
}

function LatestEntryTypeBadge({ type }: { type: ThesisEntryType | null }) {
  if (!type) return null;
  return <EntryTypeChip type={type} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ThesisPage() {
  const { threads, isLoading, mutate: mutateList } = useThesisList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ThesisThreadSummary | null>(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const migrationRan = useRef(false);

  // One-time migration from legacy localStorage store
  useEffect(() => {
    if (migrationRan.current) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_DONE_KEY)) return;
    if (isLoading) return; // wait until we know if the list is empty
    if (threads.length > 0) {
      // Already have cloud data; mark done and skip
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      migrationRan.current = true;
      return;
    }

    let legacy: LegacyThesis[] = [];
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_LS_KEY) || "[]");
    } catch {
      legacy = [];
    }

    if (legacy.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      migrationRan.current = true;
      return;
    }

    // Import legacy theses as new threads (oldest first so list order is preserved)
    migrationRan.current = true;
    const sorted = [...legacy].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    (async () => {
      for (const t of sorted) {
        try {
          await createThread({
            ticker: t.ticker,
            title: t.title,
            initial_body: t.body,
            entry_type: stanceToEntryType(t.stance),
          });
        } catch {
          // Skip individual failures
        }
      }
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      mutateList();
    })();
  }, [isLoading, threads.length, mutateList]);

  async function handleDeleteThread() {
    if (!deleteTarget) return;
    await deleteThread(deleteTarget.id);
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
    mutateList();
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-vela-teal shrink-0" />
            Thesis
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Your conviction trail — one thread per idea, append-only.
          </p>
        </div>
        <button
          onClick={() => setNewThreadOpen(true)}
          className="btn-primary text-sm inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" /> New Thesis
        </button>
      </div>

      {/* Split layout: thread list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Thread list */}
        <ThreadList
          threads={threads}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={(t) => setDeleteTarget(t)}
          onNew={() => setNewThreadOpen(true)}
        />

        {/* Thread detail */}
        {selectedId ? (
          <ThreadDetail
            threadId={selectedId}
            onBack={() => setSelectedId(null)}
            onDelete={(t) => setDeleteTarget(t)}
            addEntryOpen={addEntryOpen}
            setAddEntryOpen={setAddEntryOpen}
            mutateList={mutateList}
          />
        ) : (
          <div className="hidden lg:flex vela-card items-center justify-center min-h-[320px] text-zinc-600">
            <div className="text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a thesis to read its conviction trail</p>
            </div>
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      <NewThreadModal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        onCreated={(id) => {
          mutateList();
          setSelectedId(id);
          setNewThreadOpen(false);
        }}
      />

      {/* Delete confirm */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-zinc-900 border border-vela-border rounded-lg p-6 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-zinc-100 mb-2">
              Delete Thesis
            </Dialog.Title>
            <p className="text-sm text-zinc-400 mb-4">
              This permanently deletes the thread for{" "}
              <span className="font-mono font-bold text-zinc-200">{deleteTarget?.ticker}</span> and
              all its entries. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                className="bg-loss hover:bg-loss/80 text-white font-medium px-4 py-2 rounded text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PageTransition>
  );
}

// ── Thread List ───────────────────────────────────────────────────────────────

function ThreadList({
  threads,
  isLoading,
  selectedId,
  onSelect,
  onDelete,
  onNew,
}: {
  threads: ThesisThreadSummary[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (t: ThesisThreadSummary) => void;
  onNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="vela-card space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="vela-card text-center py-14">
        <BookOpen className="w-7 h-7 text-zinc-600 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-zinc-300 mb-1">No theses yet</h2>
        <p className="text-xs text-zinc-500 mb-4">Write down your first investment reasoning</p>
        <button onClick={onNew} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4 shrink-0" /> Write first thesis
        </button>
      </div>
    );
  }

  return (
    <div className="vela-card divide-y divide-vela-border">
      {threads.map((t) => (
        <ThreadRow
          key={t.id}
          thread={t}
          isSelected={t.id === selectedId}
          onSelect={() => onSelect(t.id)}
          onDelete={() => onDelete(t)}
        />
      ))}
    </div>
  );
}

function ThreadRow({
  thread,
  isSelected,
  onSelect,
  onDelete,
}: {
  thread: ThesisThreadSummary;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        isSelected ? "bg-vela-teal/8" : "hover:bg-zinc-800/40"
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono font-bold text-sm text-vela-teal tabular-nums shrink-0">
            {thread.ticker}
          </span>
          {thread.latest_entry_type && (
            <LatestEntryTypeBadge type={thread.latest_entry_type} />
          )}
        </div>
        <p className="text-xs text-zinc-300 truncate">{thread.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
            {thread.entry_count} {thread.entry_count === 1 ? "entry" : "entries"}
          </span>
          <span className="text-[10px] text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
            {formatDate(thread.updated_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4 shrink-0" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[140px] bg-zinc-900 border border-vela-border rounded-lg p-1 shadow-xl z-50"
              sideOffset={4}
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-loss rounded cursor-pointer hover:bg-zinc-800 outline-none"
                onSelect={onDelete}
              >
                <Trash2 className="w-4 h-4 shrink-0" /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
      </div>
    </div>
  );
}

// ── Thread Detail ─────────────────────────────────────────────────────────────

function ThreadDetail({
  threadId,
  onBack,
  onDelete,
  addEntryOpen,
  setAddEntryOpen,
  mutateList,
}: {
  threadId: string;
  onBack: () => void;
  onDelete: (t: ThesisThreadSummary) => void;
  addEntryOpen: boolean;
  setAddEntryOpen: (v: boolean) => void;
  mutateList: () => void;
}) {
  const { thread, isLoading, mutate: mutateThread } = useThesisThread(threadId);

  if (isLoading) {
    return (
      <div className="vela-card space-y-3">
        <div className="h-8 w-48 rounded bg-zinc-800/50 animate-pulse" />
        <div className="h-4 w-full rounded bg-zinc-800/50 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (!thread) return null;

  // Reverse for newest-first display (API returns oldest-first)
  const entries = [...thread.entries].reverse();

  // Cast to the minimal ThesisThreadSummary shape needed for delete
  const asSummary: ThesisThreadSummary = {
    id: thread.id,
    ticker: thread.ticker,
    title: thread.title,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    entry_count: thread.entries.length,
    latest_entry_type: thread.entries.length > 0
      ? thread.entries[thread.entries.length - 1].entry_type
      : null,
  };

  return (
    <div className="vela-card space-y-5">
      {/* Back button (mobile) */}
      <button
        onClick={onBack}
        className="lg:hidden flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" /> All theses
      </button>

      {/* Thread header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-lg text-vela-teal tabular-nums">
              {thread.ticker}
            </span>
            {asSummary.latest_entry_type && (
              <LatestEntryTypeBadge type={asSummary.latest_entry_type} />
            )}
          </div>
          <h2 className="text-base font-semibold text-zinc-100">{thread.title}</h2>
          <p className="text-[10px] font-mono text-zinc-600 mt-1 tabular-nums">
            Started {formatDate(thread.created_at)} · {thread.entries.length}{" "}
            {thread.entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAddEntryOpen(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 shrink-0" /> Add thought
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <MoreHorizontal className="w-4 h-4 shrink-0" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[140px] bg-zinc-900 border border-vela-border rounded-lg p-1 shadow-xl z-50"
                sideOffset={4}
                align="end"
              >
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-loss rounded cursor-pointer hover:bg-zinc-800 outline-none"
                  onSelect={() => onDelete(asSummary)}
                >
                  <Trash2 className="w-4 h-4 shrink-0" /> Delete thread
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <hr className="border-vela-border" />

      {/* Entry timeline */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-600">No entries yet</p>
          <button
            onClick={() => setAddEntryOpen(true)}
            className="mt-3 text-sm text-vela-teal hover:underline"
          >
            Add your opening thought
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-vela-teal shrink-0" />
                {idx < entries.length - 1 && (
                  <div className="w-px flex-1 bg-vela-border mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <EntryTypeChip type={entry.entry_type} />
                  <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {entry.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Entry Modal */}
      <AddEntryModal
        open={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        onAdded={() => {
          setAddEntryOpen(false);
          mutateThread();
          mutateList();
        }}
        threadId={threadId}
        ticker={thread.ticker}
      />
    </div>
  );
}

// ── New Thread Modal ──────────────────────────────────────────────────────────

function NewThreadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [entryType, setEntryType] = useState<ThesisEntryType>("bull");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTicker("");
    setTitle("");
    setBody("");
    setEntryType("bull");
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const thread = await createThread({
        ticker: ticker.trim().toUpperCase(),
        title: title.trim(),
        initial_body: body.trim() || undefined,
        entry_type: entryType,
      });
      reset();
      onCreated(thread.id);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-zinc-900 border border-vela-border rounded-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-base font-semibold text-zinc-100 mb-4">
            New Thesis
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Ticker</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="AAPL"
                  required
                  className="input-field w-full font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Opening stance</label>
                <div className="flex gap-1.5">
                  {(["bull", "bear", "update", "note"] as ThesisEntryType[]).map((t) => {
                    const style = ENTRY_TYPE_STYLE[t];
                    const active = entryType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEntryType(t)}
                        className={`flex-1 text-[10px] font-mono uppercase tracking-wider py-1.5 rounded border transition-colors ${
                          active
                            ? `${style.className} border-current`
                            : "bg-zinc-800/50 text-zinc-600 border-zinc-700/50 hover:text-zinc-300"
                        }`}
                      >
                        {ENTRY_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI monetization thesis"
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Opening thought (optional)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Why are you bullish or bearish? What is your edge? What would change your mind?"
                className="input-field w-full resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { reset(); onClose(); }} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ticker.trim() || !title.trim() || saving}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Add Entry Modal ───────────────────────────────────────────────────────────

function AddEntryModal({
  open,
  onClose,
  onAdded,
  threadId,
  ticker,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  threadId: string;
  ticker: string;
}) {
  const [body, setBody] = useState("");
  const [entryType, setEntryType] = useState<ThesisEntryType>("update");
  const [saving, setSaving] = useState(false);

  function reset() {
    setBody("");
    setEntryType("update");
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await addEntry(threadId, { body: body.trim(), entry_type: entryType });
      reset();
      onAdded();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-zinc-900 border border-vela-border rounded-lg p-6 shadow-xl">
          <Dialog.Title className="text-base font-semibold text-zinc-100 mb-1">
            Add thought
          </Dialog.Title>
          <p className="text-xs text-zinc-500 mb-4">
            Appending to{" "}
            <span className="font-mono font-bold text-zinc-300">{ticker}</span> — entries are
            permanent.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Entry type selector */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Entry type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["bull", "bear", "update", "note"] as ThesisEntryType[]).map((t) => {
                  const style = ENTRY_TYPE_STYLE[t];
                  const active = entryType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEntryType(t)}
                      className={`text-[10px] font-mono uppercase tracking-wider py-2 rounded border transition-colors ${
                        active
                          ? `${style.className} border-current`
                          : "bg-zinc-800/50 text-zinc-600 border-zinc-700/50 hover:text-zinc-300"
                      }`}
                    >
                      {ENTRY_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Your thought</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="What changed? New data? Revised target? Re-affirming the thesis?"
                required
                className="input-field w-full resize-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => { reset(); onClose(); }} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!body.trim() || saving}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? "Appending..." : "Append entry"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

