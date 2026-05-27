"use client";

import { useEffect, useRef, useState } from "react";
import { useCloudStore } from "./useCloudStore";

export interface ReflectionNote {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ReflectionNotesStore {
  flagged: ReflectionNote[];
  ephemeral: ReflectionNote[];
}

const EPHEMERAL_MAX = 30;
const EPHEMERAL_MAX_AGE_DAYS = 60;

function pruneEphemeral(notes: ReflectionNote[]): ReflectionNote[] {
  const cutoff = Date.now() - EPHEMERAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = notes.filter((n) => new Date(n.created_at).getTime() > cutoff);
  // Keep most recent EPHEMERAL_MAX
  return fresh.slice(-EPHEMERAL_MAX);
}

export function useReflectionNotes() {
  const { data, save, isLoading } = useCloudStore<ReflectionNotesStore>("reflection_notes");
  const [notes, setNotes] = useState<ReflectionNotesStore>({ flagged: [], ephemeral: [] });
  const synced = useRef(false);

  useEffect(() => {
    if (data && !synced.current) {
      const pruned: ReflectionNotesStore = {
        flagged: data.flagged ?? [],
        ephemeral: pruneEphemeral(data.ephemeral ?? []),
      };
      setNotes(pruned);
      synced.current = true;
    }
  }, [data]);

  function persist(updated: ReflectionNotesStore) {
    setNotes(updated);
    save(updated);
  }

  function addFlagged(content: string) {
    if (!content.trim()) return;
    const note: ReflectionNote = {
      id: crypto.randomUUID(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persist({
      ...notes,
      flagged: [...notes.flagged, note],
    });
  }

  function addEphemeral(content: string) {
    if (!content.trim()) return;
    const note: ReflectionNote = {
      id: crypto.randomUUID(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated: ReflectionNotesStore = {
      ...notes,
      ephemeral: pruneEphemeral([...notes.ephemeral, note]),
    };
    persist(updated);
  }

  function flagNote(id: string) {
    const note = notes.ephemeral.find((n) => n.id === id);
    if (!note) return;
    persist({
      flagged: [...notes.flagged, { ...note, updated_at: new Date().toISOString() }],
      ephemeral: notes.ephemeral.filter((n) => n.id !== id),
    });
  }

  function unflagNote(id: string) {
    const note = notes.flagged.find((n) => n.id === id);
    if (!note) return;
    persist({
      flagged: notes.flagged.filter((n) => n.id !== id),
      ephemeral: pruneEphemeral([...notes.ephemeral, { ...note, updated_at: new Date().toISOString() }]),
    });
  }

  function deleteNote(id: string) {
    persist({
      flagged: notes.flagged.filter((n) => n.id !== id),
      ephemeral: notes.ephemeral.filter((n) => n.id !== id),
    });
  }

  function editNote(id: string, content: string) {
    if (!content.trim()) return;
    const updated_at = new Date().toISOString();
    persist({
      flagged: notes.flagged.map((n) => n.id === id ? { ...n, content: content.trim(), updated_at } : n),
      ephemeral: notes.ephemeral.map((n) => n.id === id ? { ...n, content: content.trim(), updated_at } : n),
    });
  }

  // Recent ephemeral = last 14 days or last 10, whichever is smaller
  const recentEphemeral = (() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return notes.ephemeral
      .filter((n) => new Date(n.created_at).getTime() > cutoff)
      .slice(-10);
  })();

  return {
    notes,
    recentEphemeral,
    addFlagged,
    addEphemeral,
    flagNote,
    unflagNote,
    deleteNote,
    editNote,
    isLoading,
  };
}
