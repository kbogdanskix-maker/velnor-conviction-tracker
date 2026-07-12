import type { ReactNode } from "react";

/** Shared presentational bits for the legal pages. Colocated, not routed. */

export function LegalTitle({ eyebrow, title, updated, children }: {
  eyebrow: string;
  title: string;
  updated: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-12">
      <p className="font-mono text-xs uppercase tracking-widest text-vela-teal mb-3">{eyebrow}</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-zinc-100">{title}</h1>
      <p className="mt-3 font-mono text-xs text-vela-subtle">Last updated: {updated}</p>
      {children && <div className="mt-6 text-[15px] leading-relaxed text-vela-muted">{children}</div>}
    </header>
  );
}

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10 border-t border-vela-border/60 pt-8">
      <h2 className="flex items-baseline gap-3 font-display text-xl font-semibold tracking-tight text-zinc-100 mb-4">
        <span className="font-mono text-sm text-vela-subtle tabular-nums">{n}</span>
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-vela-muted">{children}</div>
    </section>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 pl-1">{children}</ul>;
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-vela-teal" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-vela-teal hover:text-vela-teal-dim underline underline-offset-2 transition-colors">
      {children}
    </a>
  );
}
