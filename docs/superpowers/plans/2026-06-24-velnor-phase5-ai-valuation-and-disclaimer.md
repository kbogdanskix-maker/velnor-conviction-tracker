# Velnor Phase 5 — AI Valuation + Thesis-Review + Inline Disclaimer · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Two on-demand AI jobs that deepen the wedge — **thesis review** ("is my thesis still intact given the latest results/news?") and **valuation coaching** ("how should I value this business, and with what multiple?") — plus the compliance follow-up: render the inline disclaimer under **every** AI response.

**Architecture:** Reuse the existing streaming stack (`ai_service.py` `AsyncAnthropic` + `/ai/*` SSE + `apiStreamPost`/`streamReflect` on the frontend; AI key is live). Add two prompt builders + endpoints; both **ground strictly in the user's own data** (holdings, their thesis entries, and only numbers we actually have) and never fabricate figures. Surface them where the user already is: thesis review on `/thesis` + `/journey/{ticker}`; valuation on `/company` (+ optionally seed a `DcfModel`).

## Task 1 — Inline disclaimer under AI output (compliance, do first — small)
The `inline` variant already exists in `components/shared/Disclaimer.tsx` (built Phase 1, currently unused).
- [ ] Render `<Disclaimer variant="inline" />` directly beneath the AI response block on every AI surface: Reflect (`/reflect`), Smart Alerts insight (`/smart-alerts`), Earnings AI (`/earnings-insights`), and any new Phase 5 output. Client-rendered, so it's independent of model text.
- [ ] Verify each surface shows it once, beneath the streamed answer. Commit.

## Task 2 — Thesis review (backend + UI)
- [ ] `ai_service.py`: `_build_thesis_review_prompt(ticker, thesis_entries, holding, recent_news, earnings)` + a streaming fn. Inputs: the user's `ThesisEntry` trail for the ticker (from `/thesis` API or DB), current position, recent ticker news (`get_ticker_news`), and earnings/estimates (`get_earnings_raw_data`). The model judges: is the original thesis intact, drifting, or broken — citing the user's own words and only real data. Educational/non-directive (same guardrails as `_build_reflection_system_prompt`, no fabricated numbers, no boilerplate disclaimer — UI handles it).
- [ ] Endpoint `POST /ai/thesis-review` (navigator tier, reuse `_enforce_insight_quota`).
- [ ] UI: a "Review this thesis" button on `/thesis` thread view and/or `/journey/{ticker}`; stream the answer (reuse the Reflect streaming pattern) with the inline disclaimer beneath.
- [ ] Verify via probe (build the prompt for SOFI's 6-entry thesis) + live stream. Commit.

## Task 3 — Valuation coaching (backend + UI)
- [ ] `ai_service.py`: `_build_valuation_prompt(ticker, data)` where `data` = sector/industry + growth stage + margins + the metrics already pulled in `get_earnings_raw_data`. The model recommends the **right framework for the business type/stage** and walks the key assumptions, e.g.: hypergrowth / neo-cloud (Nebius) → EV/Sales + durability + path-to-margin; banks → P/TBV + ROTCE; mature/cash-generative → P/E, DCF, FCF yield. Output is a coaching scaffold + the assumptions to set, NOT a black-box target. Never invent live multiples it wasn't given.
- [ ] Endpoint `POST /ai/valuation/{ticker}` (navigator tier, quota).
- [ ] UI: a "How should I value this?" action on `/company/{ticker}`; stream + inline disclaimer. Optionally a "Start a DCF from this" button seeding a `DcfModel`.
- [ ] Verify via probe (Nebius/NBIS → EV/Sales; a bank like JPM → P/TBV) + live. Commit.

## Notes / guardrails
- **Prerequisite:** backend restarted with the AI key (it is, on :8000). A live AI call costs money — keep test calls minimal.
- Reuse `_enforce_insight_quota` (free tier blocked, voyager 10/day, navigator unlimited) so these honor the shared daily counter.
- All prompts: ground in real data, decline to invent numbers, educational/non-directive. The UI disclaimer (Task 1) is the compliance layer — prompts should NOT embed their own disclaimers.
- After Phase 5: planning-section merges (consolidation spec), then the landing **sail** showpiece
  (`2026-06-23-velnor-sail-instrument-design.md`).
