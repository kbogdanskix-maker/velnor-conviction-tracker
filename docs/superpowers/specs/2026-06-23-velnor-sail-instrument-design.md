# Velnor Landing — "The Sail" Instrument

_Date: 2026-06-23 · Branch: `feat/ui-design-system-phase-0` · Status: design approved (direction); plan pending_

## What

The landing-page celestial showpiece (design-system §1 — the motif gets to be expressive on
outward-facing surfaces). A **cursor-steered, living-instrument sail** in the hero right column: a
billowing sail that trims/leans toward the cursor, wind currents bending around it, the ship
responding, and a live `HEADING` readout. Decided via brainstorming:
- **Concept:** cursor-steered sail showpiece (not a literal nav menu, not scroll-driven).
- **Interaction:** "living instrument" — always breathes, leans toward cursor, live bearing readout;
  no prompt, no clicking.

## Approach (chosen: A)

A new self-contained `components/celestial/SailInstrument.tsx` built on `HeroVoyage`'s proven
scaffolding (DPR scaling, eased cursor `pmx/pmy`, resize, `prefers-reduced-motion`). One canvas draws
backdrop stars + the interactive sail + wind + ship; a small absolutely-positioned `<span>` overlay
shows the live `HEADING`, updated via a ref each frame (not React state — design-system §5: drive
continuous values with motion values, never `useState`). Replaces `<HeroVoyage/>` + the two static
`N 41.2°` / `↑ in motion` readout divs in `app/page.tsx`. `HeroVoyage` becomes orphaned → delete.

Rejected: B (SVG sail over canvas — two coordinate systems, wind can't bend organically around an
SVG); C (edit HeroVoyage in place — readout coupling across the canvas boundary muddies the file).

## Scene

- **Backdrop:** low-opacity drifting starfield + faint sail-constellation anchors (from HeroVoyage,
  dialed back so the foreground sail leads).
- **Sail (centerpiece):** bezier sail (luff + curved leech) whose belly depth and lean-angle ease
  toward a cursor-driven target. Pointer windward → sail fills deeper + mast leans toward pointer.
  Slow ambient billow underneath so it breathes when still.
- **Wind:** existing drifting current lines, vertical offset bends toward the sail/pointer as they
  pass — wind "spilling" around the trimmed sail.
- **Ship + wake:** glides the course line below; heading nudged subtly by the trim.

## Interaction & readout

Eased pointer sets the trim target. Mono overlay ticks `HEADING 041° → 053°` (tabular-nums) from the
trim angle, plus a small status label (`ON THE WIND` / `TRIMMING ↑`).

## Tokens & motion

Teal `#1AA8BB` only (rgb `26,168,187`); `94,234,212` highlight sparingly; no decorative glow beyond
the existing soft radial; ease toward targets (no springy bounce). **Reduced-motion:** no pointer
binding, gentle idle billow, static heading. Honors §5 / §11.

## Safety / scope

Hero stage is `hidden lg:block` → no mobile/touch/perf exposure. Verify: `tsc --noEmit`, then run the
app, open `/?preview` at desktop width, screenshot the hero, confirm the sail responds and console is
clean.
