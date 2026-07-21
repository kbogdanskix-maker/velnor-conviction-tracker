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
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Eyebrow,
  Prose,
} from "@/components/instrument";
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

// ── Shared class tokens ──────────────────────────────────────────────────────

const BTN_TEAL =
  "inline-flex items-center justify-center gap-1.5 rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:border-vela-teal/40 hover:bg-vela-teal/15 disabled:cursor-not-allowed disabled:opacity-40";
const BTN_QUIET =
  "inline-flex items-center justify-center gap-1.5 rounded border border-vela-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-vela-muted transition-colors hover:border-vela-teal/40 hover:text-zinc-100";
const BTN_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded border border-loss/30 bg-loss/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-loss transition-colors hover:bg-loss/15";
const FIELD_LABEL =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted";
const MENU_CONTENT =
  "z-50 min-w-[150px] rounded border border-vela-border bg-vela-card py-1";
const MENU_ITEM_DANGER =
  "flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-loss outline-none transition-colors hover:bg-loss/10";
const OVERLAY = "fixed inset-0 z-50 bg-black/70";
const DIALOG_BASE =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded border border-vela-border bg-vela-card p-6";

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
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${style.className}`}
    >
      {style.label}
    </span>
  );
}

function LatestEntryTypeBadge({ type }: { type: ThesisEntryType | null }) {
  if (!type) return null;
  return <EntryTypeChip type={type} />;
}

/** Mono selector for the four entry types. Keeps ENTRY_TYPE_STYLE as the source of truth. */
function EntryTypeSelector({
  value,
  onChange,
}: {
  value: ThesisEntryType;
  onChange: (t: ThesisEntryType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(["bull", "bear", "update", "note"] as ThesisEntryType[]).map((t) => {
        const style = ENTRY_TYPE_STYLE[t];
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t)}
            className={`rounded border py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? `${style.className} border-current`
                : "border-vela-border text-vela-muted hover:border-vela-teal/40 hover:text-zinc-100"
            }`}
          >
            {ENTRY_TYPE_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
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

  // ── Derived figures ────────────────────────────────────────────────────────
  const totalEntries = threads.reduce((sum, t) => sum + t.entry_count, 0);
  const bullCount = threads.filter((t) => t.latest_entry_type === "bull").length;
  const bearCount = threads.filter((t) => t.latest_entry_type === "bear").length;
  const lastTouched = threads.length
    ? threads.reduce((latest, t) => (t.updated_at > latest ? t.updated_at : latest), threads[0].updated_at)
    : null;

  const newThreadButton = (
    <button onClick={() => setNewThreadOpen(true)} className={BTN_TEAL}>
      <Plus className="w-3.5 h-3.5 shrink-0" />
      New thesis
    </button>
  );

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Thesis" }]}
        note={
          threads.length
            ? `${threads.length} ${threads.length === 1 ? "thread" : "threads"} · append only`
            : "nothing written yet"
        }
      />

      <PageHero
        title="Thesis"
        meta="One thread per idea. Entries append, they never overwrite."
        figure={isLoading ? undefined : totalEntries}
        figureSub={
          isLoading
            ? undefined
            : `${threads.length} ${threads.length === 1 ? "thread" : "threads"}`
        }
      />

      {!isLoading && threads.length > 0 && (
        <StatStrip className="mt-6">
          <StatCell
            label="Threads"
            value={threads.length}
            sub={`${totalEntries} ${totalEntries === 1 ? "entry" : "entries"}`}
          />
          <StatCell
            label="Standing bull"
            value={bullCount}
            valueClass={bullCount > 0 ? "text-gain" : "text-zinc-100"}
            sub="latest entry is bullish"
          />
          <StatCell
            label="Standing bear"
            value={bearCount}
            valueClass={bearCount > 0 ? "text-loss" : "text-zinc-100"}
            sub="latest entry is bearish"
          />
          <StatCell
            label="Last written"
            value={lastTouched ? formatDate(lastTouched) : "—"}
            sub="most recent entry"
          />
        </StatStrip>
      )}

      <Section
        label="Threads"
        labelAside={isLoading ? undefined : String(threads.length)}
        prose="Each thread is a running record of what you believed and when. Nothing here can be edited after the fact, so the trail stays honest."
        controls={threads.length > 0 ? newThreadButton : undefined}
      >
        <div className="grid grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-[320px_1fr]">
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
          <div className="min-w-0 lg:border-l lg:border-vela-border lg:pl-10">
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
              <div className="hidden min-h-[280px] items-center justify-center border border-vela-border px-6 text-center lg:flex">
                <div>
                  <BookOpen className="mx-auto mb-3 h-5 w-5 text-vela-teal" />
                  <Eyebrow>No thread selected</Eyebrow>
                  <Prose className="mx-auto mt-2.5 max-w-[300px]">
                    Pick a thesis on the left to read its conviction trail.
                  </Prose>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

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
          <Dialog.Overlay className={OVERLAY} />
          <Dialog.Content className={`${DIALOG_BASE} max-w-sm`}>
            <Dialog.Title className="font-display text-[18px] font-semibold text-zinc-100">
              Delete thesis
            </Dialog.Title>
            <p className="mt-2.5 text-[13.5px] leading-[1.55] text-vela-body">
              This permanently deletes the thread for{" "}
              <span className="font-mono font-medium text-zinc-100">{deleteTarget?.ticker}</span>{" "}
              and all of its entries. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className={BTN_QUIET}>
                Cancel
              </button>
              <button onClick={handleDeleteThread} className={BTN_DANGER}>
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
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
      <div className="divide-y divide-vela-border border-y border-vela-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-2 h-3 w-40" />
            <div className="skeleton mt-2 h-2.5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center border border-vela-border px-6 py-14 text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-vela-border">
          <BookOpen className="h-4 w-4 text-vela-teal" />
        </div>
        <Eyebrow>No theses yet</Eyebrow>
        <Prose className="mx-auto mt-2.5 max-w-[300px]">
          Write down the reasoning behind a position while you still believe it. That is what makes
          the trail worth reading later.
        </Prose>
        <button onClick={onNew} className={`${BTN_TEAL} mt-6`}>
          <Plus className="w-3.5 h-3.5 shrink-0" />
          Write first thesis
        </button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-vela-border border-y border-vela-border">
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
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={`group relative flex cursor-pointer items-center gap-3 py-3.5 pl-3 pr-1 transition-colors ${
        isSelected ? "bg-vela-teal/[0.06]" : "hover:bg-vela-teal/[0.03]"
      }`}
    >
      {isSelected && (
        <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-[2px] bg-vela-teal" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-mono text-[13px] font-medium tracking-[0.06em] ${
              isSelected ? "text-vela-teal" : "text-zinc-100"
            }`}
          >
            {thread.ticker}
          </span>
          {thread.latest_entry_type && <LatestEntryTypeBadge type={thread.latest_entry_type} />}
        </div>
        <p className="mt-1 truncate text-[12.5px] leading-snug text-vela-body">{thread.title}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
          {thread.entry_count} {thread.entry_count === 1 ? "entry" : "entries"} ·{" "}
          {formatDate(thread.updated_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label={`Actions for ${thread.ticker}`}
                className="rounded p-1 text-vela-muted transition-colors hover:text-zinc-100 focus:outline-none"
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={MENU_CONTENT} sideOffset={4} align="end">
                <DropdownMenu.Item className={MENU_ITEM_DANGER} onSelect={onDelete}>
                  <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-vela-subtle" aria-hidden="true" />
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
      <div>
        <div className="skeleton h-3 w-16" />
        <div className="skeleton mt-3 h-6 w-56" />
        <div className="skeleton mt-3 h-3 w-40" />
        <div className="mt-7 space-y-3">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-3/4" />
        </div>
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
    <div>
      {/* Back button (mobile) */}
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-vela-muted transition-colors hover:text-vela-teal lg:hidden"
      >
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> All theses
      </button>

      {/* Thread header */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[13px] font-medium tracking-[0.08em] text-vela-teal">
              {thread.ticker}
            </span>
            {asSummary.latest_entry_type && (
              <LatestEntryTypeBadge type={asSummary.latest_entry_type} />
            )}
          </div>
          <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-zinc-100">
            {thread.title}
          </h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
            Started {formatDate(thread.created_at)} · {thread.entries.length}{" "}
            {thread.entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setAddEntryOpen(true)} className={BTN_TEAL}>
            <Plus className="w-3.5 h-3.5 shrink-0" />
            Add thought
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Thread actions"
                className="rounded p-1.5 text-vela-muted transition-colors hover:text-zinc-100 focus:outline-none"
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={MENU_CONTENT} sideOffset={4} align="end">
                <DropdownMenu.Item
                  className={MENU_ITEM_DANGER}
                  onSelect={() => onDelete(asSummary)}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete thread
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Entry timeline */}
      <div className="mt-7 border-t border-vela-border pt-6">
        <Eyebrow className="mb-4">Conviction trail</Eyebrow>

        {entries.length === 0 ? (
          <div className="py-6">
            <Prose className="max-w-[380px]">
              Nothing logged on this thread yet. The first entry is usually the most useful one:
              what you believe, and what would prove you wrong.
            </Prose>
            <button onClick={() => setAddEntryOpen(true)} className={`${BTN_TEAL} mt-4`}>
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Add opening thought
            </button>
          </div>
        ) : (
          <div className="divide-y divide-vela-border border-t border-vela-border">
            {entries.map((entry, idx) => (
              <article key={entry.id} className="relative py-5 pl-5">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[26px] h-[7px] w-[7px] rotate-45 bg-vela-teal"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <EntryTypeChip type={entry.entry_type} />
                  <span className="font-mono text-[11px] tabular-nums text-vela-muted">
                    {formatDate(entry.created_at)}
                  </span>
                  <span className="flex-1" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
                    #{entries.length - idx}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.6] text-vela-body">
                  {entry.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

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
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={`${DIALOG_BASE} max-h-[90vh] max-w-lg overflow-y-auto`}>
          <Dialog.Title className="font-display text-[18px] font-semibold text-zinc-100">
            New thesis
          </Dialog.Title>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
            Opens a new append-only thread
          </p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>Ticker</label>
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
                <label className={FIELD_LABEL}>Opening stance</label>
                <EntryTypeSelector value={entryType} onChange={setEntryType} />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Title</label>
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
              <label className={FIELD_LABEL}>Opening thought (optional)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Why are you bullish or bearish? What is your edge? What would change your mind?"
                className="input-field w-full resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { reset(); onClose(); }} className={BTN_QUIET}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ticker.trim() || !title.trim() || saving}
                className={BTN_TEAL}
              >
                {saving ? "Creating…" : "Create"}
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
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={`${DIALOG_BASE} max-h-[90vh] max-w-md overflow-y-auto`}>
          <Dialog.Title className="font-display text-[18px] font-semibold text-zinc-100">
            Add thought
          </Dialog.Title>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
            Appending to <span className="text-zinc-100">{ticker}</span> · entries are permanent
          </p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Entry type selector */}
            <div>
              <label className={FIELD_LABEL}>Entry type</label>
              <EntryTypeSelector value={entryType} onChange={setEntryType} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Your thought</label>
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
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { reset(); onClose(); }} className={BTN_QUIET}>
                Cancel
              </button>
              <button type="submit" disabled={!body.trim() || saving} className={BTN_TEAL}>
                {saving ? "Appending…" : "Append entry"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
