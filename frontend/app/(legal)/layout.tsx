import Link from "next/link";
import type { ReactNode } from "react";
import VelnorMark from "@/components/shared/VelnorMark";

/**
 * Public shell for legal pages (/privacy, /terms). Deliberately quiet: no
 * dashboard chrome, no auth. Matches the "Instrument" system — hairline
 * borders, mono eyebrows, teal-only accent.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-vela-bg text-zinc-300">
      {/* top bar */}
      <header className="border-b border-vela-border/60">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-100 hover:text-white transition-colors">
            <VelnorMark className="w-6 h-5 text-vela-teal" />
            <span className="font-display text-lg font-bold tracking-tight">Velnor</span>
          </Link>
          <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-widest text-vela-muted">
            <Link href="/privacy" className="hover:text-vela-teal transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-vela-teal transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-vela-teal transition-colors">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* content */}
      <main className="mx-auto max-w-3xl px-6 py-14">{children}</main>

      {/* footer */}
      <footer className="border-t border-vela-border/60">
        <div className="mx-auto max-w-3xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-vela-subtle text-xs">
          <div className="flex items-center gap-2">
            <VelnorMark className="w-5 h-4 text-vela-teal" />
            <span>Velnor &copy; {new Date().getFullYear()}</span>
          </div>
          <p className="font-mono tracking-wide">Your wealth, in motion.</p>
        </div>
      </footer>
    </div>
  );
}
