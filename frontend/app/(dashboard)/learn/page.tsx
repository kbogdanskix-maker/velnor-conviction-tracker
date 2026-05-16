"use client";

import { useState } from "react";
import { GraduationCap, Sparkles, RotateCcw, Filter } from "lucide-react";
import { useLearningCards } from "@/hooks/useLearningCards";
import LearningCard from "@/components/shared/LearningCard";
import type { CardCategory } from "@/lib/learning-cards";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/learning-cards";
import PageTransition from "@/components/celestial/PageTransition";

const ALL_CATEGORIES: CardCategory[] = [
  "portfolio",
  "tax",
  "income",
  "risk",
  "planning",
  "fundamentals",
];

export default function LearnPage() {
  const { cards, allCards, dismiss, resetDismissed, dismissedCount, ready } =
    useLearningCards();
  const [view, setView] = useState<"personal" | "all">("personal");
  const [categoryFilter, setCategoryFilter] = useState<CardCategory | null>(null);

  const displayCards = view === "personal" ? cards : allCards;
  const filteredCards = categoryFilter
    ? displayCards.filter((c) => c.category === categoryFilter)
    : displayCards;

  // Group by category for the "all" view
  const grouped = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    cards: filteredCards.filter((c) => c.category === cat),
  })).filter((g) => g.cards.length > 0);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-vela-teal" />
            Learn
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Educational insights based on your financial data. For informational purposes only.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          {dismissedCount > 0 && (
            <button
              onClick={resetDismissed}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restore {dismissedCount} dismissed
            </button>
          )}
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            <button
              onClick={() => setView("personal")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "personal"
                  ? "bg-vela-teal/15 text-vela-teal"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              For You
              {cards.length > 0 && (
                <span className="ml-1.5 bg-vela-teal/20 text-vela-teal px-1.5 py-0.5 rounded-full text-[10px]">
                  {cards.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView("all")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "all"
                  ? "bg-vela-teal/15 text-vela-teal"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Browse All
            </button>
          </div>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
            !categoryFilter
              ? "bg-zinc-100 text-zinc-900 border-zinc-100"
              : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = displayCards.filter((c) => c.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(categoryFilter === cat ? null : cat)
              }
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? CATEGORY_COLORS[cat]
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
              }`}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Personal view — flat list sorted by priority */}
      {view === "personal" && (
        <>
          {!ready ? (
            <div className="vela-card text-center py-12">
              <p className="text-zinc-500 text-sm">
                Loading your financial data to generate insights…
              </p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="vela-card text-center py-12 space-y-3">
              <GraduationCap className="w-10 h-10 text-zinc-600 mx-auto" />
              <div>
                <p className="text-zinc-300 font-medium">No insights right now</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {dismissedCount > 0
                    ? "You've dismissed all current insights. Click 'Restore' to bring them back."
                    : "Add more data to your portfolio, net worth, or cash flow to unlock personalized insights."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCards.map((card) => (
                <LearningCard
                  key={card.id}
                  card={card}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Browse all view — grouped by category */}
      {view === "all" && (
        <div className="space-y-8">
          {grouped.length === 0 ? (
            <div className="vela-card text-center py-12">
              <p className="text-zinc-500 text-sm">No cards match this filter.</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="space-y-3">
                <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      CATEGORY_COLORS[group.category].split(" ")[1]
                    }`}
                  />
                  {CATEGORY_LABELS[group.category]}
                  <span className="text-zinc-600">({group.cards.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.cards.map((card) => (
                    <LearningCard key={card.id} card={card} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Educational content only — not personalized financial, tax, or investment advice.
          Consult a qualified professional for decisions specific to your situation.
        </p>
      </div>
    </PageTransition>
  );
}
