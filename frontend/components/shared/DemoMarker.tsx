"use client";

import { useTier } from "@/hooks/useTier";

/**
 * Compliance marker for anonymous demo sessions, not decoration. The seeded
 * portfolio carries hand-written first-person thesis notes about real,
 * publicly traded companies (MSFT, ADBE, NKE, ASML, ...). What keeps that
 * seed content outside the no-advice guardrail (MiFID/KNF) is explicit,
 * visible attribution to a fictional persona - this is that attribution.
 *
 * Rendered once from app/(dashboard)/layout.tsx, ahead of {children}, so it
 * is guaranteed on every dashboard page rather than only the ones that
 * happen to compose the instrument TopBar. Placed near the top of the
 * content column (not down by the footer Disclaimer) so it frames the page
 * before the visitor reads any numbers.
 */
export default function DemoMarker() {
  const { isDemo } = useTier();

  if (!isDemo) return null;

  return (
    <p className="mb-5 inline-flex items-center gap-1.5 rounded border border-vela-teal/25 bg-vela-teal/10 px-2 py-1 font-mono text-[11px] text-vela-teal">
      Sample portfolio · not investment advice
    </p>
  );
}
