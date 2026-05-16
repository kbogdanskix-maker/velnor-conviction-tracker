"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Loader2, Target, Sunset, GraduationCap, Home, Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { GOAL_PRESETS, type GoalPreset } from "@/lib/goal-presets";
import type { GoalCreate, Goal } from "@/hooks/useGoals";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  target: Target,
  sunset: Sunset,
  "graduation-cap": GraduationCap,
  home: Home,
  shield: Shield,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editGoal?: Goal | null;
}

function defaultDate(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default function AddGoalModal({ open, onOpenChange, onSuccess, editGoal }: Props) {
  const isEdit = !!editGoal;

  // Step: "preset" (pick template) or "form" (fill details)
  const [step, setStep] = useState<"preset" | "form">(isEdit ? "form" : "preset");
  const [selectedPreset, setSelectedPreset] = useState<GoalPreset | null>(null);

  // Form state
  const [name, setName] = useState(editGoal?.name ?? "");
  const [icon, setIcon] = useState(editGoal?.icon ?? "target");
  const [targetAmount, setTargetAmount] = useState(editGoal ? String(editGoal.target_amount) : "");
  const [currentAmount, setCurrentAmount] = useState(editGoal ? String(editGoal.current_amount) : "0");
  const [monthlyContribution, setMonthlyContribution] = useState(editGoal ? String(editGoal.monthly_contribution) : "");
  const [cagr, setCagr] = useState(editGoal ? String(editGoal.cagr) : "7");
  const [targetDate, setTargetDate] = useState(editGoal?.target_date ?? defaultDate(10));
  const [notes, setNotes] = useState(editGoal?.notes ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePresetSelect(preset: GoalPreset) {
    setSelectedPreset(preset);
    setName(preset.key === "custom" ? "" : preset.label);
    setIcon(preset.icon);
    setCagr(String(preset.defaultCagr));
    setTargetDate(defaultDate(preset.defaultYears));
    setStep("form");
  }

  function resetForm() {
    setStep(isEdit ? "form" : "preset");
    setSelectedPreset(null);
    setName(editGoal?.name ?? "");
    setIcon(editGoal?.icon ?? "target");
    setTargetAmount(editGoal ? String(editGoal.target_amount) : "");
    setCurrentAmount(editGoal ? String(editGoal.current_amount) : "0");
    setMonthlyContribution(editGoal ? String(editGoal.monthly_contribution) : "");
    setCagr(editGoal ? String(editGoal.cagr) : "7");
    setTargetDate(editGoal?.target_date ?? defaultDate(10));
    setNotes(editGoal?.notes ?? "");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: GoalCreate = {
      name: name.trim(),
      icon,
      target_amount: Number(targetAmount),
      current_amount: Number(currentAmount) || 0,
      monthly_contribution: Number(monthlyContribution) || 0,
      cagr: Number(cagr),
      target_date: targetDate,
      notes: notes.trim() || null,
    };

    try {
      if (isEdit && editGoal) {
        await api.patch(`/goals/${editGoal.id}`, body);
      } else {
        await api.post("/goals", body);
      }
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save goal";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-vela-card border border-vela-border rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-vela-border">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              {isEdit ? "Edit Goal" : step === "preset" ? "New Goal" : name || "New Goal"}
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {step === "preset" ? (
            /* ── Preset Selection ─────────────────────────────────── */
            <div className="p-5 space-y-2">
              <p className="text-sm text-zinc-400 mb-3">What are you saving for?</p>
              {GOAL_PRESETS.map((preset) => {
                const Icon = ICON_MAP[preset.icon] ?? Target;
                return (
                  <button
                    key={preset.key}
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-vela-border hover:border-zinc-600 hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-vela-teal/15 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-vela-teal" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{preset.label}</p>
                      <p className="text-xs text-zinc-500">{preset.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Form ─────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setStep("preset")}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  &larr; Back to presets
                </button>
              )}

              {/* Name */}
              <div>
                <label className="text-sm text-zinc-400 font-medium">Goal Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. House Down Payment"
                  className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors"
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="text-sm text-zinc-400 font-medium">Target Amount</label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                  min="1"
                  step="any"
                  placeholder="50000"
                  className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors tabular"
                />
              </div>

              {/* Current Amount + Monthly Contribution */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400 font-medium">Saved so far</label>
                  <input
                    type="number"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    min="0"
                    step="any"
                    placeholder="0"
                    className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors tabular"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 font-medium">Monthly saving</label>
                  <input
                    type="number"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                    min="0"
                    step="any"
                    placeholder="500"
                    className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors tabular"
                  />
                </div>
              </div>

              {/* CAGR + Target Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400 font-medium">
                    Expected Return
                    <span className="text-zinc-600 ml-1">%/yr</span>
                  </label>
                  <input
                    type="number"
                    value={cagr}
                    onChange={(e) => setCagr(e.target.value)}
                    min="0"
                    max="30"
                    step="0.5"
                    className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors tabular"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 font-medium">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-vela-teal transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-zinc-400 font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes..."
                  className="mt-1 w-full bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-vela-teal transition-colors resize-none"
                />
              </div>

              {error && <p className="text-sm text-loss">{error}</p>}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !name.trim() || !targetAmount}
                className="w-full bg-vela-teal hover:bg-vela-teal-dim text-zinc-950 font-medium py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Goal"}
              </button>

              {/* Disclaimer */}
              <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
                This is not financial advice. Projections are hypothetical and do not guarantee future results.
              </p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
