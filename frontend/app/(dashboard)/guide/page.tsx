"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, ChevronDown, ChevronRight, ArrowRight,
  Command, SlidersHorizontal, GraduationCap, UserCheck, Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGuideProgress } from "@/hooks/useGuideProgress";
import { FEATURE_MAP, QUICK_TIPS } from "@/lib/guide-steps";
import PageTransition from "@/components/celestial/PageTransition";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Eyebrow,
  Prose,
} from "@/components/instrument";

/**
 * Emoji are banned as icons by the design system, and `lib/guide-steps.ts` still
 * ships an `emoji` field on each quick tip. Tips carry no id, so the map is keyed
 * by tip title; anything unmapped falls back to a lightbulb.
 */
const TIP_ICONS: Record<string, LucideIcon> = {
  "Command Palette": Command,
  "Animation Settings": SlidersHorizontal,
  "Financial Education": GraduationCap,
  "Advisor Recommendations": UserCheck,
};

const TOOL_COUNT = FEATURE_MAP.reduce((n, g) => n + g.items.length, 0);

// ── Page ────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const { steps, completedCount, totalCount, percentComplete, allDone, isLoading } =
    useGuideProgress();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  function toggleGroup(label: string) {
    setExpandedGroup((prev) => (prev === label ? null : label));
  }

  const remaining = totalCount - completedCount;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Velnor" }, { label: "Guide" }]}
        note={
          isLoading
            ? "reading your account"
            : allDone
              ? "setup complete"
              : `${completedCount} of ${totalCount} steps done`
        }
      />

      <PageHero
        title="Getting started"
        meta={`${totalCount} steps to a working workspace, then ${TOOL_COUNT} tools beyond it`}
        figure={isLoading ? undefined : `${percentComplete}%`}
        figureSub={isLoading ? undefined : allDone ? "all set" : `${remaining} left`}
        figureSubClass={allDone ? "text-gain" : "text-vela-body"}
      />

      {!isLoading && (
        <StatStrip className="mt-6">
          <StatCell
            label="Steps done"
            value={`${completedCount}/${totalCount}`}
            valueClass={allDone ? "text-gain" : "text-zinc-100"}
            sub={allDone ? "nothing outstanding" : `${remaining} remaining`}
          />
          <StatCell label="Tools" value={TOOL_COUNT} sub={`${FEATURE_MAP.length} groups`} />
          <StatCell label="Shortcuts" value={QUICK_TIPS.length} sub="worth knowing" />
        </StatStrip>
      )}

      {/* ─── Setup checklist ──────────────────────────────────────────────── */}

      <Section
        label="Setup"
        labelAside={isLoading ? undefined : `— ${completedCount}/${totalCount}`}
        prose="Each step feeds something downstream. The more of your picture the app holds, the less of it you have to restate later."
      >
        {/* Progress rail */}
        <div className="mb-6">
          <div className="h-[3px] w-full bg-vela-border">
            <div
              className={`h-full transition-[width] duration-500 ease-out ${
                allDone ? "bg-gain" : "bg-vela-teal"
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-vela-muted">
            {completedCount} of {totalCount} complete
          </p>
        </div>

        <div className="divide-y divide-vela-border border-y border-vela-border">
          {steps.map(({ step, complete }) => (
            <div
              key={step.id}
              className="flex items-start gap-3.5 py-4 transition-colors hover:bg-vela-teal/[0.03]"
            >
              {/* Status marker */}
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {complete ? (
                  <Check className="h-4 w-4 text-gain" aria-label="complete" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-[7px] w-[7px] rotate-45 border border-vela-muted"
                  />
                )}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <step.icon
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 ${complete ? "text-gain" : "text-vela-teal"}`}
                  />
                  <h3
                    className={`text-[14px] font-medium leading-snug ${
                      complete ? "text-vela-muted" : "text-zinc-100"
                    }`}
                  >
                    {step.title}
                  </h3>
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-vela-body">
                  {step.description}
                </p>
              </div>

              {/* CTA */}
              {!complete ? (
                <Link
                  href={step.href}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded border border-vela-teal/25 bg-vela-teal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:border-vela-teal/40 hover:bg-vela-teal/15"
                >
                  <span className="hidden sm:inline">{step.cta}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                </Link>
              ) : (
                <span className="mt-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-gain">
                  Done
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Feature map ──────────────────────────────────────────────────── */}

      <Section
        label="Everything else"
        labelAside={`— ${TOOL_COUNT} tools`}
        prose="Open a group to see what sits inside it. Nothing here is required to use the core workflow."
      >
        <div className="divide-y divide-vela-border border-y border-vela-border">
          {FEATURE_MAP.map((group) => {
            const isOpen = expandedGroup === group.label;
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-vela-teal/[0.03]"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-semibold text-zinc-100">
                      {group.label}
                    </h3>
                    <p className="mt-1 text-[13px] leading-[1.5] text-vela-body">
                      {group.description}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-vela-muted">
                      {group.items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-vela-muted" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-vela-muted" aria-hidden="true" />
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-vela-border pb-4 pl-0 sm:pl-5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-vela-teal/[0.03]"
                      >
                        <item.icon
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-vela-muted transition-colors group-hover:text-vela-teal"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-medium text-zinc-100">
                              {item.label}
                            </span>
                            {item.tier && (
                              <span className="rounded bg-vela-teal/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-vela-teal">
                                {item.tier}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12.5px] leading-snug text-vela-body">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-vela-subtle transition-colors group-hover:text-vela-teal"
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Quick tips ───────────────────────────────────────────────────── */}

      <Section
        label="Worth knowing"
        prose="Small things that make the app quicker to live in."
      >
        <div className="grid grid-cols-1 gap-px border border-vela-border bg-vela-border sm:grid-cols-2">
          {QUICK_TIPS.map((tip) => {
            const Icon = TIP_ICONS[tip.title] ?? Lightbulb;
            const body = (
              <div className="flex h-full items-start gap-3 bg-vela-bg p-4 transition-colors group-hover:bg-vela-teal/[0.03]">
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-vela-teal"
                />
                <div className="min-w-0">
                  <h3 className="text-[13.5px] font-medium text-zinc-100">{tip.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-vela-body">
                    {tip.description}
                  </p>
                </div>
              </div>
            );

            return tip.href ? (
              <Link key={tip.title} href={tip.href} className="group block">
                {body}
              </Link>
            ) : (
              <div key={tip.title} className="group">
                {body}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Disclaimer ───────────────────────────────────────────────────── */}

      <Section label="Scope">
        <Eyebrow>What this app is</Eyebrow>
        <Prose className="mt-2.5 max-w-[560px]">
          Velnor is a record-keeping and research workspace for your own money. Your data stays in your
          account. Nothing here is investment advice, and nothing here is a recommendation to buy or
          sell any security.
        </Prose>
      </Section>
    </PageTransition>
  );
}
