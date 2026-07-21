"use client";

/**
 * Instrument kit — the shared primitives of the Velnor "instrument" editorial
 * pattern, extracted from the Velnor Stock Journey template so every page
 * composes the same parts instead of copy-pasting class strings.
 *
 * Contrast rule (recurring bug): readable copy is `vela-body`, mono micro-labels
 * are `vela-muted`. `vela-subtle` is decoration only (separators, inactive
 * glyphs) and must never carry text the user has to read.
 */

import React from "react";
import Link from "next/link";

// ── Micro-labels ──────────────────────────────────────────────────────────────

/** Mono uppercase micro-label — the signature instrument eyebrow. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted ${className}`}>
      {children}
    </p>
  );
}

/** Wider-tracked mono label that heads a page section. */
export function SectionLabel({
  children,
  aside,
  className = "",
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-vela-muted ${className}`}
    >
      {children}
      {aside != null && <span className="ml-2 text-vela-muted/70">{aside}</span>}
    </h2>
  );
}

/** Body prose at the template's readable weight. */
export function Prose({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[13.5px] leading-[1.55] text-vela-body ${className}`}>{children}</p>
  );
}

// ── Top breadcrumb rail ───────────────────────────────────────────────────────

export type Crumb = { label: string; href?: string };

/** The 52px hairline top rail: `SECTION / ITEM` on the left, a note on the right. */
export function TopBar({ trail, note }: { trail: Crumb[]; note?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-vela-border pb-3 mb-7">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] min-w-0">
        {trail.map((c, i) => (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <span className="text-vela-subtle shrink-0">/</span>}
            {c.href ? (
              <Link href={c.href} className="text-vela-muted hover:text-vela-teal transition-colors shrink-0">
                {c.label}
              </Link>
            ) : (
              <span className="text-zinc-100 truncate">{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      {note != null && (
        <p className="hidden sm:block font-mono text-[11px] text-vela-muted text-right shrink-0">
          {note}
        </p>
      )}
    </div>
  );
}

// ── Page hero ─────────────────────────────────────────────────────────────────

/**
 * Big display title with an optional inline name, a mono meta line, and a
 * right-aligned primary figure.
 */
export function PageHero({
  title,
  name,
  meta,
  figure,
  figureSub,
  figureSubClass = "text-vela-body",
  className = "",
}: {
  title: React.ReactNode;
  name?: React.ReactNode;
  meta?: React.ReactNode;
  figure?: React.ReactNode;
  figureSub?: React.ReactNode;
  figureSubClass?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-8 gap-y-4 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h1 className="font-display text-[34px] md:text-[44px] font-bold tracking-[-0.01em] leading-none text-zinc-100">
            {title}
          </h1>
          {name != null && <span className="text-base text-vela-body">{name}</span>}
        </div>
        {meta != null && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-vela-muted">
            {meta}
          </p>
        )}
      </div>
      {figure != null && (
        <div className="text-right shrink-0">
          <p className="font-mono text-[28px] md:text-[34px] font-medium tabular-nums leading-none text-zinc-100">
            {figure}
          </p>
          {figureSub != null && (
            <p className={`mt-1.5 font-mono text-[13px] tabular-nums ${figureSubClass}`}>
              {figureSub}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat strip ────────────────────────────────────────────────────────────────

/**
 * Hairline-bounded rail of figures. Two-up on mobile, evenly divided on md+.
 * Wrap `StatCell` children.
 */
export function StatStrip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 md:flex md:items-stretch gap-x-4 gap-y-5 md:gap-0
        border-y border-vela-border py-4 md:py-0 ${className}`}
    >
      {children}
    </div>
  );
}

/** One cell of a StatStrip: mono label / big figure / mono subtext. */
export function StatCell({
  label,
  value,
  valueClass = "text-zinc-100",
  sub,
  subClass = "text-vela-body",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  sub?: React.ReactNode;
  subClass?: string;
}) {
  return (
    <div
      className="min-w-0 md:flex-1 md:py-3.5 md:px-5 md:border-r md:border-vela-border
        md:first:pl-0 md:last:pr-0 md:last:border-r-0"
    >
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`mt-1.5 font-mono text-xl md:text-[22px] font-semibold tabular-nums leading-none truncate ${valueClass}`}
      >
        {value}
      </p>
      {sub != null && (
        <p className={`mt-1 font-mono text-[12px] tabular-nums truncate ${subClass}`}>{sub}</p>
      )}
    </div>
  );
}

// ── Conviction pips ───────────────────────────────────────────────────────────

/** Filled/hollow diamonds for a 1-5 conviction level. */
export function Pips({
  level,
  size = "text-[13px]",
  className = "",
}: {
  level: number;
  size?: string;
  className?: string;
}) {
  const n = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`conviction ${n} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`${size} leading-none ${i <= n ? "text-vela-teal" : "text-vela-muted/45"}`}
        >
          {i <= n ? "◆" : "◇"}
        </span>
      ))}
    </span>
  );
}

// ── Segmented pills ───────────────────────────────────────────────────────────

/** Segmented mono pill group — range pickers, type filters, view switches. */
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded border border-vela-border overflow-hidden ${className}`}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active ? "bg-vela-teal/15 text-vela-teal" : "text-vela-muted hover:text-zinc-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── State spectrum ────────────────────────────────────────────────────────────

/**
 * Full-width segmented ladder marking where the current state sits along an
 * ordered spectrum. Scrolls rather than overflowing on narrow screens.
 */
export function StateSpectrum({
  states,
  active,
  className = "",
}: {
  states: string[];
  active: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex min-w-[520px] border border-vela-border">
        {states.map((s) => {
          const isActive = s.toLowerCase() === active.toLowerCase();
          return (
            <div
              key={s}
              aria-current={isActive ? "true" : undefined}
              className={`flex-1 px-3 py-2.5 text-center border-r border-vela-border last:border-r-0 ${
                isActive ? "bg-vela-teal/15" : ""
              }`}
            >
              <span
                className={`font-mono text-[9.5px] uppercase tracking-[0.14em] ${
                  isActive ? "text-vela-teal font-medium" : "text-vela-muted"
                }`}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

/** Hairline-bordered container with the template's faint teal wash. */
export function Panel({
  children,
  wash = true,
  className = "",
}: {
  children: React.ReactNode;
  wash?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`border border-vela-border ${
        wash ? "bg-gradient-to-b from-vela-teal/[0.02] to-transparent" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

export type LegendItem = { glyph: React.ReactNode; label: string };

/** Mono legend row for charts, with an optional right-aligned hint. */
export function Legend({ items, hint }: { items: LegendItem[]; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-vela-muted"
        >
          {it.glyph}
          {it.label}
        </span>
      ))}
      {hint != null && (
        <span className="hidden lg:inline-flex ml-auto font-mono text-[11px] text-vela-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

/**
 * A hairline-separated page section: mono label, optional big display headline
 * and prose, optional right-aligned controls.
 */
export function Section({
  label,
  labelAside,
  headline,
  prose,
  controls,
  children,
  divided = true,
  className = "",
}: {
  label?: React.ReactNode;
  labelAside?: React.ReactNode;
  headline?: React.ReactNode;
  prose?: React.ReactNode;
  controls?: React.ReactNode;
  children?: React.ReactNode;
  divided?: boolean;
  className?: string;
}) {
  const hasHead = label != null || headline != null || prose != null || controls != null;
  return (
    <section
      className={`${divided ? "border-t border-vela-border pt-7 mt-9" : "mt-9"} ${className}`}
    >
      {hasHead && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
          <div className="min-w-0">
            {(label != null || headline != null) && (
              <div className="flex items-baseline gap-3.5 flex-wrap">
                {label != null && <SectionLabel aside={labelAside}>{label}</SectionLabel>}
                {headline != null && (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="w-[7px] h-[7px] rotate-45 bg-vela-teal inline-block" />
                    <span className="font-display text-[19px] font-semibold text-zinc-100">
                      {headline}
                    </span>
                  </span>
                )}
              </div>
            )}
            {prose != null && <Prose className="mt-2.5 max-w-[520px]">{prose}</Prose>}
          </div>
          {controls != null && (
            <div className="flex flex-col items-start sm:items-end gap-2.5">{controls}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
