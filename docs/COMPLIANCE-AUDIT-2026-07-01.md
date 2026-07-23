# Velnor compliance + coherence audit — 2026-07-01

## ✅ FOLLOW-UP SWEEP (2026-07-22) — frontend deterministic insight strings

The 07-01 pass hardened the **backend AI prompts** and removed ticker recs, but it
did **not** fully catch the frontend's own **computed-insight strings** (the
deterministic text each page assembles from the user's numbers). B4 claimed
`lib/benchmarks.ts` was reworded, but only its ticker recs were — the metric-insight
strings still gave directives until this sweep. Deterministic/rule-based output counts
as advice the same as AI output (robo-advice is still advice), so these mattered.

Reworded to state the metric against a named benchmark (grade/number carries the
standing, reader draws the conclusion). All string-only, logic unchanged; type-check +
12 tests + production build clean. Commits `44dd242`, `a207508`, `93d91e3`, `6019acd`,
`f7cebbd`, plus the two below.

- **`app/(dashboard)/health-score`** — every dimension insight, the hero summary, and
  the "Priority Actions" section (renamed "Where you score lowest"). "Urgently increase
  contributions" / "Focus on paying down debt" / "Consider rebalancing" etc. all → metric
  statements. Removed a dead `Dimension.color` field that still carried banned hues.
  **Verified live authed** (health-score, goals, benchmark all render observational,
  console-clean).
- **`lib/benchmarks.ts`** — the remaining B4 gap: concentration/debt/savings/invest/
  emergency insights de-directived; "Recommended ..." labels → "Benchmark ...".
- **`lib/smart-alerts.ts`** (the live path, now wired) — "Prioritize debt reduction" →
  states the shortfall.
- **`components/goals/GoalDetailPanel.tsx`** — "consider increasing contributions" →
  "projected $X short at the current contribution and return rate" (also dropped 2 em-dashes).
- **`components/dashboard/DailyDebrief.tsx`** — softened "a good time to review your
  strategy"; cleared "  - " separators.
- **`lib/learning-cards.ts`** (renders on dashboard) — concentration card's "worth
  checking if this fits your risk tolerance" (a suitability nudge on a >40% position) →
  pure explanation.
- **`lib/behavioral-analysis.ts`** (/behavior) — recency-bias EVIDENCE field carried a
  directive; moved the caution to the tip, evidence now observational. Other tips left:
  behavior-level Socratic framing, which the operating line permits.
- **B7 closed** — `monte-carlo` ("consider having a fallback plan" → states the failure
  share) and `retirement` ("Consider retiring later, increasing savings...") → both now
  describe what moves the outcome and point at the inputs, no imperative.

Also fixed here, adjacent: `proxy.ts` (live Next 16 middleware) matched public paths with
`startsWith`, so `/health-score` matched `/health` and skipped session-refresh — now
segment-boundary matched (not an auth bypass; the dashboard layout gates server-side).

**learn-content.ts intentionally NOT swept** — generic educational course material, not
tied to the user's holdings, which the operating line permits.

---

## ✅ RESOLUTION LOG (2026-07-01, same day — fixes applied)
All findings below except §E fixed in this pass. Backend imports + frontend
type-check both clean. NOT browser-verified (authed pages + live AI/backend
can't run in the sandbox) — click through Reflect / Smart Alerts / Journey /
Learn on first real login.
- **B1 `/ai/learn`** — guardrail injected; every concept instruction reworded to
  TEACH the framework on the ticker as a worked example (no verdicts, no
  "suitable replacement securities", no position-band prescriptions); the user's
  personal position is no longer fed into the prompt.
- **B2 `/ai/plan`** — guardrail injected; reframed to savings/cash-flow/goals +
  broad asset-class only; specific tickers removed from the prompt; "recommendation"
  language softened to "considerations".
- **B3 Smart Alerts** — both `lib/smart-alerts.ts` (currently unused) and the live
  `smart-alerts/page.tsx` messages reworded from directives ("buying opportunity",
  "take profit", "consider trimming", "Buy before the ex-date", "consider adding
  {sectors}/bonds") to observation-plus-question. Planning-level debt/savings copy
  left as-is (outside MiFID perimeter).
- **B4** — ticker recs removed from `correlation` (BND/AGG/TLT), `risk`,
  `position-size`, `lib/benchmarks.ts` → asset-class/observational wording.
- **B5 `/ai/earnings`** — guardrail injected; analyst target/consensus now
  explicitly attributed as third-party Wall Street data (via Yahoo).
- **B6 Journey** — `_journey_state` relabeled to observational strings
  (`bear case logged`, `in profit`, `thesis quiet`, `position open`; kept
  `conviction tested`/`underwater`/`watching`); fixed latent bug where a missing
  live price falsely read as "underwater". TS `JourneyState` union updated to match.
- **C1 Reflect starters** — replaced the decline-bait ("should that worry me?",
  "is my risk right?") with retrospective, answerable prompts.
- **C2 Reflect prompt** — added retrospective rule #12 (reason about their record,
  no forward calls on specific holdings); softened rule #11 ending and opening
  instruction #2 (state weight as fact, never characterize).
- **C3 DCF** — "appears undervalued/overvalued" reworded to anchor on the user's
  own model ("your model's fair value sits above/below price").
- **D Reflect retrospective data** — NEW: `_fetch_closed_summary` (FIFO realized
  P&L per sold ticker, reuses closed router) + `_fetch_journal_summary` (action /
  conviction / outcome / rationale) now feed the reflection prompt via two new
  context blocks. This is the USP payoff — Reflect can now reason about the user's
  actual sell record and logged convictions.
- **§E Calibration scorecard** — BUILT. Backend `routers/calibration.py`
  (`GET /calibration`, registered in `main.py`) + `lib/calibration.ts` +
  `/calibration` page + nav entry (Accuracy & Conviction, after Closed). Deterministic,
  no AI: hit-rate by conviction level from the decision journal, plus sell-timing
  ("ran without you" / "dodged the drop", median realized) from FIFO closed trades.
  Reuses `_realize` from the closed router. Backend imports + type-check + 12 tests all
  clean. NOT browser-verified (authed + live backend).

Remaining nit not addressed: `SEVERITY_CONFIG` emoji/blue in `lib/smart-alerts.ts`
— that file is currently unused (dead), so cosmetic-only; sweep if it's ever wired up.

---



Cross-check of every AI prompt and feature against the no-advice guardrail
(MiFID II / KNF "doradztwo inwestycyjne"; ESMA 2023: disclaimers do not
reclassify advice — substance must be non-directive). Reference:
`_NO_ADVICE_GUARDRAIL` in `backend/app/services/ai_service.py`, memory
`project_no_advice_guardrail`, commit `703f2c8`.

**The operating line (use this to judge every feature):**
- **Instrument-level directives = forbidden.** Any explicit or implicit
  recommendation (buy/sell/trim/add/replace/"undervalued"/"suitable") on a
  *specific named security*, personalized to the user. Deterministic/rule-based
  output counts the same as AI output (robo-advice is still advice).
- **Behavior-level and past-performance output = safe.** Observations about the
  user's own decisions, calibration, and record ("you logged conviction 4 and
  sold 3 weeks later"), generic frameworks, math on user-supplied assumptions,
  and pointers to licensed professionals are outside the perimeter.

---

## A. Compliant — verified in current code ✅

| Surface | Verdict |
|---|---|
| `/ai/reflect` (Reflect) | Guardrail injected; Socratic rules 4/9/10 sound; inline disclaimer renders |
| `/ai/alert-insight` | Guardrail injected; "do not prescribe an action" rule present |
| `/ai/thesis-review` | Guardrail injected; explicitly bans INTACT/DRIFTING/BROKEN verdicts (handoff §Phase-5 text describing a "verdict" is stale — code is fixed) |
| `/ai/valuation/{ticker}` | Guardrail injected; framework-only, no price target |
| Closed & Lessons | Retrospective + factual ("ran without you"/"dodged the drop" describe the past, prescribe nothing) — this is the model for the whole app |
| Thesis / Journal / Notes | User's own words only |
| Screener, DCF/Reverse-DCF calculators | Objective criteria / user's own assumptions (see C3 for one copy nit) |
| `lib/advisor-recommendations.ts` | Recommends *professional types*, not instruments — actively good |
| Disclaimer plumbing | `lib/disclaimer.ts` single source; footer app-wide; inline variant on all 5 AI panels (reflect, smart-alerts, earnings-insights, journey/[ticker], company) |

## B. Legal gaps — ranked

### B1. CRITICAL — `POST /ai/learn` (`_build_learn_prompt`, ai_service.py ~449)
No guardrail, and the concept prompts *instruct* the model to give advice,
with the user's actual position (qty/cost/P&L) injected via `holding_context`:
- `tax-loss-harvesting`: "suggest 2-3 **suitable replacement securities**" — an
  explicit specific-instrument recommendation + a suitability call. Worst line
  in the codebase.
- `when-to-sell`: "Give a **clear verdict** for each condition" on the named
  ticker they hold.
- `margin-of-safety`: "estimate a rough intrinsic value range… what margin of
  safety exists" → implicit over/undervalued verdict.
- `position-sizing` / `portfolio-concentration`: "appropriate position band",
  "what maximum portfolio weight would you defend" → suitability on their book.

Fix: inject `_NO_ADVICE_GUARDRAIL`, rewrite the offending concept instructions
to teach the framework generically ("how would an investor evaluate…") and
**drop `holding_context` from the prompt** (personalization is the limb that
makes it advice). Or park `/learn` out of the app until reworded.

### B2. HIGH — `GET /ai/plan` (`_build_plan_prompt`)
No guardrail. Prompt literally: "You are a sharp personal financial advisor…
Anchor EVERY recommendation… a concrete allocation" and includes the user's
top-5 tickers. Asset-class-level allocation is arguably outside MiFID (not a
specific instrument), but nothing stops the model from recommending on the
named top positions, and the framing is maximally advisory.
Fix: inject guardrail + constrain to asset-class level, remove `top_holdings`
from the prompt, reframe from "advisor writes your plan" to "here is how your
stated plan maps to your numbers". It's already Lab-only — acceptable to defer
behind a rewrite, not acceptable to ship at launch as-is.

### B3. HIGH — Smart Alerts deterministic copy (spine feature)
The AI insight was fixed (d9fc3c4) but the rule-generated alert *messages*
still prescribe on specific holdings:
- `lib/smart-alerts.ts:92` "Could be a **buying opportunity**…"
- `lib/smart-alerts.ts:105` "…whether to **take some profit**."
- `lib/smart-alerts.ts:132` "Some investors take partial profits at this level."
- `lib/smart-alerts.ts:254` "**Buy before the ex-date**…"
- `app/(dashboard)/smart-alerts/page.tsx:130` "**Consider trimming** to below
  20% and reallocating…"
- `page.tsx:148` "could be a buying opportunity"; `:217` "Consider adding
  {sectors}"; `:437` "consider adding bonds, REITs, or lower-beta holdings".
Fix: reword every message to observation + question ("Price is X% below your
cost. Does the reason you bought still hold?"). Keep the fact, delete the verb.

### B4. HIGH — `correlation/page.tsx:146`
"Consider adding bonds (**BND, AGG**) or treasuries (**TLT**)" — names specific
tickers to buy. Clearest single violation outside /learn. Fix: asset-class
words only, no tickers. Same class, milder: `risk/page.tsx:225`,
`position-size/page.tsx:182`, `lib/benchmarks.ts:283` ("your profile suggests
~N holdings" = suitability phrasing).

### B5. MEDIUM — `GET /ai/earnings/{ticker}` (`_build_earnings_prompt`)
No guardrail. Content is analytic not directive, but it pipes through Yahoo's
`analyst_target` + `recommendationKey` ("Consensus: Buy") and says "write for
an investor who already holds this stock". Third-party consensus reproduced
verbatim-with-attribution is data, not our recommendation — keep it clearly
attributed ("Yahoo consensus") and inject the guardrail for consistency.

### B6. MEDIUM — Journey state rubric (`routers/journey.py::_journey_state`)
The app itself pronounces "**thesis broken**" / "drifting" / "on thesis" on a
specific holding — the exact verdict vocabulary we stripped from the AI. It is
derived from the *user's own* latest stance, which is defensible, but the label
reads as Velnor's judgment. Fix = relabel to observational, user-anchored
strings: `thesis broken`→"bear case logged", `drifting`→"thesis quiet",
`on thesis`→"in profit · bullish", `conviction tested` (keep — describes them),
`underwater` (keep — factual). Colour logic can stay.

### B7. LOW — `monte-carlo`, `debt-payoff`, cash-flow "consider reducing
withdrawals / prioritize debt reduction" etc. — not instrument-specific;
financial-planning guidance is outside the MiFID perimeter. No change needed.
`behavioral-analysis.ts` tips ("set stop-losses", "would you buy this today?")
are generic technique — fine (but see C4 emoji).

## C. Coherence findings

1. **Reflect starters contradict the guardrail** (`reflect/page.tsx:388`): the
   empty state suggests "Where am I most concentrated, **and should that worry
   me?**" and "**Is my risk level actually right for me?**" — questions the AI
   is required to decline. First-touch UX = ask → get deflected. Replace with
   answerable, retrospective starters (see D).
2. **Reflect prompt internal tension**: opening-instruction #2 tells the model
   to surface "a concentration (e.g. weight > 30%) or a behavioural gap between
   stated risk tolerance and what they hold" — adjacent to the banned
   "you're over-concentrated". Rule 11's "name one concrete next step" invites
   directive endings. Soften both (next step → "one thing to watch or write
   down"; concentration → state the weight as fact, ask, never characterize).
3. **DCF page copy** (`valuation/dcf/page.tsx:620,632,696`): "appears
   undervalued/overvalued" — it's the user's own model, so anchor the wording
   to their assumptions: "Your assumptions price {ticker} X% above/below the
   market." Keep the good line "Overvaluation doesn't mean sell — revisit your
   thesis."
4. **Design-system violations in compliance-adjacent code**:
   `lib/smart-alerts.ts` `SEVERITY_CONFIG` uses emoji icons (🔴🟡🔵🟢) and
   blue (`bg-blue-500/10`) — both banned (§8, teal-only accent);
   `behavioral-analysis.ts` has an `emoji` field per bias. Sweep when rewording.
5. **Stale handoff text**: HANDOFF §Phase-5 still describes thesis-review as
   streaming "a verdict (INTACT/DRIFTING/BROKEN)"; superseded by the guardrail
   section + current code. Trust the code.

## D. Reflect — make the USP retrospective (recommendation)

The user's instinct is right and it is also the legal safe harbor: **shift
Reflect's center of gravity from commentary on current holdings (risky) to
reflection on the user's own past decisions and calibration (safe)**.
Instrument-forward = perimeter-adjacent; behavior-retrospective = clean.

Concretely:
- System prompt: add a directive that when discussing performance, the model
  reasons about *what already happened* vs. *what the user wrote at the time*
  (thesis entries, journal conviction, buys/sells, Closed lessons) and must not
  project forward on specific instruments ("no statements about where a
  specific holding is headed; past facts + their own words only").
- Feed it the retrospective data it currently lacks: closed positions +
  realized P&L + "since you sold" (the `/closed` aggregation), journal entries
  with conviction + outcome. Today Reflect gets holdings/goals/notes/macro but
  none of the post-mortem record — the pivot's whole point.
- Replace the contradicting starters with retrospective ones:
  "What does my sell history say about my patience?", "Walk me through what I
  wrote about {topTicker} vs. what happened", "Which of my past convictions
  aged best?", "React to my latest notes".

## E. New-feature call (for "finish the technicals")

**Recommended: Conviction Calibration scorecard** — deterministic, no AI
needed, pure past-performance, and it *is* the investor-accuracy USP made
visible. All inputs exist: `DecisionJournalEntry.conviction` (1-5),
`ThesisEntry` stances, `Transaction` history, `/closed` FIFO outcomes.
One aggregation endpoint + one page: hit-rate by conviction level ("when you
logged 5/5 you were right 71%"), hold-time vs. outcome, sell-timing score
(median "since you sold"), bull/bear call accuracy from thesis stances.
Zero legal exposure (user's own record, backward-looking), high moat, feeds
Reflect's retrospective mode as context. Skip any new forward-looking feature.

## F. Suggested execution order

1. B1 `/ai/learn` prompts + guardrail (worst exposure, contained file)
2. B3 Smart Alerts copy reword (+ C4 emoji/blue sweep in same files)
3. B4 ticker recs in correlation/risk/position-size/benchmarks copy
4. B2 `/ai/plan` guardrail + reframe (or park for launch)
5. B6 Journey state relabel (backend strings + any frontend display)
6. C1/C2/D Reflect: starters, prompt softening, retrospective directive + closed/journal context
7. B5 earnings guardrail + consensus attribution (quick)
8. E Calibration scorecard (the "new feature", if time before soft-launch)

Everything above is prompt/copy/aggregation work — no migrations, no new deps.
The KNF/lawyer caveat stands: this is the conservative default pending Polish
counsel sign-off.
