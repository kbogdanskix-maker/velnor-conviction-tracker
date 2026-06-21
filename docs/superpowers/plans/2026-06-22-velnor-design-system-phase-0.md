# Velnor Design System — Phase 0 (Shared Layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Velnor "Instrument" design system to the shared frontend layer so all 67 pages shift at once — new fonts, de-slopped tokens, solid surfaces, teal-only atmosphere, crisp radius — without touching individual pages yet.

**Architecture:** The app has almost no per-page styling; pages inherit from three shared files: `app/layout.tsx` (fonts), `tailwind.config.ts` (tokens), and `app/globals.css` (component classes like `.vela-card`, `.btn-primary`, atmosphere). Changing these three propagates everywhere. We change tokens/classes only — no page/component markup in this phase.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `next/font/google`. Spec: `wealth-platform/frontend/design-system.md`.

**Note on TDD:** This is a CSS/design-token change with no unit-testable logic. "Test" here = `npm run build` succeeds (correctness) + visual verification in the dev server (the change is visible and nothing broke). Each task ends with build + commit.

**Out of scope (deferred):** The icon-animation zoo (wiggle/bounce/spin/ring) stays untouched — the Sidebar that uses it is rebuilt in Phase 1. The Sidebar itself, and all page/component markup, are later phases.

**Working directory for all commands:** `/Users/krzys/Claude/wealth-platform/frontend`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `app/layout.tsx` | Root fonts + html class | Replace Geist/Space Grotesk with Bricolage/Hanken/JetBrains via `next/font/google` |
| `tailwind.config.ts` | Color + radius + font tokens | New palette hexes, crisp radius scale, font-family vars |
| `app/globals.css` | Shared component classes + atmosphere | De-glass `.vela-card`, teal-only atmosphere, kill glow, crisp buttons/inputs/pills |

---

## Task 1: Wire the three fonts

**Files:**
- Modify: `app/layout.tsx` (full rewrite of imports + html class)
- Modify: `tailwind.config.ts:29-33` (fontFamily)

- [ ] **Step 1: Replace font loaders in `app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Velnor",
    template: "%s  - Velnor",
  },
  description: "Your wealth, in motion. Portfolio tracking, valuation tools, and market intelligence for investors.",
  openGraph: {
    title: "Velnor",
    description: "Your wealth, in motion.",
    siteName: "Velnor",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} dark`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Point Tailwind fontFamily at the new variables**

In `tailwind.config.ts`, replace the `fontFamily` block (lines 29-33):

```ts
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
```

- [ ] **Step 3: Build to verify fonts resolve and nothing references the old vars**

Run: `npm run build`
Expected: build succeeds. (`next/font` downloads Bricolage/Hanken/JetBrains at build time.) If it fails on a missing `geist` or `@fontsource` import, confirm Step 1 removed both old imports.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx tailwind.config.ts
git commit -m "feat(ui): wire Bricolage/Hanken/JetBrains fonts, drop Geist"
```

---

## Task 2: Palette + radius tokens

**Files:**
- Modify: `tailwind.config.ts:13-39` (colors + borderRadius)

- [ ] **Step 1: Update the `vela` palette and P&L colors**

In `tailwind.config.ts`, replace the `colors` block (lines 13-28) with:

```ts
      colors: {
        // Velnor brand palette — Instrument design system
        vela: {
          teal: "#14b8a6",        // primary accent — the ONLY brand accent
          "teal-dim": "#0d9488",  // hover state
          bg: "#050A16",          // page background
          card: "#0B1322",        // solid card surface
          "card-hover": "#111A2E",// raised surface
          border: "#1B2638",      // hairline border
          muted: "#8A97AC",       // muted text
          subtle: "#5A6678",      // faint text
        },
        // P&L — semantic only, never decoration
        gain: "#34d399",   // emerald-400
        loss: "#f43f5e",   // rose-500
      },
```

- [ ] **Step 2: Crisp the radius scale (caps rounded-xl/2xl app-wide; leaves rounded-full for avatars)**

In `tailwind.config.ts`, replace the `borderRadius` block (lines 34-39) with:

```ts
      borderRadius: {
        DEFAULT: "4px",  // buttons, inputs
        sm: "4px",
        md: "6px",       // cards
        lg: "6px",
        xl: "8px",       // was 16px — caps oversized cards
        "2xl": "10px",   // was 16px — caps oversized cards
      },
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(ui): de-slop palette (teal-only) and crisp radius scale"
```

---

## Task 3: De-glass `.vela-card`

**Files:**
- Modify: `app/globals.css:43-65`

- [ ] **Step 1: Replace the `.vela-card` and `.vela-card:hover` blocks**

In `app/globals.css`, replace lines 43-65 with:

```css
  /* ── Card surface — solid, hairline, no glass ─────────────────── */
  .vela-card {
    @apply relative rounded-md p-5 transition-colors duration-200 ease-out;
    background: #0B1322;
    border: 1px solid #1B2638;
  }

  .vela-card:hover {
    border-color: rgba(20, 184, 166, 0.35);
  }
```

This removes: the gradient fill, `backdrop-filter: blur`, the multi-layer + glow box-shadow, the `translateY`/scale hover lift, and `rounded-2xl` (now `rounded-md` = 6px).

- [ ] **Step 2: Build + visually verify in the dev server**

Run: `npm run build` (expect success), then start the dev server: `./dev.sh` (or `npm run dev`) and open `http://localhost:3000/?preview`.
Expected: cards are flat, solid navy with a thin border and crisp corners; no blur halo, no glow, no lift on hover (border brightens to teal instead).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): de-glass vela-card to solid hairline surface"
```

---

## Task 4: Teal-only atmosphere + kill glow + de-glass sidebar

**Files:**
- Modify: `app/globals.css:72-81` (atmosphere), `:96-104` (glass-sidebar), `:107-113` (glow utilities)

- [ ] **Step 1: Remove the indigo radial from `.atmospheric-bg::before`**

In `app/globals.css`, replace the `background:` declaration inside `.atmospheric-bg::before` (lines 76-78) with:

```css
    background:
      radial-gradient(ellipse 80% 50% at 20% 0%, rgba(20, 184, 166, 0.05) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(20, 184, 166, 0.03) 0%, transparent 55%);
```

(The second radial was `rgba(99, 102, 241, …)` indigo — now teal.)

- [ ] **Step 2: De-glass `.glass-sidebar`**

Replace the `.glass-sidebar` block (lines 96-104) with:

```css
  .glass-sidebar {
    background: #070D1A;
    border-right: 1px solid #1B2638;
  }
```

- [ ] **Step 3: Neutralize the glow utilities (keep class names so references don't break)**

Replace `.glow-teal` (lines 107-109) and `.glow-teal-strong` (lines 111-113) with:

```css
  .glow-teal {
    box-shadow: none;
  }

  .glow-teal-strong {
    box-shadow: none;
  }
```

- [ ] **Step 4: Build + verify**

Run: `npm run build`, then reload `http://localhost:3000/?preview`.
Expected: background atmosphere has no purple/indigo cast (teal-only); no glow halos anywhere.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): teal-only atmosphere, kill glow, de-glass sidebar surface"
```

---

## Task 5: Crisp buttons, inputs, and change-pills

**Files:**
- Modify: `app/globals.css:126-128` (change-pill), `:169-219` (btn-primary, btn-ghost, input-field), `:229-240` (glass-input), `:262` (scrollbar track)

- [ ] **Step 1: Make change-pills 4px (not pills)**

Replace `.change-pill` (lines 126-128) with:

```css
  .change-pill {
    @apply inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded tabular;
  }
```

- [ ] **Step 2: De-glow `.btn-primary`**

Replace the three `.btn-primary*` blocks (lines 170-192) with:

```css
  .btn-primary {
    @apply relative bg-vela-teal text-zinc-950 font-medium px-4 py-2 rounded transition-colors duration-200;
  }

  .btn-primary:hover {
    @apply bg-vela-teal-dim;
  }

  .btn-primary:active {
    transform: scale(0.98);
  }
```

- [ ] **Step 3: De-glass `.btn-ghost`**

Replace the two `.btn-ghost*` blocks (lines 195-206) with:

```css
  .btn-ghost {
    @apply text-zinc-400 px-3 py-2 rounded transition-colors duration-200;
    border: 1px solid transparent;
  }

  .btn-ghost:hover {
    @apply text-zinc-100;
    background: #0B1322;
    border-color: #1B2638;
  }
```

- [ ] **Step 4: De-glass `.input-field` (keep the select chevron block untouched)**

Replace the `.input-field` and `.input-field:focus` blocks (lines 209-219) with:

```css
  .input-field {
    @apply rounded px-3 py-2 text-sm text-zinc-100 placeholder-slate-500 outline-none transition-colors duration-200;
    background: #0B1322;
    border: 1px solid #1B2638;
  }

  .input-field:focus {
    border-color: rgba(20, 184, 166, 0.6);
    box-shadow: 0 0 0 1px rgba(20, 184, 166, 0.5);
  }
```

- [ ] **Step 5: De-glass `.glass-input`**

Replace the `.glass-input` and `.glass-input:focus` blocks (lines 230-240) with:

```css
  .glass-input {
    @apply rounded px-3 py-2 text-sm text-zinc-100 placeholder-slate-500 outline-none transition-colors;
    background: #0B1322;
    border: 1px solid #1B2638;
  }

  .glass-input:focus {
    border-color: rgba(20, 184, 166, 0.6);
    box-shadow: 0 0 0 1px rgba(20, 184, 166, 0.5);
  }
```

- [ ] **Step 6: Match scrollbar track to new bg**

In `app/globals.css`, change the `::-webkit-scrollbar-track` background (line 262) from `#030712` to `#050A16`:

```css
::-webkit-scrollbar-track {
  background: #050A16;
}
```

- [ ] **Step 7: Build + verify**

Run: `npm run build`, then reload `http://localhost:3000/?preview` and the `/login` page.
Expected: primary buttons are flat teal with 4px corners and no glow; inputs are solid with a crisp 1px teal focus ring (no blur, no halo); change-pills are 4px not fully rounded.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): crisp flat buttons, inputs, and change-pills (no glow/glass)"
```

---

## Task 6: Whole-app verification pass

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 2: Visual sweep across surface types**

Start the dev server and check one page of each shape:
- Landing: `http://localhost:3000/?preview`
- Auth: `http://localhost:3000/login`
- An interior app page that uses `.vela-card` heavily (e.g. dashboard — log in with the test account from memory if a redirect blocks it).

Confirm against `design-system.md`:
- Fonts: headings render in Bricolage Grotesque, body in Hanken Grotesk, figures in JetBrains Mono.
- No glass blur, no glow, no indigo, no `rounded-2xl` cards, no hover card-lift.
- Avatars / circular elements (`rounded-full`) are still round (radius cap did not square them).

- [ ] **Step 3: Capture a before/after screenshot of the landing for the record, then commit any final touch-ups**

If everything passes, the phase is done. If a circular element squared or a surface looks broken, fix it in the relevant file and re-run Steps 1-2 before committing.

```bash
git add -A
git commit -m "chore(ui): Phase 0 shared-layer verification pass"
```

---

## Self-Review

**Spec coverage (design-system.md → task):**
- §2 Typography (fonts) → Task 1. §3 Color → Task 2. §4 Spacing & Shape (radius) → Task 2. §5 Surfaces (de-glass, kill glow, teal atmosphere) → Tasks 3-4. §6 Components (buttons/inputs/chips) → Task 5. Motion (transitions shortened to 200ms, lifts removed) → Tasks 3 & 5.
- Intentionally deferred: §6 Navigation (Sidebar) → Phase 1; icon-animation retirement → Phase 1 (the consuming nav is rebuilt there); §1 landing celestial showpiece → Phase 4. Page/component markup → Phases 1-3.

**Placeholder scan:** No TBD/TODO; every code step shows full replacement code with exact line ranges.

**Type/name consistency:** Font CSS vars `--font-display` / `--font-sans` / `--font-mono` are defined in `layout.tsx` (Task 1 Step 1) and consumed in `tailwind.config.ts` (Task 1 Step 2) — names match. Hex values (`#0B1322`, `#1B2638`, `#050A16`) are used identically across Tasks 2-5 and match `design-system.md` §3.
