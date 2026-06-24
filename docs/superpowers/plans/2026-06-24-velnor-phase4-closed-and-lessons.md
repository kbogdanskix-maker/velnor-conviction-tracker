# Velnor Phase 4 — Closed & Lessons (sold-position post-mortems) · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** A "Closed & Lessons" surface — for every position you've sold, show realized P&L and **what happened after you sold** (the counterfactual), plus a place to record the lesson. The behavioral mirror that completes the conviction loop: *you sold X at $Y; it's $Z now — what did you learn?*

**Architecture:** Read-only derivation over existing `Transaction` rows (no migration for v1). A closed/trimmed position = a ticker whose sells reduced quantity (fully to ~0 = closed; partial = trimmed). Realized P&L from matched buys/sells; "since you sold" from the live quote vs last sell price. Lessons are stored as **thesis entries** (reuse `ThesisThread`/`ThesisEntry`, `entry_type="note"`) so they live in the same conviction trail — no new table.

**Tech:** FastAPI + Next.js/SWR. Verify backend via DB probe (no auth), frontend via type-check + persisted-session preview.

Source spec: `2026-06-23-velnor-conviction-tracker-pivot-design.md` (§ Features 6).

---

## Context (verified this session)
- `Transaction`: `portfolio_id, ticker, transaction_type (buy|sell|dividend|split|fee), quantity, price, executed_at`. Sells are retained.
- `Holding` = current materialized position (absent ⇒ fully closed).
- Reuse helpers: `market_data.get_quotes` (live price), `market_data.get_price_on_date` (price on a date), and the `thesis` router for lesson notes.
- Ticker normalization: reuse `_norm_ticker` (uppercase+trim) — keep identical to Thesis/Journey/alerts.

## Task 1 — Backend: closed-positions derivation
**Files:** `backend/app/routers/closed.py` (new) + register in `main.py` (prefix `/closed`).
- [ ] `GET /closed` → for the user's default portfolio, group transactions by ticker; compute realized lots (FIFO match buys→sells). For each ticker with realized sells, return: `{ticker, name, realized_pnl, realized_pnl_pct, total_proceeds, last_sell_date, last_sell_price, current_price, since_sold_pct (current vs last_sell_price), still_held: bool, shares_remaining}`. Mark `fully_closed = shares_remaining ~ 0`.
- [ ] `since_sold_pct` is the lesson signal: positive = "it kept running after you sold" (you churned a winner); negative = "good exit".
- [ ] Skip tickers with no sells. Order by `last_sell_date` desc.
- [ ] **Verify** with a throwaway DB probe for the test user (it has sell transactions on some tickers) — print the derived closed list; confirm realized P&L + since-sold math. Delete the probe.
- [ ] Commit.

## Task 2 — Frontend: lib + Closed & Lessons page
**Files:** `frontend/lib/closed.ts` (types + `useClosed()` SWR), `frontend/app/(dashboard)/closed/page.tsx`.
- [ ] List each closed/trimmed position: ticker (mono), realized P&L (gain/loss ▲▼), and a prominent **"Since you sold: +X% / −Y%"** with semantic colour (red when it ran up after you sold — that's the painful, instructive case).
- [ ] A **lesson** field per ticker: a textarea that on save calls the thesis API (`POST /thesis` if no thread for the ticker, else `POST /thesis/{id}/entries`) with `entry_type:"note"`, body prefixed e.g. "Lesson (sold): …". So lessons join that ticker's conviction trail + Journey automatically.
- [ ] Empty state for accounts with no sales yet.
- [ ] Design: Instrument system — solid surfaces, hairlines, mono figures, teal accent, semantic P&L only, no slop. §11 legibility.

## Task 3 — Nav + cross-links
**Files:** `frontend/lib/nav-structure.ts` (+ test).
- [ ] Add `{ href: "/closed", label: "Closed & Lessons", icon: <lucide: Archive or History> }` to the **Accuracy & Conviction** group (after Lookout). Update the nav test.
- [ ] Cross-link: from a Stock Journey, if the ticker is fully closed, show its realized outcome; from Closed, link each ticker to `/journey/{ticker}`.
- [ ] Verify type-check + tests + live preview. Commit.

## Risks / notes
- FIFO lot-matching is the one place to get right — write the probe first and eyeball the numbers against known transactions.
- Dividends/splits: ignore for realized-P&L v1 (note it); only buy/sell lots.
- `since_sold_pct` needs a live quote; degrade gracefully if unavailable (show realized P&L only).
- Don't cache empty quote/price results (see the `get_historical_prices` fix from 2026-06-24).

## After Phase 4
P5 = AI valuation + thesis-review prompts (+ inline `<Disclaimer variant="inline"/>` under AI output). Then planning merges, then the landing **sail** showpiece (`2026-06-23-velnor-sail-instrument-design.md`).
