"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

export interface MacroSeries {
  series_id: string;
  name: string;
  value: number | null;
  date: string | null;
  unit: string;
  context: string;
}

export interface MacroDashboard {
  yields: MacroSeries[];
  inflation: MacroSeries[];
  fed: MacroSeries[];
  updated_at: string;
}

export interface FedMinutesItem {
  title: string;
  url: string;
  published: string;
  summary: string | null;
}

export function useMacroDashboard() {
  const { data, error, isLoading } = useSWR<MacroDashboard>(
    "/macro/dashboard",
    api.get,
    { revalidateOnFocus: false, refreshInterval: 30 * 60 * 1000 },
  );

  return { data: data ?? null, error, isLoading };
}

export function useFedMinutes() {
  const { data, error, isLoading } = useSWR<{ items: FedMinutesItem[] }>(
    "/macro/fed-minutes",
    api.get,
    { revalidateOnFocus: false, refreshInterval: 60 * 60 * 1000 },
  );

  return { items: data?.items ?? [], error, isLoading };
}
