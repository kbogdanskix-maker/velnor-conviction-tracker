# Velnor Phase 2 — Conviction First-Class · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Make Thesis a first-class, versioned, always-saved conviction notebook keyed to a ticker — wiring the existing `ThesisThread`/`ThesisEntry` DB tables through a new API to the `/thesis` page, and absorbing Notes + Journal into that surface.

**Architecture:** The tables already exist (`ThesisThread` 1—* `ThesisEntry`, entries ordered by `created_at`). Phase 2 adds the missing API router + frontend data layer. **Every edit creates a new `ThesisEntry` (append-only history — never overwrite)**, so conviction-over-time is captured for the Phase 3 Stock Journey map. No DB migration required.

**Tech Stack:** FastAPI (async SQLAlchemy) + Next.js 14 / SWR. Backend tests via pytest if present, else a DB-script probe (no auth — query helpers directly, as done for the alert fix). Frontend: `tsc --noEmit` + preview.

Source spec: `docs/superpowers/specs/2026-06-23-velnor-conviction-tracker-pivot-design.md` (§ Features 2; § Risks: confirm thesis persistence + ticker normalization).

---

## Context the executor needs (verified 2026-06-24)
- **No thesis router exists** (`backend/app/main.py` has no thesis include; no `routers/thesis.py`). `ThesisThread`/`ThesisEntry` are defined in `app/models/db.py` (~lines 200–223) and referenced in `app/models/schemas.py` and (new) `app/routers/ai.py::_fetch_thesis_notes`.
- `ThesisThread`: `id, user_id, ticker (String20), title (String200), created_at, updated_at`, relationship `entries` (ordered by `created_at`).
- `ThesisEntry`: `id, thread_id, body (Text), entry_type (String20: bull|bear|update|note), created_at`.
- The current `/thesis` page does NOT persist via the relational tables (no localStorage/kv/api refs found in `frontend/app/(dashboard)/thesis/page.tsx` — confirm whether it uses an in-memory store or the `kv` `theses` blob, and migrate without losing existing data).
- The **alert AI fix** (`_fetch_thesis_notes`) already reads `ThesisThread`/`ThesisEntry`, so once users write theses through this API, Smart Alerts become conviction-aware automatically.
- Auth/tier pattern: copy from `app/routers/ai.py` / other routers (`Depends(get_current_user)`, `get_db`). Thesis is a Navigator-tier feature on the frontend today — confirm whether to gate the API.

---

## Task 1 — Pydantic schemas for thesis
**Files:** `backend/app/models/schemas.py` (check for existing thesis schemas first; extend, don't duplicate).
- [ ] Define (or confirm): `ThesisEntryCreate {body: str, entry_type: Literal["bull","bear","update","note"]="note"}`, `ThesisEntryOut {id, body, entry_type, created_at}`, `ThesisThreadCreate {ticker: str, title: str, initial_body: str|None, entry_type?}`, `ThesisThreadOut {id, ticker, title, created_at, updated_at, entries: list[ThesisEntryOut]}`, `ThesisThreadSummary {id, ticker, title, updated_at, entry_count, latest_entry_type}`.
- [ ] Normalize ticker to uppercase/trim in the create schema (validator) — the spec flags ticker keying as a cross-cutting risk; do it in one place.
- [ ] Commit.

## Task 2 — Thesis API router (the backbone)
**Files:** Create `backend/app/routers/thesis.py`; register in `backend/app/main.py` (follow how other routers are included, prefix `/thesis` under the `/api/v1` app prefix).
Endpoints (all scoped to `Depends(get_current_user)`):
- [ ] `GET /thesis` → list `ThesisThreadSummary` for the user (order by `updated_at` desc).
- [ ] `GET /thesis/{thread_id}` → `ThesisThreadOut` with all entries (404 if not owned).
- [ ] `POST /thesis` → create a thread + its first `ThesisEntry` (from `initial_body`). Returns `ThesisThreadOut`.
- [ ] `POST /thesis/{thread_id}/entries` → **append** a new `ThesisEntry` (this is how convictions evolve — never edit in place). Bump the thread's `updated_at`. Returns `ThesisEntryOut`.
- [ ] `DELETE /thesis/{thread_id}` → delete a thread (cascade deletes entries). Owner-only.
- [ ] (Optional) `GET /thesis/by-ticker/{ticker}` → the thread(s) for a ticker, for the Company/Journey surfaces to deep-link.
- [ ] **Verify** without auth via a throwaway DB script (pattern from the alert fix): create a thread + two entries for the test user, list, fetch, confirm append-only ordering, then delete. Delete the script.
- [ ] Commit.

## Task 3 — Frontend thesis data layer
**Files:** Create `frontend/lib/thesis.ts` (types + SWR fetchers/mutations: `useThesisList`, `useThesisThread(id)`, `createThread`, `addEntry`, `deleteThread`) using the app's existing `api` client (see how `journal`/`portfolio` pages call `api.*`).
- [ ] Types mirror the backend `*Out` schemas. Mutations call the Task-2 endpoints and `mutate()` the list/thread keys after writes (existing SWR pattern).
- [ ] Commit.

## Task 4 — Migrate the /thesis page to versioned threads
**Files:** `frontend/app/(dashboard)/thesis/page.tsx`.
- [ ] Replace the current store with the relational API: a list of thesis threads (per ticker), each opening to a timeline of entries (newest first) with entry-type chips (bull/bear/update/note, semantic colors per design-system — bull=gain, bear=loss, update/note=neutral/teal).
- [ ] Editing = **adding a new entry**, never overwriting; show the full history (this is the conviction trail).
- [ ] If the old page stored data (kv `theses`/localStorage), add a one-time import: on first load, if local theses exist and the API list is empty, POST them as threads, then mark migrated. (Confirm the old shape first; if there's no real saved data, skip the importer.)
- [ ] Apply the "Instrument" design system to this surface (it's a core spine page now). §11 legibility check.
- [ ] Verify: `tsc --noEmit`; preview the authed `/thesis` (a session persists in preview — see Phase 1 notes), create a thread, add an entry, reload → persists; check console clean.
- [ ] Commit.

## Task 5 — Absorb Notes + Journal into Thesis
**Files:** `frontend/lib/nav-structure.ts` (nav), the `/notes` + `/journal` routes.
- [ ] Decision to confirm with the user before building: fold `notes` (freeform) + `journal` (dated decisions) into the Thesis surface as tabs/sections, vs. keep `journal` standalone (it has a real backend `DecisionJournalEntry` table + `/journal` router). **Recommendation:** keep the `DecisionJournalEntry` backend; surface journal entries *within* a ticker's thesis timeline where they reference that ticker, and move the standalone `/notes` (freeform) into Thesis. Remove `/notes` + `/journal` from the Accuracy group nav once absorbed (route files stay → Lab), updating `lib/nav-structure.ts` + its test.
- [ ] Verify + commit.

---

## Notes / gotchas
- Never `npm run build` while the preview dev server runs (shared `.next`). Use `npm run type-check`.
- Backend `--reload` picks up code changes; **env changes need a full restart**. The backend may be running on :8000 already.
- Ticker normalization must be identical across Thesis / alert `_fetch_thesis_notes` / future Journey — uppercase+trim, one helper.
- Deferred to Phase 3: a numeric **conviction score** + **expectation/target** field per entry (needs a small migration) — that's what the Journey map colors by. Don't add the migration in Phase 2; entry_type (bull/bear) is the v1 signal.
