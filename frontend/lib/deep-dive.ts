/**
 * Deep Dive data layer.
 *
 * Consumes /api/v1/deep-dive — an equity-research-style briefing on one ticker,
 * researched with live web search and stored as structured JSON. One run per
 * user per cooldown window, so the UI polls a queued report rather than
 * streaming it: a run takes minutes.
 *
 * The report is deliberately ordered facts-first, thesis-check-last. Render it
 * in that order; the point is that the user reads the sourced record before
 * they read their own reasoning measured against it.
 */
import useSWR from "swr";
import { api } from "@/lib/api";

// ── Report shape (mirrors services/deep_dive.REPORT_SCHEMA) ──────────────────

export interface CitedPoint {
  point: string;
  source_url: string;
}

export interface Development {
  date: string;
  headline: string;
  detail: string;
  why_it_connects: string;
  source_url: string;
  source_title: string;
}

export interface ResultVsExpectation {
  period: string;
  metric: string;
  reported: string;
  expected: string;
  source_url: string;
}

export interface UpcomingEvent {
  date: string;
  event: string;
  detail: string;
  source_url: string;
}

export interface ExhibitPoint {
  label: string;
  value: number;
}

export interface Exhibit {
  title: string;
  kind: "bar" | "line";
  unit: string;
  note: string;
  source_url: string;
  points: ExhibitPoint[];
}

/**
 * How a line of the user's own recorded reasoning sits against the sourced
 * record. A statement about their reasoning, never about the security.
 */
export type ThesisRelation = "consistent" | "diverges" | "not_yet_addressed";

export interface ThesisObservation {
  you_wrote: string;
  written_on: string;
  what_the_record_shows: string;
  source_url: string;
  relation: ThesisRelation;
}

export interface ThesisCheck {
  has_thesis: boolean;
  summary: string;
  observations: ThesisObservation[];
}

export interface Source {
  title: string;
  url: string;
  publisher: string;
}

export interface DeepDiveBody {
  ticker: string;
  company_name: string;
  as_of: string;
  headline: string;
  key_takeaways: CitedPoint[];
  business_snapshot: string;
  recent_developments: Development[];
  results_vs_expectations: ResultVsExpectation[];
  upcoming_events: UpcomingEvent[];
  exhibits: Exhibit[];
  risks_flagged_by_sources: CitedPoint[];
  thesis_check: ThesisCheck;
  sources: Source[];
  limitations: string[];
}

export type DeepDiveStatus = "queued" | "running" | "complete" | "failed";

export interface DeepDiveReport {
  id: string;
  ticker: string;
  status: DeepDiveStatus;
  report: DeepDiveBody | null;
  error: string | null;
  model: string | null;
  requested_at: string | null;
  completed_at: string | null;
  usage: {
    input_tokens: number | null;
    output_tokens: number | null;
    web_searches: number | null;
  };
}

export interface DeepDiveEligibility {
  available: boolean;
  cooldown_days: number;
  next_available_at: string | null;
  last_ticker: string | null;
  in_progress: boolean;
}

// ── Display helpers ──────────────────────────────────────────────────────────

/**
 * Neutral labels. These describe the relationship between what the user wrote
 * and what the record shows. They must never read as a verdict on the holding,
 * so no "broken", "wrong", "confirmed", or anything with a directional charge.
 */
export const RELATION_LABEL: Record<ThesisRelation, string> = {
  consistent: "Lines up",
  diverges: "Differs",
  not_yet_addressed: "Nothing on it yet",
};

export const RELATION_CLASS: Record<ThesisRelation, string> = {
  consistent: "text-gain",
  diverges: "text-amber-400",
  not_yet_addressed: "text-vela-muted",
};

/** Hostname of a source URL, for a compact inline citation. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────────

const fetcher = <T>(path: string) => api.get<T>(path);

export function useDeepDiveEligibility() {
  const { data, error, isLoading, mutate } = useSWR<DeepDiveEligibility>(
    "/deep-dive/eligibility",
    fetcher,
    { revalidateOnFocus: false },
  );
  return { eligibility: data, error, isLoading, mutate };
}

export function useDeepDives() {
  const { data, error, isLoading, mutate } = useSWR<DeepDiveReport[]>(
    "/deep-dive",
    fetcher,
    { revalidateOnFocus: false },
  );
  return { reports: data ?? [], error, isLoading, mutate };
}

/**
 * One report. Polls every 10s while the run is queued or still going, then
 * stops — a completed report never changes, so there is nothing to refetch.
 */
export function useDeepDive(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DeepDiveReport>(
    id ? `/deep-dive/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: (latest) =>
        latest && (latest.status === "queued" || latest.status === "running") ? 10_000 : 0,
    },
  );
  return { report: data, error, isLoading, mutate };
}

export async function requestDeepDive(ticker: string): Promise<DeepDiveReport> {
  return api.post<DeepDiveReport>(`/deep-dive/${ticker.toUpperCase().trim()}`, {});
}
