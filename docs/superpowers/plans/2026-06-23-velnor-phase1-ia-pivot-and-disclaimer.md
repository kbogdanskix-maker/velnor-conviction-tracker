# Velnor Phase 1 — IA Pivot + Disclaimer Guardrail · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the app navigation to investing-first (Accuracy & Conviction → Research → Planning secondary → Lab), reusing the existing Sidebar, and ship a global "not investment advice" disclaimer guardrail.

**Architecture:** Extract the nav data + partition logic out of `Sidebar.tsx` into a pure, unit-tested module (`lib/nav-structure.ts`). `Sidebar.tsx` becomes a renderer that consumes it. A single Lab group (shown via a toggle) replaces the old per-item Simple/Advanced filter. Disclaimer wording lives in one constant (`lib/disclaimer.ts`); a presentational `<Disclaimer />` renders it in the dashboard shell footer. AI-response placement and first-run acknowledgment are deferred to later phases.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, lucide-react. **New:** vitest (unit tests for pure logic). UI verified via `tsc --noEmit` + `next lint` + the preview server.

Source spec: `docs/superpowers/specs/2026-06-23-velnor-conviction-tracker-pivot-design.md` (§ "Information architecture", § "Compliance & disclaimers", sequencing #1).

---

## File Structure

- **Create** `frontend/lib/nav-structure.ts` — nav types, `NAV_STANDALONE`, `NAV_GROUPS` (investing-first, with `secondary`/`lab` flags), `ALL_HREFS`, `buildNav(showLab)`. One responsibility: the nav data model + derivation. No React.
- **Create** `frontend/lib/nav-structure.test.ts` — vitest tests for partition/derivation invariants.
- **Modify** `frontend/components/shared/Sidebar.tsx` — consume `nav-structure`; render investing-first groups, Planning as a visually-secondary section, Lab behind a toggle.
- **Create** `frontend/lib/disclaimer.ts` — the disclaimer wording constants (single source).
- **Create** `frontend/components/shared/Disclaimer.tsx` — presentational disclaimer (`footer` / `inline` variants).
- **Modify** `frontend/app/(dashboard)/layout.tsx` — render `<Disclaimer variant="footer" />` in the shell.
- **Create** `frontend/vitest.config.ts` + **Modify** `frontend/package.json` — test tooling.

---

## Task 1: Add vitest tooling

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json` (scripts + devDependencies)
- Create: `frontend/lib/__smoke__.test.ts` (temporary smoke test, deleted in this task's last step)

- [ ] **Step 1: Install vitest**

Run (from `frontend/` — node/npm are on PATH at `/opt/homebrew/bin`, node v25, npm 11):
```bash
npm install -D vitest
```
Expected: current `vitest` (v4.x) added to devDependencies, no peer-dep errors. (Node 25 is new — use current vitest, not an old pin.)

- [ ] **Step 2: Create the vitest config**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // ESM-safe (no __dirname). Phase-1 tests use relative imports, but this
    // keeps "@/..." working for future tests.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
```

- [ ] **Step 3: Add the test script**

In `frontend/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test and run it**

Create `frontend/lib/__smoke__.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm frontend/lib/__smoke__.test.ts
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts
git commit -m "chore(test): add vitest for unit-testing pure logic"
```

---

## Task 2: Nav structure module (pure logic, TDD)

**Files:**
- Create: `frontend/lib/nav-structure.ts`
- Test: `frontend/lib/nav-structure.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/nav-structure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NAV_GROUPS, ALL_HREFS, buildNav, type NavGroup } from "./nav-structure";

function hrefsOf(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.href));
}

describe("nav-structure", () => {
  it("has no duplicate hrefs across all groups", () => {
    const all = hrefsOf(NAV_GROUPS);
    expect(new Set(all).size).toBe(all.length);
  });

  it("puts the conviction spine in non-lab groups with the reframed labels", () => {
    const spine = NAV_GROUPS.filter((g) => !g.lab).flatMap((g) => g.items);
    const byHref = new Map(spine.map((i) => [i.href, i.label]));
    expect(byHref.get("/portfolio")).toBe("Positions");
    expect(byHref.get("/watchlist")).toBe("Lookout");
    expect(byHref.get("/thesis")).toBe("Thesis");
    expect(byHref.get("/reflect")).toBe("Reflect");
  });

  it("marks Planning secondary and Lab as lab", () => {
    const planning = NAV_GROUPS.find((g) => g.label === "Planning");
    const lab = NAV_GROUPS.find((g) => g.label === "Lab");
    expect(planning?.secondary).toBe(true);
    expect(lab?.lab).toBe(true);
  });

  it("keeps deferred tools in Lab, not the spine", () => {
    const spineHrefs = new Set(
      NAV_GROUPS.filter((g) => !g.lab).flatMap((g) => g.items.map((i) => i.href)),
    );
    for (const h of ["/insurance", "/fees", "/monte-carlo", "/retirement", "/learn"]) {
      expect(spineHrefs.has(h)).toBe(false);
    }
  });

  it("buildNav hides Lab by default and shows it when enabled", () => {
    expect(buildNav(false).some((g) => g.lab)).toBe(false);
    expect(buildNav(true).some((g) => g.lab)).toBe(true);
  });

  it("ALL_HREFS contains every item across every group", () => {
    expect([...ALL_HREFS].sort()).toEqual([...new Set(hrefsOf(NAV_GROUPS))].sort());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./nav-structure`.

- [ ] **Step 3: Create the module**

Create `frontend/lib/nav-structure.ts`:
```ts
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp, TrendingDown,
  FileText, BookOpen, Newspaper, Globe, Compass, Users,
  Target, Wallet, Calculator, DollarSign, Sparkles, RotateCcw, Coins, Receipt,
  GraduationCap, Activity, Umbrella, Banknote, Brain, Scale, BadgePercent,
  LayoutGrid, Calendar, GitBranch, CreditCard, Shield, Repeat, Trophy,
  ArrowLeftRight, Flame, Dice5, Scissors, LineChart, MapPin, Star, GitCompare,
  HeartPulse, Zap, MessageCircle, StickyNote, Building2,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Visually quieter, lower-priority section (Planning). */
  secondary?: boolean;
  /** Hidden unless the Lab toggle is on. */
  lab?: boolean;
}

export const NAV_STANDALONE = {
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  guide: { href: "/guide", label: "Guide", icon: Compass },
  profile: { href: "/profile", label: "My Profile", icon: Users },
} satisfies Record<string, NavItem>;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Accuracy & Conviction",
    items: [
      { href: "/portfolio", label: "Positions", icon: PieChart },
      { href: "/thesis", label: "Thesis", icon: BookOpen },
      { href: "/reflect", label: "Reflect", icon: Brain },
      { href: "/watchlist", label: "Lookout", icon: Eye },
      { href: "/journal", label: "Journal", icon: FileText },
      { href: "/smart-alerts", label: "Smart Alerts", icon: Zap },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/screener", label: "Screener", icon: BarChart2 },
      { href: "/company", label: "Company Deep-Dive", icon: Building2 },
      { href: "/earnings-insights", label: "Earnings AI", icon: TrendingUp },
      { href: "/valuation/dcf", label: "DCF", icon: FileText },
      { href: "/valuation/reverse-dcf", label: "Reverse DCF", icon: RotateCcw },
    ],
  },
  {
    label: "Planning",
    secondary: true,
    items: [
      { href: "/net-worth", label: "Net Worth", icon: Wallet },
      { href: "/cash-flow", label: "Cash Flow", icon: DollarSign },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/debt-payoff", label: "Debt Payoff", icon: TrendingDown },
    ],
  },
  {
    label: "Lab",
    lab: true,
    items: [
      { href: "/plan", label: "My Plan", icon: Sparkles },
      { href: "/health-score", label: "Health Score", icon: HeartPulse },
      { href: "/dividends", label: "Dividends", icon: Coins },
      { href: "/dividend-calendar", label: "Div Calendar", icon: Calendar },
      { href: "/dividend-forecast", label: "Div Forecast", icon: TrendingUp },
      { href: "/rebalance", label: "Rebalance", icon: Scale },
      { href: "/fees", label: "Fee Analyzer", icon: BadgePercent },
      { href: "/sectors", label: "Sectors", icon: LayoutGrid },
      { href: "/position-size", label: "Position Size", icon: Calculator },
      { href: "/correlation", label: "Diversification", icon: Shield },
      { href: "/risk", label: "Risk", icon: Activity },
      { href: "/attribution", label: "Attribution", icon: BarChart2 },
      { href: "/returns", label: "Returns", icon: TrendingUp },
      { href: "/nw-history", label: "NW History", icon: LineChart },
      { href: "/expenses", label: "Expenses", icon: CreditCard },
      { href: "/budget", label: "Budget", icon: Target },
      { href: "/affordability", label: "Affordability", icon: Calculator },
      { href: "/tax", label: "Tax Awareness", icon: Receipt },
      { href: "/tax-harvest", label: "Tax Harvest", icon: Scissors },
      { href: "/income", label: "Income", icon: Banknote },
      { href: "/insurance", label: "Insurance", icon: Shield },
      { href: "/stress-index", label: "Stress Index", icon: Activity },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/asset-location", label: "Asset Location", icon: MapPin },
      { href: "/behavior", label: "Behavior", icon: Brain },
      { href: "/fi", label: "FI Tracker", icon: Flame },
      { href: "/monte-carlo", label: "Monte Carlo", icon: Dice5 },
      { href: "/retirement", label: "Retirement", icon: Umbrella },
      { href: "/compare", label: "Portfolio Comparison", icon: GitBranch },
      { href: "/benchmark", label: "Benchmark", icon: Users },
      { href: "/what-if", label: "What If", icon: Sparkles },
      { href: "/emergency-fund", label: "Emergency Fund", icon: Shield },
      { href: "/milestones", label: "Milestones", icon: Trophy },
      { href: "/learn", label: "Learn", icon: GraduationCap },
      { href: "/annual-review", label: "Annual Review", icon: Star },
      { href: "/fx", label: "Currency", icon: ArrowLeftRight },
      { href: "/markets", label: "Markets", icon: Globe },
      { href: "/macro", label: "Macro", icon: TrendingUp },
      { href: "/news", label: "News", icon: Newspaper },
      { href: "/sentiment", label: "Sentiment", icon: MessageCircle },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/stock-compare", label: "Stock Compare", icon: GitCompare },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
export const ITEM_BY_HREF = new Map(ALL_ITEMS.map((i) => [i.href, i] as const));
export const ALL_HREFS: string[] = ALL_ITEMS.map((i) => i.href);

/** Groups to render given the Lab toggle. Lab groups are dropped when `showLab` is false. */
export function buildNav(showLab: boolean): NavGroup[] {
  return NAV_GROUPS.filter((g) => showLab || !g.lab);
}
```

Note: `Settings`, `LogOut`, and `Search` are NOT imported here — they stay in `Sidebar.tsx` for the bottom actions / search trigger. Every icon imported above is used in a group below (verified).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/nav-structure.ts frontend/lib/nav-structure.test.ts
git commit -m "feat(nav): investing-first nav structure module (pure, tested)"
```

---

## Task 3: Refactor Sidebar to consume nav-structure

**Files:**
- Modify: `frontend/components/shared/Sidebar.tsx`

This task has no unit test (presentational React, no test-library in project). Verification = `tsc --noEmit` + `next lint` + preview render.

- [ ] **Step 1: Replace the inline nav definitions with imports**

In `Sidebar.tsx`, **delete** the local `NavItem`/`NavGroup` interfaces, the `NAV_TOP`/`NAV_GUIDE`/`NAV_PROFILE` consts, the entire `NAV_GROUPS` array, and the `ALL_ITEMS`/`ITEM_BY_HREF`/`ALL_HREFS`/`CORE_HREFS` block (lines ~22–143 in the current file).

Add this import near the other imports (keep the existing lucide import for icons still used directly in Sidebar — `ChevronLeft, ChevronRight, ChevronDown, LogOut, Settings, Menu, X, Search, Sparkles, LayoutGrid`):
```ts
import {
  NAV_STANDALONE, buildNav, ALL_HREFS, ITEM_BY_HREF,
  type NavItem, type NavGroup,
} from "@/lib/nav-structure";
```

- [ ] **Step 2: Replace the Simple/Advanced state with a Lab toggle**

Replace the `showAdvanced` block (current lines ~155–171) with:
```ts
  // Lab toggle: the conviction spine shows by default; Lab reveals deferred tools.
  const [showLab, setShowLab] = useState(false);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("velnor_nav_lab") : null;
    if (stored === "true") setShowLab(true);
  }, []);
  function toggleLab() {
    setShowLab((v) => {
      const next = !v;
      try { localStorage.setItem("velnor_nav_lab", String(next)); } catch { /* ignore */ }
      return next;
    });
  }
```
Remove the now-unused `useProfile`/`profile` references **only if** they are not used elsewhere; `profile` is still used by personalization (`tailoredHrefs(profile, ...)`), so keep the `const { profile } = useProfile();` line.

- [ ] **Step 3: Drive groups + auto-open from buildNav**

Replace `initialOpen`/`openGroups` derivation (current lines ~173–187) so it uses `buildNav(true)` (all groups, for matching) and defaults open the spine groups:
```ts
  const navGroups = buildNav(showLab);
  const initialOpen = buildNav(true)
    .filter((g) => g.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .map((g) => g.label);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(initialOpen.length > 0 ? initialOpen : ["Accuracy & Conviction", "Research"]),
  );
```

- [ ] **Step 4: Render groups from `navGroups`, styling secondary + dropping the per-item filter**

Replace the `{NAV_GROUPS.map((group) => { ... })}` block (current lines ~355–403) with a version that maps `navGroups`, removes the `CORE_HREFS`/`visibleItems` filtering (each group now renders all its items), and tints the secondary group's header:
```tsx
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            const hasActive = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
            );
            return (
              <div key={group.label}>
                {showLabels ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md font-mono text-[10px] uppercase tracking-[0.16em] transition-colors
                      ${hasActive ? "text-vela-teal" : group.secondary ? "text-vela-subtle hover:text-vela-muted" : "text-vela-muted hover:text-zinc-200"}
                    `}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                ) : (
                  <div className="h-px bg-vela-border mx-2 my-2" />
                )}
                {(isOpen || !showLabels) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        showLabel={showLabels}
                        collapsed={collapsed}
                        mobileOpen={mobileOpen}
                        adminMode={adminMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
```

- [ ] **Step 5: Replace the Simple/Advanced toggle button with a Lab toggle**

Replace the `toggleAdvanced` button block (current lines ~405–413) with:
```tsx
          {showLabels && (
            <button
              onClick={toggleLab}
              className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-md text-[11px] font-medium text-zinc-500 hover:text-vela-teal transition-colors border-t border-vela-border pt-3"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {showLab ? "Hide Lab tools" : "Show Lab tools"}
            </button>
          )}
```

- [ ] **Step 6: Update the standalone links + NavLink prop type**

Replace `NAV_TOP`/`NAV_GUIDE`/`NAV_PROFILE` usages (current lines ~299–301) with the imported `NAV_STANDALONE`:
```tsx
          <NavLink item={NAV_STANDALONE.dashboard} active={pathname === "/dashboard"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_STANDALONE.guide} active={pathname === "/guide"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_STANDALONE.profile} active={pathname === "/profile"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
```
In the `NavLink` component, the `item.tier` badge block references a property no longer on `NavItem`. **Delete the tier badge block** (the `{item.tier && !adminMode && (...)}` JSX) and drop `tier` usage. Keep the rest of `NavLink` unchanged.

- [ ] **Step 7: Type-check and lint**

Run: `npm run type-check`
Expected: no errors. (If `useProfile` or any icon import is now unused, remove it.)
Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 8: Verify in the preview**

Ensure the preview dev server is running (preview_start if needed). Log in (creds in memory `user_credentials.md`) or use an existing session, open `/dashboard`. Confirm via preview_snapshot/screenshot:
- Sidebar shows **Accuracy & Conviction** (Positions, Thesis, Reflect, Lookout, Journal, Smart Alerts), **Research**, then a quieter **Planning** group.
- "Show Lab tools" reveals the **Lab** group; "Hide Lab tools" collapses it; the choice survives reload (`velnor_nav_lab`).
- Active state, collapse toggle, and mobile drawer still work; no console errors.
- §11 check: all labels legible (secondary header `vela-subtle` is decorative-only; verify it still reads ≥ 3:1 — if too faint, bump to `vela-muted`).

- [ ] **Step 9: Commit**

```bash
git add frontend/components/shared/Sidebar.tsx
git commit -m "feat(nav): investing-first sidebar (Accuracy/Research/Planning + Lab toggle)"
```

---

## Task 4: Disclaimer constant + component

**Files:**
- Create: `frontend/lib/disclaimer.ts`
- Test: `frontend/lib/disclaimer.test.ts`
- Create: `frontend/components/shared/Disclaimer.tsx`

- [ ] **Step 1: Write the failing test for the wording constant**

Create `frontend/lib/disclaimer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DISCLAIMER_TEXT, DISCLAIMER_SHORT } from "./disclaimer";

describe("disclaimer", () => {
  it("states it is not investment advice", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("not investment advice");
  });
  it("states educational purposes", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("educational");
  });
  it("directs to a licensed advisor", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("licensed financial advisor");
  });
  it("has a short variant", () => {
    expect(DISCLAIMER_SHORT.toLowerCase()).toContain("not investment advice");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./disclaimer`.

- [ ] **Step 3: Create the constant**

Create `frontend/lib/disclaimer.ts`:
```ts
// Single source of the compliance disclaimer. Legal revises wording here only.
export const DISCLAIMER_TEXT =
  "Velnor is for educational and informational purposes only and is not investment advice. " +
  "Nothing here is a recommendation to buy or sell any security. " +
  "Consult a licensed financial advisor before making investment decisions.";

export const DISCLAIMER_SHORT =
  "Not investment advice. Educational purposes only. Consult a licensed financial advisor.";
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the presentational component**

Create `frontend/components/shared/Disclaimer.tsx`:
```tsx
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
```

- [ ] **Step 6: Type-check and commit**

Run: `npm run type-check`
Expected: no errors.
```bash
git add frontend/lib/disclaimer.ts frontend/lib/disclaimer.test.ts frontend/components/shared/Disclaimer.tsx
git commit -m "feat(compliance): disclaimer wording constant + presentational component"
```

---

## Task 5: Wire the disclaimer into the dashboard shell

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Import and render the footer disclaimer**

In `frontend/app/(dashboard)/layout.tsx`, add the import:
```ts
import Disclaimer from "@/components/shared/Disclaimer";
```
Replace the inner content container so the disclaimer sits below page content on every dashboard route:
```tsx
          <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
              <Disclaimer />
            </div>
          </main>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Verify in the preview**

With the preview server running, open two dashboard routes (e.g. `/dashboard` and `/portfolio`). Confirm via screenshot:
- A quiet hairline-separated disclaimer line appears at the bottom of the content on both.
- Text is legible (`vela-subtle` on `vela-bg` ≥ 3:1) and does not overlap content or the sidebar; no console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(dashboard)/layout.tsx
git commit -m "feat(compliance): render disclaimer in dashboard shell footer"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test + type-check + lint**

Run (preview dev server **stopped** to avoid `.next` corruption only if running a build; type-check/test are safe with it running):
```bash
cd frontend && npm test && npm run type-check && npm run lint
```
Expected: all tests pass; no type errors; no new lint errors.

- [ ] **Step 2: Manual smoke in the preview**

Confirm: investing-first nav order, Planning quiet/secondary, Lab toggle persists, every old route still reachable (spot-check one Lab route by URL, e.g. `/insurance`), disclaimer on every dashboard page, no dead links in the command palette for spine items.

- [ ] **Step 3: Update the handoff**

Append a short Phase 1 note to `HANDOFF.md` (what shipped: investing-first IA, Lab toggle via `velnor_nav_lab`, nav now lives in `lib/nav-structure.ts`, disclaimer guardrail in shell). No commit gate — include it in the final commit if not already committed per task.
```bash
git add HANDOFF.md && git commit -m "docs: handoff — Phase 1 IA pivot + disclaimer shipped"
```

---

## Notes for the executor

- **Never run `npm run build` while the preview dev server is running** (shared `.next` corrupts the dev runtime). Use `npm run type-check` for safe type validation.
- The command palette (`components/shared/CommandPalette.tsx`) and `lib/sidebar-personalization.ts` reference route hrefs. They are **not** changed in Phase 1 (all routes still exist), but if either imports the old nav consts from `Sidebar.tsx`, re-point that import to `@/lib/nav-structure`. Grep before assuming: `grep -rn "from \"@/components/shared/Sidebar\"" frontend`.
- Deferred to later phases (not this plan): AI-response inline disclaimer placement, first-run acknowledgment, new feature routes (Stock Journey, Closed & Lessons), and the page merges.
