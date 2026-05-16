"use client";

import { useState } from "react";
import { Plus, Target, Download } from "lucide-react";
import { useGoals, type Goal } from "@/hooks/useGoals";
import { exportCSV } from "@/lib/export";
import { formatCurrency } from "@/lib/formatters";
import GoalCard from "@/components/goals/GoalCard";
import AddGoalModal from "@/components/goals/AddGoalModal";
import GoalDetailPanel from "@/components/goals/GoalDetailPanel";
import ConfirmDeleteGoalDialog from "@/components/goals/ConfirmDeleteGoalDialog";
import PageTransition, { MotionSection } from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";

export default function GoalsPage() {
  const { goals, isLoading, mutate, isEmpty } = useGoals();

  // Modal state
  const [addOpen, setAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null);

  function handleSuccess() {
    mutate();
  }

  if (isLoading) return <LoadingSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-zinc-100">Goals</h1>
        <div className="flex items-center gap-2">
          {goals.length > 0 && (
            <button
              onClick={() =>
                exportCSV(
                  goals.map((g) => ({
                    Name: g.name,
                    Target: g.target_amount,
                    Current: g.current_amount,
                    "Progress %": g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) : "0.0",
                    Deadline: g.target_date ?? "",
                    "Monthly Contribution": g.monthly_contribution ?? "",
                  })),
                  `vela-goals-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          <button
            onClick={() => { setEditGoal(null); setAddOpen(true); }}
            className="flex items-center gap-1.5 bg-vela-teal hover:bg-vela-teal-dim text-zinc-950 font-medium px-3 py-1.5 rounded-md text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Goal
          </button>
        </div>
      </div>

      {isEmpty ? (
        /* ── Empty state ──────────────────────────────────────── */
        <div className="vela-card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-vela-teal/10 flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-vela-teal" />
          </div>
          <h2 className="text-base font-medium text-zinc-100 mb-1">
            No goals yet
          </h2>
          <p className="text-sm text-zinc-500 max-w-xs mb-4">
            Set a financial goal and track your progress with projections.
          </p>
          <button
            onClick={() => { setEditGoal(null); setAddOpen(true); }}
            className="flex items-center gap-1.5 bg-vela-teal hover:bg-vela-teal-dim text-zinc-950 font-medium px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first goal
          </button>
        </div>
      ) : (
        /* ── Goal cards grid ──────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onClick={() => setDetailGoal(goal)}
              onEdit={() => { setEditGoal(goal); setAddOpen(true); }}
              onDelete={() => setDeleteGoal(goal)}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {!isEmpty && (
        <p className="text-[11px] text-zinc-600 text-center">
          Projections are hypothetical and do not constitute financial advice.
        </p>
      )}

      {/* Modals */}
      <AddGoalModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleSuccess}
        editGoal={editGoal}
      />

      <GoalDetailPanel
        goal={detailGoal}
        open={!!detailGoal}
        onOpenChange={(v) => { if (!v) setDetailGoal(null); }}
      />

      <ConfirmDeleteGoalDialog
        goal={deleteGoal}
        open={!!deleteGoal}
        onOpenChange={(v) => { if (!v) setDeleteGoal(null); }}
        onSuccess={handleSuccess}
      />
    </PageTransition>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-20" />
        <div className="skeleton h-9 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="vela-card space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-full" />
              <div>
                <div className="skeleton h-4 w-28 mb-1" />
                <div className="skeleton h-3 w-16" />
              </div>
            </div>
            <div className="skeleton h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
