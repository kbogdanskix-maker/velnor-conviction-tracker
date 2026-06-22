# Velnor Design System

> The single source of **taste** for Velnor. Paste the relevant sections into any
> design prompt. Component libraries (21st.dev, shadcn) supply *bones* — this file
> supplies *taste*. When the two conflict, this file wins.
>
> Governing principle (from the anti-slop guide): **silence = AI defaults.** Every
> decision left unspecified reverts to the generic norm — so this document is
> deliberately explicit, and the **Do Not Use** section is as important as the rest.

---

## 1. Personality & North Star

Velnor is **celestial navigation for your money** — an instrument for serious
self-directed investors who want to hold their winners and tie every decision to a
stated objective.

**Five adjectives:** instrument-grade · precise · editorial · grounded · quietly confident.

**Reference feel:** a navigation instrument and a financial almanac — not a SaaS
dashboard, not a crypto terminal, not a neobank. Think hairline rules, tabular
figures, monospaced micro-labels, and generous structure. Closer to *Teenage
Engineering manual* / *FT Weekend* than *Linear clone #4,000*.

**Signature motifs** (use these to make any surface unmistakably Velnor):
- **Mono eyebrow labels** — JetBrains Mono, 11px, uppercase, `letter-spacing: .16em`, teal or muted.
- **Hairline rules** — 1px low-alpha dividers separating sections instead of cards-in-cards.
- **Tabular figures everywhere** — all money/percentages in JetBrains Mono, `tabular-nums`.
- **Bearing/heading framing** — navigation language for state ("set your bearing", "the read").

**Where the celestial / navigation soul lives.** The motif is the brand's identity, but it
must stay *disciplined inside the app* — it is an accent, never decoration that competes with
data. In-app it appears only as: the **V mark**, the **bearing/heading language**, mono eyebrow
labels, and an optional **very low-opacity constellation** behind empty/hero states (must not
reduce text contrast). It gets to be **expressive on the outward-facing surfaces** — the
**landing page is the home of the celestial showpiece**: an interactive sail / constellation /
wind-current that responds to the cursor. Loud on the landing, whisper-quiet in the product.

---

## 2. Typography

Three families. No others. **Drop Geist entirely** (it is a named slop tell).

| Role | Font | Notes |
|------|------|-------|
| Display / headings | **Bricolage Grotesque** | variable, optical sizing; weights 700–800 |
| Body / UI | **Hanken Grotesk** | weights 400 (body), 500 (labels/emphasis) |
| Figures / data / micro-labels | **JetBrains Mono** | `tabular-nums` always on for numbers |

**Type scale (px):** `64 · 48 · 32 · 24 · 20 · 16 · 15 · 13 · 11`
- Hero display: 48–64 (clamp), Bricolage 800, `letter-spacing: -0.02em`, `line-height: 1.02`
- H1 32 / H2 24 / H3 20 — Bricolage 700, `letter-spacing: -0.015em`
- Body 16 (marketing) / 15 (app), Hanken 400, `line-height: 1.6`
- Labels 13, Hanken 500. Eyebrows/micro 11, JetBrains Mono, uppercase, tracked.

**Weight rules:** Bold (700–800) is for **display headings and figures only**. Body grotesque
never goes above 500. Never use 600 on running text. Reading measure ≤ 65ch.

> Working pick is Bricolage Grotesque. Swap candidates (one token change in
> `tailwind.config.ts` + the `next/font` loader): Chakra Petch (instrument/HUD),
> Clash Display (geometric; self-host, Fontshare). Record any change in the Changelog.

---

## 3. Color

One brand accent. Teal. That's it. Everything else is a neutral or a semantic signal.

| Role | Token | Hex |
|------|-------|-----|
| Page background | `vela-bg` | `#050A16` |
| Surface (card) | `vela-card` | `#0B1322` |
| Surface raised | `vela-card-hover` | `#111A2E` |
| Hairline border | `vela-border` | `#1B2638` |
| Text primary | `zinc-100` | `#F4F5F7` |
| Text muted | `vela-muted` | `#8A97AC` |
| Text faint | `vela-subtle` | `#5A6678` |
| **Accent (only)** | `vela-teal` | `#14B8A6` |
| Accent hover | `vela-teal-dim` | `#0D9488` |
| Gain (semantic) | `gain` | `#34D399` |
| Loss (semantic) | `loss` | `#F43F5E` |
| Warning (semantic) | `amber` | `#F59E0B` |

**Rules:**
- Teal is the **single** decorative/brand accent. Gain/loss/warning are **semantic only** —
  never use emerald or rose as decoration.
- Functional color always pairs with text or an icon — never color alone.
- Contrast: body text ≥ 4.5:1, large/figures ≥ 3:1, on the dark surfaces above.

---

## 4. Spacing & Shape

- **Base unit: 4px.** Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.
- **Radius (crisp, per component):** buttons/inputs **4px**, cards **6px**, panels & sidebar **0px**.
- **No `rounded-full` / pills.** Status chips use **4px**, never a pill.
- **Borders:** 1px hairline, `vela-border` (~12% alpha over surface). Borders define
  hierarchy — not shadows, not glow.
- Density is intentional, not "50px padding everywhere": comfortable but information-rich.

---

## 5. Surfaces, Elevation & Motion

**Surfaces — kill the glass.** Cards are **solid** `vela-card` with a 1px hairline border.
No `backdrop-filter` blur as decoration; reserve blur for genuine overlays (modals, menus)
only. Elevation is expressed by **surface step + border**, plus at most a single soft shadow
(`0 1px 2px rgba(0,0,0,.4)`). **No multi-layer shadows. No teal glow as default decoration** —
teal glow is allowed only sparingly on focus/active emphasis.

**Atmosphere:** the celestial backdrop stays, but **teal-only** — remove the indigo radial
(`rgba(99,102,241,…)`). Starfield/constellation is fine at low opacity; it must never reduce
text contrast.

**Motion:** 150–220ms, `ease-out` on enter (exit ~70% of that), **transform/opacity only**.
Stagger list reveals 30–50ms. **Retire the icon-animation zoo** (wiggle/bounce/spin/ring) — keep
at most one subtle hover micro-interaction. **No hover card-lift** (`translateY` + scale);
on hover, brighten the border instead. Always honor `prefers-reduced-motion`.

**Animation sourcing.** We *do* borrow interaction/animation patterns from 21st.dev (number
roll-ups, reveal-on-scroll, marquees, hover states) — but they pass the §9 re-skin checklist
first: our timing tokens, our easing, transform/opacity only, stripped of springy bounce and
glow. 21st supplies the mechanics; this file governs the feel. The one place motion is allowed
to be a *showpiece* is the landing celestial interaction (see §1) — that respects reduced-motion
but can be richer than in-app micro-motion.

---

## 6. Component Conventions

- **Buttons:** flat, no gradient. Primary = `vela-teal` bg, `vela-bg` text, 4px radius,
  13px Hanken 500. Ghost = transparent, 1px `vela-border`, muted text. One primary CTA per view.
- **Inputs:** solid `vela-card` fill, 1px border, focus ring = 1px `vela-teal` (no glow halo).
  Visible label above (never placeholder-as-label). Errors below the field.
- **Cards / panels:** solid surface + hairline border, 6px radius, 16–24px padding. Section
  headers get a mono eyebrow + a hairline rule, not another nested card.
- **Figures:** JetBrains Mono, `tabular-nums`. Gain green / loss rose, always with a ▲/▼ glyph.
- **Status chips:** 4px radius, mono 11px, tinted surface + same-family text (no black on color).
- **Navigation:** move away from the generic shadcn icon+label sidebar. Use a mono-labeled,
  hairline-divided rail with a clear active state (teal marker + brightened text), not a
  pill-highlight. (Detailed in the dashboard-shell phase.)

---

## 7. Layout Rules

Velnor **does** use: hairline-divided editorial sections, asymmetric hero grids, mono
eyebrow → headline → figure rhythm, generous left-aligned reading columns.

Velnor **does not** use: full-bleed gradient hero with centered headline+subhead+CTA;
3-up icon-grid "feature" sections; cards-inside-cards; symmetric everything; decorative
hero illustrations that don't carry data.

---

## 8. Do Not Use (negative constraints — block the defaults)

- ❌ **Geist / Inter / Roboto** as the typeface.
- ❌ **Blue or indigo or purple** accents; **AI purple→pink gradients**; rainbow categorical color.
- ❌ **Liquid glass** (`backdrop-blur` decoration), multi-layer shadows, **glow as default**.
- ❌ **`rounded-xl` / `rounded-2xl` / `rounded-full`** anywhere; large 16px+ radii.
- ❌ **Generic shadcn sidebar** (icon+label pill nav copied verbatim).
- ❌ "Clean & spacious" 50px padding everywhere as a substitute for hierarchy.
- ❌ Hover card-lift (`translateY`/scale); springy framer-motion bounces.
- ❌ Emoji as icons (use a single consistent outline icon set).
- ❌ Emerald/rose as decoration (semantic P&L only).

---

## 9. Using 21st.dev (and shadcn) — bones, not taste

21st's catalog is the shared shadcn-default aesthetic; pulling it verbatim is *how* unrelated
apps end up looking like siblings. Use it for **structure and logic only**, then re-skin.

**Keep:** component structure, accessibility attributes, keyboard handling, state logic,
responsive grid scaffolding.

**Strip & re-skin (mandatory checklist before any 21st snippet lands):**
1. `rounded-xl/2xl/full` → our radius scale (4/6/0).
2. Remove gradients, `backdrop-blur` decoration, liquid-glass, multi-layer/glow shadows.
3. Replace `primary`/indigo/blue with `vela-teal`; map all colors to §3 tokens.
4. Swap fonts to Bricolage / Hanken / JetBrains; figures → `tabular-nums`.
5. Replace springy motion with §5 tokens (150–220ms, ease-out, transform/opacity).
6. Add a mono eyebrow + hairline rule where the snippet uses a plain bold header.
7. Re-check contrast on our dark surfaces.

If a snippet can't survive the checklist without becoming generic, build it from scratch instead.

---

## 10. Migration map (current tells → replacement)

| Today | Where | Replace with |
|-------|-------|--------------|
| Geist sans/mono + Space Grotesk | `tailwind.config.ts`, `layout.tsx` | Bricolage + Hanken + JetBrains Mono |
| `vela-card` glass (rounded-2xl, blur, glow, lift) | `globals.css` | solid surface + hairline, 6px, border-brighten hover |
| Indigo atmosphere radial | `globals.css` `.atmospheric-bg` | teal-only radial |
| Icon-animation zoo (wiggle/bounce/spin/ring) | `tailwind.config.ts` | one subtle hover micro-interaction |
| shadcn-style sidebar | `components/.../Sidebar` | mono-labeled hairline rail (dashboard-shell phase) |

---

## 11. Legibility & QA invariants (recurring failure modes — ALWAYS check)

These are the bugs that keep biting Velnor. Every phase must verify them on the real render, not by assumption.

1. **No invisible elements.** Text, figures, icons, axis ticks and data labels must NEVER be the same
   (or near-same) value as their background. Body ≥ 4.5:1, large text / figures ≥ 3:1. A number on a
   dark surface uses `zinc-100`/`vela-muted` — never a dark fill, `currentColor` that resolves to the bg,
   or an unset color.
2. **Charts use explicit colors.** Every series, axis, gridline, tick and label gets an explicit color
   from the palette (teal / `gain` / `loss` + zinc neutrals). Never rely on a charting-lib default that
   can resolve to the background. Gridlines low-contrast but visible (~`#1B2638`); data text ≥ 4.5:1;
   tooltips solid `vela-card`, not transparent. Don't encode meaning by color alone.
3. **Icons fit.** Use fixed size tokens (nav 16px `w-4 h-4`, always `shrink-0`) so an icon never
   collapses to 0 or overflows its row. One consistent stroke weight. No icon wider than its container.
4. **Fixed/absolute controls stay in bounds.** Collapse toggles, FABs, badges, tooltips must remain fully
   visible and clickable — check at the **collapsed** width and on **mobile**; never clipped by an
   `overflow` parent or pushed off-screen. The sidebar collapse toggle is the classic offender.
5. **Verify, don't assume.** Confirm contrast and fit in the running app (or a faithful mockup), not from
   the diff.

## 12. Changelog

- **2026-06-22** — Initial system. Direction: "Instrument" (anti-slop). Display = Bricolage
  Grotesque (working pick; Chakra Petch / Clash Display documented as swaps). Teal as sole
  accent; glass/glow/indigo/rounded-2xl retired.
- **2026-06-22** — Added celestial-motif policy (disciplined in-app accent; expressive landing
  showpiece — interactive sail/constellation). Added 21st.dev animation-sourcing rule (borrow
  mechanics, re-skin to our motion tokens). Priority confirmed **app-first**: shared layer →
  dashboard shell → app pages, with the landing celestial showpiece as a later delight.
