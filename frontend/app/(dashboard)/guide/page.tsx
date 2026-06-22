"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass, CheckCircle2, Circle, ChevronDown, ChevronRight,
  ArrowRight, Lightbulb, Rocket,
} from "lucide-react";
import { useGuideProgress } from "@/hooks/useGuideProgress";
import { FEATURE_MAP, QUICK_TIPS } from "@/lib/guide-steps";
import PageTransition from "@/components/celestial/PageTransition";

// ── Page ────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const { steps, completedCount, totalCount, percentComplete, allDone, isLoading } =
    useGuideProgress();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  function toggleGroup(label: string) {
    setExpandedGroup((prev) => (prev === label ? null : label));
  }

  return (
    <PageTransition className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Compass className="w-7 h-7 text-vela-teal" />
          Getting Started
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Set up your financial dashboard in 5 steps, then explore 40+ tools.
        </p>
      </div>

      {/* ─── Section 1: Onboarding Checklist ─────────────────────────────── */}
      <div className="vela-card space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-vela-teal" />
            <h2 className="text-sm font-medium text-zinc-200">Setup Checklist</h2>
          </div>
          <span className="text-xs text-zinc-500">
            {completedCount} of {totalCount} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${percentComplete}%`,
              background: allDone
                ? "linear-gradient(90deg, #34d399, #1AA8BB)"
                : "linear-gradient(90deg, #1AA8BB, #6366f1)",
            }}
          />
        </div>

        {allDone && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            All set! Your dashboard is fully powered.
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {steps.map(({ step, complete }) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                complete
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {complete ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <step.icon className={`w-4 h-4 ${complete ? "text-emerald-400" : "text-vela-teal"}`} />
                  <h3
                    className={`text-sm font-medium ${
                      complete ? "text-emerald-400 line-through decoration-emerald-400/40" : "text-zinc-200"
                    }`}
                  >
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* CTA */}
              {!complete && (
                <Link
                  href={step.href}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-vela-teal hover:text-vela-teal-dim transition-colors"
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section 2: Feature Map ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Explore Features</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Click a category to see every tool available.
          </p>
        </div>

        <div className="space-y-2">
          {FEATURE_MAP.map((group) => {
            const isOpen = expandedGroup === group.label;
            return (
              <div key={group.label} className="vela-card overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between p-0 text-left"
                >
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200">{group.label}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {group.description} &middot; {group.items.length} tools
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-zinc-800/60 transition-colors group"
                      >
                        <item.icon className="w-4 h-4 text-zinc-500 group-hover:text-vela-teal transition-colors shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-200 group-hover:text-zinc-100">
                              {item.label}
                            </span>
                            {item.tier && (
                              <span className="text-[9px] uppercase tracking-wider font-semibold bg-vela-teal/15 text-vela-teal px-1.5 py-0.5 rounded">
                                {item.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{item.description}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-vela-teal opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Section 3: Quick Tips ───────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-medium text-zinc-200">Pro Tips</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_TIPS.map((tip) => {
            const content = (
              <div className="vela-card hover:border-zinc-700 transition-colors h-full">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{tip.emoji}</span>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200">{tip.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                </div>
              </div>
            );

            return tip.href ? (
              <Link key={tip.title} href={tip.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={tip.title}>{content}</div>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Velnor is a personal finance dashboard. All data stays in your account. Not financial advice.
        </p>
      </div>
    </PageTransition>
  );
}
