# Velnor — Conviction Tracker Pivot (Master Design)

_Date: 2026-06-23 · Branch: `feat/ui-design-system-phase-0` · Status: design approved (vision + scope + IA); plan pending_

> **Supersedes** `2026-06-23-velnor-feature-consolidation-design.md`. The consolidation (merges,
> Lab, Spine/Lab toggle) still happens, but now in service of an **investing-first** reframe rather
> than a co-equal spine. The sail-instrument spec is unaffected (landing showpiece).

## Positioning

**Velnor is where your investment convictions live.** Track what you believed and why, watch it
against what actually happened (news, results, price), and learn from every hold and every sell.
Personal finances ride alongside as *context*, not the main event.

The product competes on **investor accuracy** — being right more often by being honest about your own
thesis, conviction, and track record — not on advanced modeling, transcripts, or pro-grade data.
Nobody occupies this seat: Koyfin/Simply Wall St have no goals or conviction history; Empower/Monarch
have no research; ProjectionLab has no holdings intelligence.

- **ICP:** FIRE-minded, self-directed investors who pick their own stocks and want to manage risk and
  evaluate their own performance more effectively.
- **Ambition:** focused, profitable SaaS — niche is the moat, not a problem.
- **Timeline:** full vision, relaxed build window; **soft-launch ~July 1** (promo creative already
  matches this direction), then legal.

## What changes

1. **Investing accuracy/conviction becomes PRIMARY.** Planning (Net Worth, Cash Flow, Goals, On
   Track?) collapses into a **secondary "Planning" nav section** below the investing core. One app,
   clear hierarchy. (Decided: secondary section, not a separate mode, not Lab.)
2. **Conviction and the thinking become first-class** — notes/thesis are versioned, saved everywhere,
   and surfaced as the spine of each stock's story.
3. **The Stock Journey map is the signature feature.**

## Information architecture (new nav)

```
Dashboard  (reframed: accuracy + open convictions at a glance)

ACCURACY & CONVICTION  (primary)
  Positions            portfolio holdings, each links to its Journey
  Stock Journey        the map — per-stock timeline of conviction vs reality   [SIGNATURE]
  Conviction / Thesis  versioned notes per idea (ThesisThread/Entry)
  Reflect (AI)         review my thesis · how should I value this?
  Lookout              watchlist = stocks you're waiting to (re)cover
  Closed & Lessons     sold-position post-mortems: what happened after, lesson

RESEARCH  (support, not the product)
  Screener · Company deep-dive · AI Valuation · Earnings AI

PLANNING  (secondary, collapsed)
  Net Worth · Cash Flow · Goals · On Track?

LAB  (everything deferred — reuse existing Simple/Advanced toggle)
  ...the ~15 deferred tools from the consolidation spec
```

## Features

### 1. Stock Journey map (signature) — NEW UI, mostly reuse data
A per-stock timeline. Horizontal axis = time; price line underneath; **event bubbles** layered on:
- entry/add/trim/sell (from `Transaction`)
- conviction snapshots / note edits (from `ThesisEntry`, which carries `created_at`)
- decisions w/ conviction 1–5 (from `DecisionJournalEntry`)
- news (news router) and earnings dates (quotes/company)

**Color encodes assumption-vs-performance:** green = thesis playing out, amber = drifting, red =
broken. v1 colour source = your own conviction trend + price-vs-entry; richer auto-inference later.

- **Data:** new aggregation endpoint `GET /journey/{ticker}` that merges the tables above into a
  sorted event stream. No new storage for v1 — it's a join + serialize.
- **Layout:** "map and event-bubble oriented" per the brief. Bubbles colour-coded; click a bubble to
  open the underlying note/transaction/news. Lane or vertical-offset by event type.

### 2. Conviction / Thesis — REUSE `ThesisThread`/`ThesisEntry`, add save UX
Make thesis a first-class, always-saved, versioned notebook keyed to a ticker. Each edit is a new
`ThesisEntry` (preserve history; never overwrite). Capture a lightweight **assumption/expectation**
per entry (what you expect to be true) so the map can later score assumption-vs-reality. Absorbs the
old `notes` and `journal` surfaces (consolidation: Thesis = notes + journal + thesis).

### 3. Reflect (AI) — REUSE `/ai/reflect` streaming; new prompts
Two on-demand jobs (key is connected):
- **Thesis review:** "here's my thesis + the latest news/results — is it still intact?" Grounded in
  the user's own ThesisEntries + holdings; never fabricates numbers (existing guardrail).
- **Valuation coaching** (see 4).

### 4. AI Valuation helper — NEW prompt/endpoint, reuse stream + `DcfModel`
"How should I value this business?" → AI recommends the **right framework for the business
type/stage** and walks the assumptions:
- hypergrowth / neo-cloud (e.g. Nebius) → **EV/Sales**, growth-durability + path-to-margin
- banks → **Price/TBV**, ROTCE
- mature profitable → **P/E / DCF**; cash-generative → **FCF yield**; etc.
Output is a starting framework + key assumptions, optionally seeding a saved `DcfModel`. Not a
black-box price target — a coaching scaffold.

### 5. Lookout — REUSE `WatchlistItem`, reframe
Watchlist becomes the "lookout point": stocks you've researched and are waiting to (re)enter, with a
saved reason and the trigger you're waiting for. Ties to Closed & Lessons (sold → back on the
lookout).

### 6. Closed & Lessons (post-mortems) — REUSE `Transaction`, add outcome note
Derive closed positions from buy/sell transactions. For each: realized result, **price-after-sale
tracking** (quotes), and a **lesson** note (a tagged `ThesisEntry` or kv). "You sold X at $Y; it's
$Z since — what's the lesson?" This is the behavioral-accuracy mirror.

### 7. Model tab — results vs management guidance — NEW, data-hard (last phase)
Track **what management said vs what happened**. Honest constraint: historical guidance/transcripts
are a real data problem we don't have a clean source for. Phased:
- **v1 (now-ish):** results vs **your** assumption (from ThesisEntry expectations) + yfinance
  earnings/estimates history (beats/misses).
- **v2 (fast-follow):** manual guidance capture (user logs a guidance datum per quarter).
- **v3 (later):** AI-extracted guidance from transcripts.
Sequenced LAST; does not gate launch.

### 8. Planning (secondary) — REUSE, demote
Net Worth, Cash Flow, Goals, On Track? collapse into one secondary section (merges per the
consolidation spec still apply). Present as "your money context," visually quieter than the
investing core.

## Data model summary

**Reuse as-is:** `ThesisThread`, `ThesisEntry`, `DecisionJournalEntry` (`conviction` 1–5),
`Transaction` (buy/sell/dividend), `Holding`, `WatchlistItem`, `DcfModel`+`ShareToken`, `kv`
(`theses`, `reflection_notes`), `Goal`, `NetWorthAsset`, `CashFlowEntry`.

**New / extended:**
- `GET /journey/{ticker}` aggregation endpoint (no new table for v1).
- A nullable **expectation/target** field on `ThesisEntry` (or a typed kv) to enable
  assumption-vs-performance colouring.
- A **post-mortem / lesson** marker (tag on `ThesisEntry` or a small kv key) for Closed & Lessons.
- (v2+) a guidance-capture table for the Model tab.

## AI architecture

Reuse `ai_service.py` (`AsyncAnthropic`, key configured) + the `/ai/reflect` SSE streaming pattern
and `apiStreamPost`/`streamReflect` on the frontend. Add prompt templates for **thesis-review** and
**valuation-coaching**; both ground strictly in the user's own data and decline to invent numbers.
**Prerequisite:** restart backend so the key is live; confirm `/ai/reflect` streams end-to-end.
Claude never reads/prints/modifies the secret.

## Compliance & disclaimers (guardrail) — cross-cutting

Velnor helps users evaluate securities and surfaces AI thesis reviews and valuation coaching. Every
such surface must carry: **"Not investment advice. For educational purposes only. Consult a licensed
financial advisor before making decisions."** Enforced in two layers (don't trust the model to
remember):

1. **Deterministic UI.** A shared `<Disclaimer />` component:
   - A persistent, quiet line in the app footer / shell on all investing + planning surfaces.
   - Appended beneath **every AI response** (Reflect, thesis review, valuation coaching) as a
     non-dismissible micro-label — rendered by the client, independent of model output.
   - On the AI Valuation helper and Journey, a short inline note where outputs could read as a
     recommendation.
2. **AI system prompt.** The Reflect / valuation / thesis-review prompts instruct the model to be
   **educational and non-directive**: explain frameworks and trade-offs, never issue personalized
   buy/sell/hold directives, never invent numbers, and defer to a licensed advisor for decisions.
3. **First-run acknowledgment** (lightweight): a one-time "Velnor is an educational tool, not an
   advisor" acknowledgment on first investing-surface visit (stored in `kv`/profile). Strengthens the
   legal posture; non-blocking.

Ties to the deferred `/privacy` + `/terms` pages (controller = individual, pre-launch scope). Wording
lives in one constant so it's consistent everywhere and easy for legal to revise. Tone: quiet and
muted (design-system §11 legibility), never alarmist, never competing with data.

## Visual redesign integration

The "Instrument" design system (`design-system.md`) applies, focused on the **new core surfaces**
first (Dashboard, Stock Journey, Conviction/Thesis, Reflect, Lookout, Closed & Lessons, Positions).
Deferred/Lab pages do not need the polish pass. Journey map honours §11 legibility (colour never the
only signal; bubbles carry icon/label; contrast on dark surfaces).

## Sequencing (relaxed timeline → soft-launch ~July 1)

1. **IA pivot + nav** — investing-first groups, Planning secondary, Lab toggle. Reuse
   `Sidebar.tsx` + Simple/Advanced machinery. Lowest risk, immediate clarity. **Ship the shared
   `<Disclaimer />` component + wording constant here** (cheap, global) and wire it into the shell
   footer; AI-response placement lands with the AI phases.
2. **Conviction first-class** — Thesis versioned + saved everywhere; absorb notes + journal.
3. **Stock Journey map v1** — `/journey/{ticker}` aggregation + event-bubble UI + colour from
   conviction/price.
4. **Closed & Lessons** — post-mortems from transactions + lesson notes + price-after tracking.
5. **AI valuation helper + thesis review** — new prompts on the existing stream.
6. **Lookout** reframe + **Dashboard** reframe (open convictions at a glance).
7. **Visual redesign** of the core surfaces (interleaved as each lands).
8. **Planning demotion + consolidation merges** (secondary section).
9. **Model tab v1** (results vs your assumption) — last; v2/v3 post-launch.
10. **Landing sail instrument** (separate spec) — slot in as a delight.

## Risks & open questions (validate in planning)

- **Journey colouring rubric** — the exact assumption-vs-performance → colour mapping needs a
  concrete, defensible rule for v1 (proposal: conviction trend × price-vs-entry × thesis-intact
  flag). Pin it in the plan.
- **Thesis/notes current persistence** — confirm whether `thesis`/`notes` pages use
  `ThesisThread/Entry` (relational) or the `theses` kv blob, and migrate to the relational, versioned
  model cleanly without losing existing data.
- **Ticker keying** — Journey/Thesis/Lookout/Closed all key on ticker; ensure a single canonical
  ticker normalization across them.
- **Model tab data source** — no clean guidance-history source; v1 must be honest about what it can
  and can't show.
- **Shared imports / dead links** — as planning demotes and pages merge, grep importers, update
  search/command palette and dashboard deep-links.

## Verification

- `npm run type-check` after structural changes (never `npm run build` while the preview dev server
  runs — shared `.next`).
- Run the app; verify the new IA renders, Journey map draws from real data, conviction saves persist
  across reload, AI streams (post backend restart), planning is reachable but secondary, Lab exposes
  deferred tools, no dead links.
- §11 legibility pass on every new surface.
