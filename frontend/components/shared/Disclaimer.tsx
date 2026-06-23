import { DISCLAIMER_TEXT, DISCLAIMER_SHORT } from "@/lib/disclaimer";

/**
 * Compliance guardrail. `footer` = quiet full-width line in the shell.
 * `inline` = short label to render beneath AI output (used in later phases).
 * Deterministic + client-independent of any model output.
 */
export default function Disclaimer({ variant = "footer" }: { variant?: "footer" | "inline" }) {
  if (variant === "inline") {
    return (
      <p className="font-mono text-[10px] leading-snug text-vela-subtle mt-2">{DISCLAIMER_SHORT}</p>
    );
  }
  return (
    <footer className="border-t border-vela-border mt-8 pt-4 pb-2">
      <p className="text-[11px] leading-relaxed text-vela-subtle max-w-3xl">{DISCLAIMER_TEXT}</p>
    </footer>
  );
}
