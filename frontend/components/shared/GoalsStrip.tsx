"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { useGoals } from "@/hooks/useGoals";
import { formatCurrency } from "@/lib/formatters";

/**
 * Compact, read-only surfacing of the user's goals inside tracker pages.
 * - Always shows each goal's funding progress.
 * - When `monthlySavings` is passed (e.g. on Cash Flow), it also reconciles how
 *   much of that saving is committed to goals vs left unallocated.
 */
export default function GoalsStrip({ monthlySavings }: { monthlySavings?: number }) {
  const { goals } = useGoals();
  if (!goals || goals.length === 0) return null;

  const totalContrib = goals.reduce((s, g) => s + (g.monthly_contribution || 0), 0);
  const unallocated = monthlySavings != null ? monthlySavings - totalContrib : null;

  return (
    <div className="vela-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-vela-teal" />
          <h2 className="text-sm font-semibold text-zinc-200">Goals</h2>
        </div>
        <Link href="/goals" className="text-xs text-vela-teal hover:text-vela-teal transition-colors">
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {goals.slice(0, 6).map((g) => {
          const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
          return (
            <Link
              key={g.id}
              href="/goals"
              className="block rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 p-3 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-zinc-200 font-medium truncate">{g.name}</span>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0 ml-2">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px] text-zinc-500 tabular-nums">
                <span>{formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}</span>
                {g.monthly_contribution > 0 && <span>{formatCurrency(g.monthly_contribution)}/mo</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {monthlySavings != null && totalContrib > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-500">
            Goal funding:{" "}
            <span className="text-zinc-200 tabular-nums">{formatCurrency(totalContrib)}/mo</span>
            {" "}of your{" "}
            <span className="text-zinc-200 tabular-nums">{formatCurrency(monthlySavings)}/mo</span>
            {" "}savings
          </span>
          {unallocated != null && (
            <span className={unallocated >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {unallocated >= 0
                ? `${formatCurrency(unallocated)}/mo unallocated`
                : `${formatCurrency(Math.abs(unallocated))}/mo over your savings`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
