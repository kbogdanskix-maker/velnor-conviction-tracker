# Velnor — Manual Testing Plan (Phase 1 → Phase 3)

_Covers everything introduced since the redesign began: the IA pivot, disclaimer guardrail, the
conviction-aware Smart Alerts AI, versioned Thesis, and the Stock Journey map. Date: 2026-06-24._

## 0. Setup
1. **Backend** (`:8000`): `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir /Users/krzys/Claude/wealth-platform/backend`. Health: `curl localhost:8000/health` → `{"status":"ok"}`.
2. **Frontend** (`:3000`): `cd frontend && npm run dev`.
3. **Log in** with the navigator test account (creds in memory `user_credentials.md`). It already has ~6 holdings (incl. NVDA), 0 theses.
4. Redis should be up (`redis-cli ping` → PONG).

> Note: the screener warms ~5,675 tickers from Yahoo on startup and gets rate-limited, so price
> charts / live quotes may be briefly empty — that's a known data condition, not a bug. Wait a minute
> or retry.

---

## 1. Phase 1 — Navigation IA (investing-first) + Lab toggle
- [ ] Sidebar groups read, top to bottom: **Accuracy & Conviction** (Positions, Stock Journey, Thesis, Reflect, Lookout, Smart Alerts) → **Research** (Screener, Company Deep-Dive, Earnings AI, DCF, Reverse DCF) → **Planning** (Net Worth, Cash Flow, Goals, Debt Payoff — visually quieter) → a **"Show Lab tools"** button.
- [ ] Click **Show Lab tools** → a **Lab** group appears with ~40 tools; the label flips to "Hide Lab tools".
- [ ] Reload the page → the Lab choice persists (stored in `localStorage["velnor_nav_lab"]`).
- [ ] A deferred tool is still reachable by URL (e.g. visit `/insurance`, `/journal`, `/notes`).

## 2. Phase 1 — Disclaimer guardrail
- [ ] On any dashboard page, the footer shows: *"Velnor is for educational and informational purposes only and is not investment advice… Consult a licensed financial advisor before making investment decisions."*
- [ ] It appears on multiple pages (it's in the shell, not one page).

## 3. Smart Alerts — conviction-aware AI (the fix)
- [ ] Open **Smart Alerts**. Trigger/expand an AI insight on a position you hold.
- [ ] **Expected:** it references *your* specific position (ticker, weight, P&L, dollars), framed through your objective. For a winner it treats concentration as the cost of conviction and asks whether the thesis holds — it should **NOT** give generic "trim and diversify / rotate into an index fund" advice.
- [ ] **Conviction link:** after you write a thesis (section 4), revisit the alert for that ticker — the insight should now engage your thesis by name.

## 4. Phase 2 — Versioned Thesis (conviction notebook)
- [ ] Open **Thesis**. Empty state shows "No theses yet" → **Write first thesis**.
- [ ] **New Thesis**: enter a ticker (e.g. `NVDA`), a title, an opening body, pick an entry type (bull/bear/update/note) → save. A thread appears in the list with a coloured entry-type chip.
- [ ] Open the thread → see the **conviction trail** (entry timeline).
- [ ] **Add thought** → append a new entry (e.g. an "update"). It appears in the trail; the earlier entry is **unchanged** (append-only — this is the point).
- [ ] **Reload** → the thread + entries persist (cloud-backed via the `/thesis` API).
- [ ] Delete a thread (confirm dialog) → it's removed.

## 5. Phase 3 — Stock Journey map (signature feature)
- [ ] Open **Stock Journey** (Accuracy group, under Positions). The picker lists your tickers (from holdings + theses).
- [ ] Click a ticker (e.g. **NVDA**) → the map shows:
  - [ ] A **state chip** (ON THESIS / DRIFTING / CONVICTION TESTED / THESIS BROKEN / UNDERWATER / WATCHING), colour-coded.
  - [ ] A **Current Position** card: shares, avg cost, current price, market value, unrealized P&L (▲/▼, gain/loss colour).
  - [ ] A **price line** (1-year) — or the graceful "Price history unavailable right now." if Yahoo is rate-limited.
  - [ ] A **Conviction Trail**: your transactions + thesis entries, newest-first, colour-coded dots — or the empty prompt if none yet.
- [ ] **Deep link**: on **Positions** (portfolio), each holding has a Journey (route) icon → opens that ticker's journey.

## 5b. Phase 4 — Closed & Lessons (sold-position post-mortems)
- [ ] Open **Closed & Lessons** (Accuracy group, under Lookout). For every ticker you've sold, you see a row.
  - [ ] **Realized P&L** (FIFO) with ▲/▼ and %, standard gain/loss colour.
  - [ ] **"Since you sold"**: the counterfactual move since your last sale, coloured by *regret* — positive (it ran up after you sold) shows amber + "ran without you"; negative shows gain + "dodged the drop".
  - [ ] Sold date/price, proceeds, first-buy date.
  - [ ] A **"View {ticker} journey"** link to `/journey/{ticker}`.
- [ ] **Lesson capture**: type a lesson in the textarea, click **Save to thesis**. It saves as a `note` entry on that ticker's thesis (creating the thread if needed).
- [ ] Open that ticker's **Stock Journey** → the lesson appears in the Conviction Trail as a NOTE, alongside the buy/sell events. (This is the `/closed → thesis → journey` integration.)
- [ ] Demo data present: a seeded **PLTR** closed trade (bought $22, sold $30 = +36% realized; +275% since you sold) with a saved lesson. Remove by deleting the PLTR thesis in `/thesis` and the PLTR transactions if you want a clean slate.

## 6. The conviction loop (the whole product thesis, end to end)
1. [ ] Write a **bull thesis on NVDA** (Thesis → New Thesis).
2. [ ] Open **Stock Journey → NVDA**: the thesis entry now appears in the Conviction Trail; the state reflects it (e.g. "on thesis").
3. [ ] Open **Smart Alerts** for an NVDA alert: the AI insight now references your NVDA thesis instead of generic advice.

This loop — write conviction → see it against reality → get conviction-aware nudges — is the product.

---

## Known conditions (not bugs)
- **Empty price line / events:** Yahoo rate-limiting (screener warm) and/or the holding has no recorded transactions/thesis yet. Both are data states; the UI degrades gracefully.
- **Journal & Notes are in Lab**, not the spine — Thesis is the conviction home now (their routes/backends still work via Lab).
- **`btn-secondary`** isn't a defined CSS class, so the Journey picker's *empty-state* button renders unstyled. Cosmetic, and only when you have zero tickers. (Fix: swap to `btn-primary` or a styled link.)
- Authed pages can't be reached in the sandbox preview via client login; in a real browser they work normally.
