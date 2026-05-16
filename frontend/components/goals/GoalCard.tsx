"use client";

import { motion } from "framer-motion";
import {
  Target, Sunset, GraduationCap, Home, Shield,
  PiggyBank, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatCurrency } from "@/lib/formatters";
import type { Goal } from "@/hooks/useGoals";
import { monthsUntil } from "@/hooks/useGoals";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  target: Target,
  sunset: Sunset,
  "graduation-cap": GraduationCap,
  home: Home,
  shield: Shield,
  "piggy-bank": PiggyBank,
};

interface Props {
  goal: Goal;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function GoalCard({ goal, onClick, onEdit, onDelete }: Props) {
  const Icon = ICON_MAP[goal.icon] ?? Target;
  const progress = goal.target_amount > 0
    ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100)
    : 0;
  const months = monthsUntil(goal.target_date);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  const timeLabel = years > 0
    ? remainingMonths > 0 ? `${years}y ${remainingMonths}m left` : `${years}y left`
    : months > 0 ? `${months}m left` : "Past due";

  // Compute on-track: compare progress to elapsed time fraction
  const totalDuration = (() => {
    const created = new Date(goal.created_at);
    const target = new Date(goal.target_date);
    return Math.max(1, (target.getFullYear() - created.getFullYear()) * 12 + (target.getMonth() - created.getMonth()));
  })();
  const elapsed = Math.max(0, totalDuration - months);
  const expectedProgress = (elapsed / totalDuration) * 100;
  const onTrack = progress >= expectedProgress;

  return (
    <div
      onClick={onClick}
      className="vela-card cursor-pointer hover:border-zinc-600 transition-colors group relative"
    >
      {/* Action dropdown */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="min-w-[120px] bg-zinc-800 border border-zinc-700 rounded-md shadow-xl py-1 z-50"
            >
              <DropdownMenu.Item
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 cursor-pointer outline-none"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-loss hover:bg-zinc-700 cursor-pointer outline-none"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Icon + Name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-vela-teal/15 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-vela-teal" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-zinc-100 truncate">{goal.name}</h3>
          <p className="text-xs text-zinc-500">{timeLabel}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-vela-teal"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Amount row */}
      <div className="flex items-baseline justify-between">
        <span className="text-sm tabular font-medium text-zinc-100">
          {formatCurrency(goal.current_amount)}
        </span>
        <span className="text-xs tabular text-zinc-500">
          of {formatCurrency(goal.target_amount)}
        </span>
      </div>

      {/* Progress percentage */}
      <p className="text-xs text-zinc-500 mt-1">
        {progress.toFixed(0)}% complete
      </p>
    </div>
  );
}
