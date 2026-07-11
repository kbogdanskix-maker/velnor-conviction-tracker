/**
 * Conviction Calibration data layer.
 * Consumes GET /api/v1/calibration — the deterministic, backward-looking
 * investor-accuracy scorecard (how logged conviction mapped to real outcomes,
 * plus sell-timing in hindsight). No AI, no forward projection.
 */
import useSWR from "swr";
import { api } from "@/lib/api";

export interface ConvictionBucket {
  conviction: number; // 1-5
  reviewed: number;
  wins: number;
  hit_rate: number | null; // percent
}

export interface CalibrationJournal {
  total_logged: number;
  total_reviewed: number;
  overall_hit_rate: number | null;
  by_conviction: ConvictionBucket[];
  /** Observation: did the top conviction bucket win more than the lowest? */
  higher_conviction_wins_more: boolean | null;
}

export interface CalibrationSells {
  count: number;
  /** Positive avg = your sells tended to be followed by gains (sold early). */
  avg_since_sold_pct: number | null;
  sold_before_gains: number;
  dodged_drops: number;
  median_realized_pct: number | null;
}

export interface Calibration {
  journal: CalibrationJournal;
  sells: CalibrationSells;
}

const fetcher = <T>(path: string) => api.get<T>(path);

export function useCalibration() {
  const { data, error, isLoading, mutate } = useSWR<Calibration>(
    "/calibration",
    fetcher,
  );
  return { data, error, isLoading, mutate };
}
