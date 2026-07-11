/**
 * Journey data layer — conviction trail for a single ticker.
 * Mirrors the backend GET /journey/{ticker} response.
 */
import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

export type JourneyColour = "gain" | "loss" | "amber" | "teal" | "neutral";

export type JourneyState =
  | "in profit"
  | "thesis quiet"
  | "conviction tested"
  | "bear case logged"
  | "underwater"
  | "position open"
  | "watching";

export type JourneyEventKind = "buy" | "sell" | "dividend" | "thesis";

export type ThesisEntryType = "bull" | "bear" | "update" | "note";

export interface JourneyEvent {
  date: string;
  kind: JourneyEventKind;
  colour: JourneyColour;
  title: string;
  detail: string;
  price?: number | null;
  entry_type?: ThesisEntryType;
}

export interface JourneyPosition {
  shares: number;
  avg_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl_pct: number | null;
}

export interface JourneyPricePoint {
  date: string;
  close: number;
}

export interface Journey {
  ticker: string;
  name: string;
  state: JourneyState;
  state_colour: JourneyColour;
  latest_stance: ThesisEntryType | null;
  has_thesis: boolean;
  position: JourneyPosition | null;
  events: JourneyEvent[];
  price_line: JourneyPricePoint[];
}

// ── Colour map ───────────────────────────────────────────────────────────────

/**
 * Maps a JourneyColour token to Tailwind utility classes.
 * - text: foreground text colour
 * - dot: filled dot (background)
 * - chipBg: badge / chip variant
 */
export const COLOUR_CLASS: Record<
  JourneyColour,
  { text: string; dot: string; chipBg: string }
> = {
  gain:    { text: "text-gain",       dot: "bg-gain",       chipBg: "bg-gain/15 text-gain" },
  loss:    { text: "text-loss",       dot: "bg-loss",       chipBg: "bg-loss/15 text-loss" },
  amber:   { text: "text-amber-400",  dot: "bg-amber-400",  chipBg: "bg-amber-400/15 text-amber-400" },
  teal:    { text: "text-vela-teal",  dot: "bg-vela-teal",  chipBg: "bg-vela-teal/15 text-vela-teal" },
  neutral: { text: "text-vela-muted", dot: "bg-vela-muted", chipBg: "bg-white/5 text-vela-muted" },
};

/**
 * Hex colour values for each JourneyColour token.
 * Used for recharts primitives (ReferenceDot, etc.) that require literal hex,
 * not Tailwind class names.
 */
export const COLOUR_HEX: Record<JourneyColour, string> = {
  gain:    "#34D399",
  loss:    "#F43F5E",
  amber:   "#F59E0B",
  teal:    "#1AA8BB",
  neutral: "#8A97AC",
};

// ── Hook ─────────────────────────────────────────────────────────────────────

const fetcher = <T>(path: string) => api.get<T>(path);

/** Fetches the full journey for one ticker. Pass null to skip. */
export function useJourney(ticker: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Journey>(
    ticker ? `/journey/${ticker}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  return { journey: data ?? null, error, isLoading, mutate };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Short display label for a thesis entry type. */
export const ENTRY_TYPE_LABEL: Record<ThesisEntryType, string> = {
  bull:   "Bull",
  bear:   "Bear",
  update: "Update",
  note:   "Note",
};

/**
 * Returns the chip class for a thesis entry_type.
 * Aligns with the ENTRY_TYPE_STYLE from lib/thesis.ts.
 */
export const ENTRY_TYPE_CHIP: Record<ThesisEntryType, string> = {
  bull:   "bg-gain/15 text-gain",
  bear:   "bg-loss/15 text-loss",
  update: "bg-vela-teal/15 text-vela-teal",
  note:   "bg-white/5 text-vela-muted",
};
