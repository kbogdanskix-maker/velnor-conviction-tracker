"use client";

import { X, ExternalLink, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { LearningCard as LearningCardType } from "@/lib/learning-cards";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/learning-cards";

interface LearningCardProps {
  card: LearningCardType;
  onDismiss?: (id: string) => void;
  /** Compact mode for dashboard preview */
  compact?: boolean;
}

export default function LearningCard({ card, onDismiss, compact }: LearningCardProps) {
  const colorClass = CATEGORY_COLORS[card.category];

  const content = (
    <div
      className={`vela-card group relative transition-colors ${
        card.link ? "hover:border-zinc-600 cursor-pointer" : ""
      } ${compact ? "p-3" : "p-4"}`}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(card.id);
          }}
          className="absolute top-2 right-2 p-1 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Category badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded border ${colorClass}`}>
          {CATEGORY_LABELS[card.category]}
        </span>
        {card.link && !compact && (
          <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors ml-auto" />
        )}
      </div>

      {/* Title */}
      <div className="flex items-start gap-2">
        {card.emoji && <span className="text-base leading-tight">{card.emoji}</span>}
        <div className="min-w-0">
          <h3 className={`font-medium text-zinc-100 ${compact ? "text-xs" : "text-sm"}`}>
            {card.title}
          </h3>
          <p className={`text-zinc-400 mt-1 leading-relaxed ${compact ? "text-xs line-clamp-2" : "text-sm"}`}>
            {card.body}
          </p>
        </div>
      </div>
    </div>
  );

  if (card.link) {
    return <Link href={card.link}>{content}</Link>;
  }

  return content;
}

/** Horizontal scrollable row of compact cards  - for dashboard */
export function LearningCardRow({
  cards,
  onDismiss,
}: {
  cards: LearningCardType[];
  onDismiss: (id: string) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="section-heading flex items-center gap-2">
          <Lightbulb className="w-4 h-4" /> Insights
        </h2>
        <Link
          href="/learn"
          className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors"
        >
          View all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {cards.map((card) => (
          <div key={card.id} className="min-w-[260px] max-w-[300px] flex-shrink-0">
            <LearningCard card={card} onDismiss={onDismiss} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
