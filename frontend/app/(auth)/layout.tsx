import Link from "next/link";
import VelnorMark from "@/components/shared/VelnorMark";

/**
 * Auth shell. An asymmetric split rather than a centred card on a wash: the
 * boxed-card-in-the-middle is the generic SaaS sign-in the design system rules
 * out (§7, §8). The brand rail carries the positioning, the form column carries
 * the work, and a single hairline separates them.
 *
 * Below lg the rail collapses to a compact header so the form owns the screen.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-vela-bg atmospheric-bg noise-overlay">
      <div className="relative z-10 min-h-[100dvh] grid lg:grid-cols-[1fr_minmax(380px,460px)]">
        {/* ── Brand rail ──────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="inline-flex items-center gap-2.5 w-fit group">
            <VelnorMark className="w-9 h-6 shrink-0 text-vela-teal" />
            <span className="text-xl font-display font-semibold tracking-tight text-zinc-100">
              Velnor
            </span>
          </Link>

          <div className="max-w-lg">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted mb-5">
              Conviction, on the record
            </p>
            <p className="font-display text-4xl xl:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-zinc-100">
              Hold your <span className="text-vela-teal italic">winners</span>.
              <br />
              <span className="text-zinc-500">Know if you were right.</span>
            </p>
            <div className="mt-8 h-px w-24 bg-vela-border" />
            <p className="mt-8 text-vela-body leading-relaxed">
              Write down why you bought, watch each thesis play out against the
              price, and see how right you have actually been over time.
            </p>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted">
            Your wealth, in motion
          </p>
        </div>

        {/* ── Form column ─────────────────────────────────────────── */}
        <div className="flex flex-col justify-center border-vela-border lg:border-l px-6 py-12 sm:px-10 lg:px-12">
          {/* Compact brand header, mobile only */}
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-2.5 w-fit mb-10"
          >
            <VelnorMark className="w-8 h-6 shrink-0 text-vela-teal" />
            <span className="text-lg font-display font-semibold tracking-tight text-zinc-100">
              Velnor
            </span>
          </Link>

          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
