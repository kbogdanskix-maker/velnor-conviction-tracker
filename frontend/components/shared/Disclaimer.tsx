import { DISCLAIMER_TEXT, DISCLAIMER_SHORT } from "@/lib/disclaimer";

/**
 * Compliance guardrail. `footer` = quiet full-width line in the shell.
 * `inline` = short label to render beneath AI output (used in later phases).
 * Deterministic + client-independent of any model output.
 *
 * Contrast is load-bearing here, not cosmetic: this is the no-advice
 * guardrail, and a disclaimer below AA is not a prominent one. It uses
 * `vela-muted` (6.6:1), never `vela-subtle` — whose own token comment reads
 * "DECORATION ONLY, never readable copy" and measures 3.4:1 at 11px.
 */
export default function Disclaimer({ variant = "footer" }: { variant?: "footer" | "inline" }) {
  if (variant === "inline") {
    return (
      <p className="font-mono text-[10px] leading-snug text-vela-muted mt-2">{DISCLAIMER_SHORT}</p>
    );
  }
  return (
    <footer className="border-t border-vela-border mt-8 pt-4 pb-2">
      <p className="text-[11px] leading-relaxed text-vela-muted max-w-3xl">{DISCLAIMER_TEXT}</p>
    </footer>
  );
}
