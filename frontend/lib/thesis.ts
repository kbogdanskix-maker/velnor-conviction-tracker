/**
 * Thesis data layer — the versioned conviction notebook.
 * Mirrors the backend `/thesis` API (routers/thesis.py). Every edit appends a new
 * entry; threads are never overwritten, so a thread is a conviction trail.
 */
import useSWR from "swr";
import { api } from "@/lib/api";

export type ThesisEntryType = "bull" | "bear" | "update" | "note";

export interface ThesisEntry {
  id: string;
  body: string;
  entry_type: ThesisEntryType;
  created_at: string;
}

export interface ThesisThreadSummary {
  id: string;
  ticker: string;
  title: string;
  created_at: string;
  updated_at: string;
  entry_count: number;
  latest_entry_type: ThesisEntryType | null;
}

export interface ThesisThread {
  id: string;
  ticker: string;
  title: string;
  created_at: string;
  updated_at: string;
  entries: ThesisEntry[];
}

export interface CreateThreadInput {
  ticker: string;
  title: string;
  initial_body?: string;
  entry_type?: ThesisEntryType;
}

const fetcher = <T>(path: string) => api.get(path) as Promise<T>;

/** All thesis threads (lightweight summaries), most-recently-updated first. */
export function useThesisList() {
  const { data, error, isLoading, mutate } = useSWR<ThesisThreadSummary[]>("/thesis", fetcher);
  return { threads: data ?? [], error, isLoading, mutate };
}

/** One thread with its full entry trail. Pass null to skip fetching. */
export function useThesisThread(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ThesisThread>(
    id ? `/thesis/${id}` : null,
    fetcher,
  );
  return { thread: data, error, isLoading, mutate };
}

export function createThread(input: CreateThreadInput): Promise<ThesisThread> {
  return api.post("/thesis", input) as Promise<ThesisThread>;
}

/** Append a new entry — this is how a conviction evolves. */
export function addEntry(
  threadId: string,
  input: { body: string; entry_type?: ThesisEntryType },
): Promise<ThesisEntry> {
  return api.post(`/thesis/${threadId}/entries`, input) as Promise<ThesisEntry>;
}

export function deleteThread(threadId: string): Promise<void> {
  return api.delete(`/thesis/${threadId}`) as Promise<void>;
}

/** Entry-type → semantic style (design-system: bull=gain, bear=loss, else neutral/teal). */
export const ENTRY_TYPE_STYLE: Record<ThesisEntryType, { label: string; className: string }> = {
  bull: { label: "Bull", className: "bg-gain/15 text-gain" },
  bear: { label: "Bear", className: "bg-loss/15 text-loss" },
  update: { label: "Update", className: "bg-vela-teal/15 text-vela-teal" },
  note: { label: "Note", className: "bg-white/5 text-vela-muted" },
};
