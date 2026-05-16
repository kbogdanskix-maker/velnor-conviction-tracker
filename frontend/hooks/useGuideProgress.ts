import { useMemo } from "react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { GUIDE_STEPS, type GuideStep } from "@/lib/guide-steps";
import useSWR from "swr";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface StepStatus {
  step: GuideStep;
  complete: boolean;
}

export interface GuideProgress {
  steps: StepStatus[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  allDone: boolean;
  isLoading: boolean;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useGuideProgress(): GuideProgress {
  const { summary: portfolio, loading: portfolioLoading } = useDefaultPortfolio();
  const { summary: nw, isLoading: nwLoading } = useNetWorthSummary();
  const { summary: cf, isLoading: cfLoading } = useCashFlowSummary();
  const { goals, isLoading: goalsLoading } = useGoals();
  const { data: watchlist, isLoading: wlLoading } = useSWR<any[]>(
    "/watchlist",
    () => api.get("/watchlist").then((r: any) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const isLoading = portfolioLoading || nwLoading || cfLoading || goalsLoading || wlLoading;

  const steps = useMemo((): StepStatus[] => {
    const completionMap: Record<string, boolean> = {
      portfolio: !!portfolio?.holdings?.length,
      "net-worth": (nw?.total_assets ?? 0) > 0 || (nw?.total_liabilities ?? 0) > 0,
      "cash-flow": (cf?.total_income ?? 0) > 0 || (cf?.total_expenses ?? 0) > 0,
      goals: !!goals?.length,
      watchlist: !!watchlist?.length,
    };

    return GUIDE_STEPS.map((step) => ({
      step,
      complete: completionMap[step.id] ?? false,
    }));
  }, [portfolio, nw, cf, goals, watchlist]);

  const completedCount = steps.filter((s) => s.complete).length;
  const totalCount = steps.length;

  return {
    steps,
    completedCount,
    totalCount,
    percentComplete: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    allDone: completedCount === totalCount,
    isLoading,
  };
}
