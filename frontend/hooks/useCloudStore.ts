"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { useCallback, useRef } from "react";

/**
 * Cloud-synced JSON store  - replaces localStorage for persistent data.
 *
 * Uses the backend /kv/{key} endpoint with SWR caching.
 * Falls back to localStorage if the API call fails (offline mode).
 *
 * Usage:
 *   const { data, save, isLoading } = useCloudStore<Subscription[]>("subscriptions");
 */

interface KVResponse<T> {
  key: string;
  data: T;
}

export function useCloudStore<T = unknown[]>(key: string) {
  const lsKey = `vela_${key}`;

  // Load from localStorage as fallback
  function loadLocal(): T {
    if (typeof window === "undefined") return [] as unknown as T;
    try {
      return JSON.parse(localStorage.getItem(lsKey) || "[]");
    } catch {
      return [] as unknown as T;
    }
  }

  const { data: response, error, isLoading, mutate } = useSWR<KVResponse<T>>(
    `/kv/${key}`,
    api.get,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      fallbackData: { key, data: loadLocal() },
      onError: () => {
        // Silently fall back to localStorage on API error
      },
    },
  );

  const items = response?.data ?? loadLocal();

  // Debounce ref to avoid rapid successive saves
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (newData: T) => {
      // Optimistic update
      mutate({ key, data: newData }, false);

      // Also save to localStorage as fallback
      try {
        localStorage.setItem(lsKey, JSON.stringify(newData));
      } catch {
        // localStorage full or unavailable
      }

      // Debounced API save (300ms)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await api.put(`/kv/${key}`, { data: newData });
        } catch {
          // API unavailable  - localStorage already has the data
        }
      }, 300);
    },
    [key, lsKey, mutate],
  );

  return {
    data: items,
    save,
    isLoading,
    error,
    isCloud: !error, // true if API is reachable
  };
}
