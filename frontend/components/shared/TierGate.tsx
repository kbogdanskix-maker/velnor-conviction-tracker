"use client";

/**
 * TierGate  - wraps any Voyager/Navigator-only feature.
 * Shows an upgrade prompt if the user's tier is insufficient.
 *
 * IMPORTANT: This is UX-only. The real enforcement is on the backend.
 * Never skip the backend require_tier() dependency.
 *
 * Usage:
 *   <TierGate requiredTier="voyager">
 *     <StockScreener />
 *   </TierGate>
 */

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTier } from "@/hooks/useTier";
import { useAdmin } from "@/contexts/AdminContext";

const TIER_RANK: Record<string, number> = { horizon: 0, voyager: 1, navigator: 2 };

const TIER_LABELS: Record<string, string> = {
  voyager: "Voyager",
  navigator: "Navigator",
};

interface TierGateProps {
  requiredTier: "voyager" | "navigator";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function TierGate({ requiredTier, children, fallback }: TierGateProps) {
  const { tier, loading } = useTier();
  const { adminMode } = useAdmin();

  if (loading) return null;

  const userRank = TIER_RANK[tier ?? "horizon"] ?? 0;
  const requiredRank = TIER_RANK[requiredTier];

  if (adminMode || userRank >= requiredRank) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <div className="vela-card flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <Lock className="w-5 h-5 text-zinc-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-100">
          {TIER_LABELS[requiredTier]} feature
        </h3>
        <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">
          Upgrade to {TIER_LABELS[requiredTier]} to unlock this.
        </p>
      </div>
      <Link href="/pricing" className="btn-primary text-sm">
        View plans
      </Link>
    </div>
  );
}
