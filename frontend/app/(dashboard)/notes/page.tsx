"use client";

import { useState, useRef } from "react";
import { Pin, PinOff, Trash2, Pencil, Plus, Check, X, StickyNote, Clock } from "lucide-react";
import { useReflectionNotes, type ReflectionNote } from "@/hooks/useReflectionNotes";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  isFlagged,
  onFlag,
  onUnflag,
  onDelete,
  onEdit,
}: {
  note: ReflectionNote;
  isFlagged: boolean;
  onFlag: () => void;
  onUnflag: () => void;
  onDelete: () => void;
  onEdit: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setDraft(note.content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 10);
  }

  function saveEdit() {
    if (draft.trim() && draft.trim() !== note.content) {
      onEdit(draft.trim());
    }
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(note.content);
    setEditing(false);
  }

  return (
    <div className={`group relative rounded-[10px] border p-3.5 transition-colors ${
      isFlagged
        ? "bg-[#0c110f] border-teal-500/20 hover:border-teal-500/35"
        : "bg-[#0d0d0d] border-[#1a1a1a] hover:border-zinc-700/60"
    }`}>
      {isFlagged && (
        <div className="absolute top-3 left-3.5 w-[5px] h-[5px] rounded-full bg-teal-500 shadow-[0_0_6px_#1AA8BB60]" />
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
              if (e.key === "Escape") cancelEdit();
            }}
            rows={3}
            className="w-full bg-[#080808] border border-teal-500/30 rounded-[7px] px-3 py-2 text-[12.5px] text-zinc-200 resize-none outline-none leading-relaxed"
          />
          <div className="flex gap-1.5 justify-end">
            <button onClick={cancelEdit} className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
            <button onClick={saveEdit} disabled={!draft.trim()} className="flex items-center gap-1 text-[11px] text-teal-500 hover:text-teal-400 px-2 py-1 rounded border border-teal-500/30 hover:border-teal-500/50 transition-colors disabled:opacity-40">
              <Check className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`text-[12.5px] leading-relaxed text-zinc-300 ${isFlagged ? "pl-4" : ""}`}>
            {note.content}
          </p>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[10px] text-zinc-700 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(note.updated_at)}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={startEdit} className="p-1 text-zinc-600 hover:text-zinc-300 rounded transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {isFlagged ? (
                <button onClick={onUnflag} title="Move to working notes" className="p-1 text-teal-600 hover:text-teal-400 rounded transition-colors">
                  <PinOff className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={onFlag} title="Pin as standing conviction" className="p-1 text-zinc-600 hover:text-teal-400 rounded transition-colors">
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onDelete} className="p-1 text-zinc-600 hover:text-rose-500 rounded transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Add note form ─────────────────────────────────────────────────────────────

function AddNoteForm({ onAdd }: { onAdd: (content: string, pin: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [pin, setPin] = useState(false);

  function submit() {
    if (!content.trim()) return;
    onAdd(content.trim(), pin);
    setContent("");
    setPin(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-300 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-[9px] px-3.5 py-2.5 w-full transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        New note
      </button>
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-teal-500/25 rounded-[10px] p-3.5">
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          if (e.key === "Escape") { setOpen(false); setContent(""); }
        }}
        placeholder="What's on your mind about the market or your portfolio…"
        rows={3}
        className="w-full bg-transparent text-[12.5px] text-zinc-200 placeholder-zinc-700 resize-none outline-none leading-relaxed"
      />
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#1a1a1a]">
        <button
          onClick={() => setPin(!pin)}
          className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors ${
            pin
              ? "border-teal-500/40 text-teal-500 bg-teal-500/5"
              : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"
          }`}
        >
          <Pin className="w-3 h-3" />
          {pin ? "Pinned conviction" : "Pin as conviction"}
        </button>
        <div className="flex gap-1.5">
          <button onClick={() => { setOpen(false); setContent(""); }} className="text-[11px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={!content.trim()} className="text-[11px] text-teal-500 hover:text-teal-400 px-2 py-1 rounded border border-teal-500/30 hover:border-teal-500/50 transition-colors disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { notes, addFlagged, addEphemeral, flagNote, unflagNote, deleteNote, editNote, isLoading } = useReflectionNotes();

  function handleAdd(content: string, pin: boolean) {
    if (pin) {
      addFlagged(content);
    } else {
      addEphemeral(content);
    }
  }

  const totalCount = notes.flagged.length + notes.ephemeral.length;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <RevealOnScroll>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <StickyNote className="w-5 h-5 text-teal-500" />
                <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Notes</h1>
              </div>
              <p className="text-sm text-zinc-500">
                Your knowledge library — feeds the Reflect AI as background context.
              </p>
            </div>
            {totalCount > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                {notes.flagged.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Pin className="w-3 h-3 text-teal-600" />
                    {notes.flagged.length} pinned
                  </span>
                )}
                {notes.ephemeral.length > 0 && (
                  <span>{notes.ephemeral.length} working</span>
                )}
              </div>
            )}
          </div>
        </RevealOnScroll>

        {/* Add note */}
        <RevealOnScroll delay={0.05}>
          <AddNoteForm onAdd={handleAdd} />
        </RevealOnScroll>

        {/* Pinned convictions */}
        {notes.flagged.length > 0 && (
          <RevealOnScroll delay={0.08}>
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-3.5 h-3.5 text-teal-500" />
                <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Pinned convictions</h2>
                <span className="text-[10px] text-zinc-700 ml-auto">Always in AI context</span>
              </div>
              <div className="flex flex-col gap-2">
                {notes.flagged.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isFlagged
                    onFlag={() => {}}
                    onUnflag={() => unflagNote(note.id)}
                    onDelete={() => deleteNote(note.id)}
                    onEdit={(content) => editNote(note.id, content)}
                  />
                ))}
              </div>
            </section>
          </RevealOnScroll>
        )}

        {/* Working notes */}
        {notes.ephemeral.length > 0 && (
          <RevealOnScroll delay={0.1}>
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-zinc-600" />
                <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Working notes</h2>
                <span className="text-[10px] text-zinc-700 ml-auto">Auto-pruned after 60 days or 30 notes</span>
              </div>
              <div className="flex flex-col gap-2">
                {[...notes.ephemeral].reverse().map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isFlagged={false}
                    onFlag={() => flagNote(note.id)}
                    onUnflag={() => {}}
                    onDelete={() => deleteNote(note.id)}
                    onEdit={(content) => editNote(note.id, content)}
                  />
                ))}
              </div>
            </section>
          </RevealOnScroll>
        )}

        {/* Empty state */}
        {totalCount === 0 && !isLoading && (
          <RevealOnScroll delay={0.1}>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <StickyNote className="w-5 h-5 text-zinc-700" />
              </div>
              <p className="text-[13px] text-zinc-500 mb-1">No notes yet</p>
              <p className="text-[11.5px] text-zinc-700 max-w-xs leading-relaxed">
                Jot observations, market thoughts, or standing convictions. They feed the Reflect AI so it can connect your thinking to your portfolio.
              </p>
            </div>
          </RevealOnScroll>
        )}

      </div>
    </PageTransition>
  );
}
