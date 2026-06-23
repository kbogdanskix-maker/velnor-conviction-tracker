# Velnor Feature Consolidation — Design

_Date: 2026-06-23 · Branch: `feat/ui-design-system-phase-0` · Status: design (awaiting plan)_

## Problem (the honest viability read)

The dashboard ships **63 real feature pages** (68 routes minus landing/login/register and 2
redirects). For a pre-launch product built largely solo, that surface area is the single biggest
threat to viability — bigger than any design-polish issue.

1. **It buries a sharp thesis.** Velnor's wedge — _hold your winners instead of churning, and tie
   every money decision to your stated objective_ — is genuinely differentiated. A new user doesn't
   land in that story; they land in a 34-item sidebar and read "another everything-app." The
   feature that makes Velnor _Velnor_ (the goal-aware AI read) is one item among sixty.
2. **Breadth is why the redesign keeps fighting us.** Every de-slop pass is measured in "14 pages /
   47 files / 24 files." The recurring UI bugs recur because there are 63 surfaces to hide in.
   Cutting surface is the highest-leverage design action available.
3. **In a money app, unverifiable breadth is a trust liability.** Open correctness bugs (per the
   prior audit): debt-payoff doesn't carry forward freed minimums (understates payoff speed);
   benchmark percentiles are age-agnostic; asset-location tax classification is fragile string
   matching. One wrong number discredits all the numbers. 15 features we can stand behind beat 63
   we can't all verify.
4. **The headline differentiator needs verifying.** The AI "Reflect" read — what the landing page
   sells — is the spine centerpiece. `ANTHROPIC_API_KEY` is now configured in `backend/.env`
   (valid `sk-ant-` format), so the prior auth error was stale (pre-key). It still needs an
   end-to-end check after a backend restart (env changes don't hot-reload) to confirm Reflect
   actually streams.

## Goal

Cut the launch surface from **63 → a spine of ~21 destinations** (10 of them merges that absorb
~28 source pages, plus ~15 pages deferred to Lab), **without deleting code**. Reversible per page.
(Counts are approximate and close roughly; the planning audit reconciles the exact rollup.)

## Non-goals

- Not deleting any route code. Deferred pages stay reachable by URL; merged pages absorb via
  `redirect()`.
- Not redesigning page _internals_ beyond what a merge requires (the "Instrument" redesign continues
  separately).
- The landing-page sail showpiece is tracked in its own spec
  (`2026-06-23-velnor-sail-instrument-design.md`) — independent, no app surface area.

## Mechanism

- **Merges:** one new page absorbs the cluster via tabs/modes; old routes `redirect()` into it
  (optionally with a `?tab=`/`?mode=` param). The merged page may initially just tab the existing
  page components, then get unified.
- **Defers ("Lab"):** remove from `NAV_GROUPS` in `components/shared/Sidebar.tsx`; keep the route
  file. Reachable by URL, not advertised.
- **Reuse the existing toggle.** The current Simple/Advanced machinery (`CORE_HREFS` +
  `vela_nav_advanced`) becomes **Spine (default) / Lab (all tools)**. The spine is the launch nav;
  Lab reveals deferred tools. No new infrastructure — repurpose `CORE_HREFS` → the spine set and the
  toggle label.
- **AI prerequisite (configured).** `ANTHROPIC_API_KEY` is set in `backend/.env` (valid format), so
  Reflect and Earnings AI are treated as live. Remaining step is to **restart the backend and confirm
  Reflect streams end-to-end** (env changes don't hot-reload). Claude does not read, print, or modify
  the secret value.

## The launch spine (target nav)

```
Dashboard
THE READ     Reflect (AI) · Portfolio Health* · Smart Alerts
INVEST       Portfolio · Watchlist · Performance* · Dividends*
PLAN         Net Worth* · Cash Flow* · Goals · On Track?* · Debt Payoff · Tax*
MARKETS      Markets* · News
RESEARCH     Screener · Valuation* · Company · Thesis* · Earnings AI
             (Guide · Profile · Settings at the foot)
```
`*` = merge. 21 destinations (Dashboard 1 · THE READ 3 · INVEST 4 · PLAN 6 · MARKETS 2 · RESEARCH 5);
foot utilities (Guide, Profile, Settings) excluded from the count.

## Merge map

| New page | Absorbs | Shape | Notes |
|---|---|---|---|
| **Portfolio Health** | `risk`, `stress-index`, `health-score` | one score + drill-down tabs | base = `health-score` (richest, 625 LOC) |
| **Performance** | `attribution`, `benchmark`, `returns` | tabs: returns / vs-benchmark / attribution | fix age-agnostic benchmark percentiles here |
| **Dividends** | `dividends`, `dividend-calendar`, `dividend-forecast` | one page; calendar + forecast as sections | base = `dividends` |
| **Cash Flow** | `cash-flow`, `budget`, `expenses`, `income`, `subscriptions` | tabs: flow / budget / expenses / income; subscriptions a section of expenses | base = `cash-flow` (512 LOC) |
| **On Track?** | `fi`, `retirement`, `monte-carlo`, `what-if`, `compare` | one projection, mode switch (FI / retirement / Monte Carlo / what-if) | base = `monte-carlo` engine + `fi` framing |
| **Net Worth** | `net-worth`, `nw-history` | history as a tab | base = `net-worth` (688 LOC) |
| **Markets** | `markets`, `macro`, `sentiment`, `fx` | sections within one page | base = `markets` |
| **Valuation** | `valuation/dcf`, `valuation/reverse-dcf` | mode toggle (forward / reverse) | already siblings under `/valuation` |
| **Thesis** | `thesis`, `notes`, `journal` | one writing/conviction surface (thesis + freeform notes + dated journal) | base = `thesis` (572 LOC) |
| **Tax** | `tax`, `tax-harvest` | tabs: awareness / harvest | fix fragile ticker-string tax classification here |

Debt-payoff stays standalone in the spine; fix the freed-minimum carry-forward bug when its page is
next touched.

## Deferred to Lab (code kept, off launch nav)

`insurance`, `fees`, `sectors`, `position-size`, `correlation` (diversification), `asset-location`,
`emergency-fund`, `milestones`, `annual-review`, `behavior`, `learn`, `plan`, `stock-compare`,
`affordability`, `rebalance`. (~15 pages.)

Rationale: each is either off-thesis, a thin/utility tool, or duplicative of a spine feature. They
remain available via Lab for power users and can be promoted later if real users ask.

## Borderline calls (decided)

- **Tax → spine** (tax-loss harvesting is a real money-saver, on-thesis).
- **Earnings AI → spine** (Research), contingent on the AI key.
- **Affordability → Lab** (user's call, despite being on-thesis).
- **Rebalance → Lab** (slight tension with "hold your winners").

## Reversibility / rollback

- Defer = a one-line removal from `NAV_GROUPS`; re-add to roll back.
- Merge = old routes redirect; revert the redirect to restore the standalone page.
- The Spine/Lab toggle means nothing is truly hidden — Lab exposes everything.

## Risks & open questions (validate during planning)

- **Merge internals unverified.** The "base page" picks above are from LOC + route names, not a
  line-by-line read of all 28 cluster pages. The plan's first step per merge is to open the cluster
  and confirm the base + which tabs/sections survive.
- **Shared imports.** A deferred/merged page may export helpers imported elsewhere (e.g.
  `lib/smart-alerts.ts`). Grep importers before redirecting a route.
- **Personalization + Simple/Advanced coupling.** `sidebar-personalization.ts` (`ITEM_TAGS`,
  `ALL_HREFS`) and `CORE_HREFS` both reference hrefs that will change. Update both with the nav.
- **Search/command palette** likely enumerates routes — update its source list to match the spine,
  keep Lab routes findable.
- **`/dashboard` widgets** may deep-link to soon-deferred pages; re-point to spine equivalents.

## Verification

- `npm run type-check` (tsc --noEmit) after nav + redirect changes (safe with dev server running;
  never `npm run build` while the preview server is up — shared `.next`).
- Run the app; confirm the spine renders, deferred routes still resolve by URL, redirects land on
  the right tab, no dead links in dashboard/search.
- Spot-check each merged page renders all absorbed content and the §11 legibility invariants hold.

## Sequencing (high level — detailed in the plan)

1. Nav rework + Spine/Lab toggle (denav defers, regroup spine). Lowest-risk, immediate clarity win.
2. Redirect the "obvious" merges that are already near-siblings (Valuation, Net Worth, Tax).
3. Tabbed merges in priority order: Cash Flow, On Track?, Performance, Portfolio Health, Markets,
   Dividends, Thesis. Fix the named correctness bugs as each cluster is touched.
4. Restart the backend and verify Reflect streams end-to-end (key already configured) so the spine
   centerpiece is confirmed live.
