# Velnor public demo release — design

_2026-09-27_

## Goal

Put Velnor on the public internet as a live, interactable demo, linked from a
LinkedIn post. A visitor clicks one button and is inside a populated app in a
few seconds — no signup, no email, no waitlist.

Velnor is a portfolio piece, not a product being sold. The design optimises for
**time-to-first-impression** and **bounded cost**, in that order. It is not
building a signup funnel, billing, or a multi-tenant production system.

### Success criteria

1. A stranger on a phone reaches a populated dashboard within ~5 seconds of
   clicking, having typed nothing.
2. The Stock Journey map — the signature feature — shows real history on first
   load: conviction that moved, and at least one thesis that diverged from what
   actually happened.
3. Anthropic spend is capped by construction, not by trust.
4. No visitor's personal data is ever collected, so there is no GDPR controller
   relationship to manage.
5. Total infrastructure cost stays around $5/month.

### Explicit non-goals

- No custom domain. `*.vercel.app` → `*.fly.dev` is the shipping configuration.
- No signup, login, password reset, or email delivery for visitors.
- No billing. Paid tiers stay switched off behind `UNLOCK_ALL_TIERS`.
- No new legal text.

---

## 1. Entry flow

The landing page's primary CTA becomes **"Enter the demo"**. The waitlist form is
removed from the hero: asking for an email in front of a free demo is friction
with no payoff now that nothing is being sold. The `waitlist` table and its
insert path are left in place, unused.

On click:

1. `supabase.auth.signInAnonymously()` — returns a normal Supabase access token
   with `is_anonymous: true`, signed ES256 by the same JWKS the backend already
   verifies.
2. Frontend `POST`s `/api/v1/demo/seed` with that bearer token, showing a
   "preparing your demo" state.
3. On `200`, route to the dashboard.

**Token verification is unchanged.** `decode_supabase_token` in
`app/core/security.py` verifies the anonymous token exactly as it verifies any
other: same signing key, same algorithm, `sub` present. The only auth-layer edit
is in `get_current_user`'s user upsert — see section 2.

**Prerequisite (dashboard, operator):** anonymous sign-ins must be enabled in
Supabase → Authentication → Providers.

---

## 2. Anonymous identity

### The constraint

`User.email` is `unique=True, nullable=False` (`app/models/db.py:28`).
`get_current_user` (`app/dependencies.py:49`) reads `payload.get("email") or ""`.
Anonymous tokens carry no email, so the first anonymous visitor is written with
`email=""` and the **second collides on the unique index and gets a 500**.

### The fix

In `get_current_user`, when `payload.get("is_anonymous") is True`, synthesize:

```
anon-<sub>@demo.invalid
```

`.invalid` is reserved by RFC 2606 and can never resolve, so these addresses
cannot be mistaken for or routed to a real mailbox.

The synthesis is **gated on the `is_anonymous` claim specifically**, not on
"email is missing". A non-anonymous token arriving without an email is a real
anomaly and must keep failing loudly rather than silently becoming a demo
account.

### Migration `0008`

Add `users.is_demo boolean NOT NULL DEFAULT false`, indexed.

Both the purge job and the spend caps key off this column. Matching on
`email LIKE '%@demo.invalid'` would work but cannot use an index and couples two
unrelated concerns. `is_demo` is set at creation time from the same claim.

---

## 3. Seeding

### Mechanism: explicit endpoint

`POST /api/v1/demo/seed`, idempotent — returns early if the caller already owns
a portfolio.

Two alternatives were considered and rejected:

- **Seed inline in `get_current_user`.** Fewest moving parts, but it buries a
  multi-table write inside the dependency that *every* protected route depends
  on. A latent performance and failure-mode footgun on the hottest code path in
  the app.
- **Template-clone from a canonical seeded user.** Avoids holding seed content in
  code, but adds a clone layer and a magic production row that must never be
  deleted. Not worth it for a single fixture.

The explicit endpoint keeps the auth dependency clean, is independently
testable, and lets the frontend show an honest loading state instead of a
mysteriously slow first paint.

### Content

One declarative module, `app/services/demo_seed.py`:

- **~6 open positions**, with buy transactions dated across roughly 18 months so
  cost basis and returns are real rather than flat.
- **1 fully closed position** (buy and sell), which is what populates
  *Closed & Lessons* and *Calibration*. Without this those pages are empty.
- **Thesis threads on 3–4 tickers**, each with several `ThesisEntry` versions and
  `conviction` moving over the 1–5 range. **At least one thesis must diverge from
  what actually happened**, so the Journey map renders amber/red and not a
  uniformly green wall — a demo where everything worked demonstrates nothing.
- **Journal entries** with conviction values, feeding Calibration.
- **A few watchlist items** for Lookout.

### Voice and attribution

Entries are written in first person as an **explicitly fictional sample
investor**, and the demo chrome carries a persistent
`Sample portfolio · not investment advice` marker.

This matters beyond polish. Seeded thesis prose about real securities is
operator-authored content, not AI output, so the AI no-advice guardrail does not
cover it. Attribution to a labelled fictional persona is what keeps it
demonstrably not the operator's research on a security. Real tickers are
retained because live prices, charts, and screener lookups are exactly what the
demo needs to exercise.

---

## 4. Cost control

Four layers. The first three are code; the fourth is the operator's.

### 4.1 Global daily AI ceiling

New setting `AI_GLOBAL_DAILY_LIMIT`, **default 100**. Enforced with a
`ai:global:<date>` Redis counter via the existing `rate_limit_increment` helper
(`app/core/cache.py:57`).

100/day is deliberately low — at 5/day per visitor it accommodates 20 distinct
visitors using AI heavily, which is well above expected traffic for a LinkedIn
post. It is a setting rather than a constant so it can be raised without a
redeploy if the post lands harder than expected.

Checked **before** the per-user quota in `_enforce_insight_quota`, so a single
visitor cannot drain the day for everyone else.

### 4.2 Finite quota for demo users

`UNLOCK_ALL_TIERS = True` makes every account Navigator, and
`_INSIGHT_LIMITS["navigator"]` is `-1` — unlimited (`app/routers/ai.py:453`).
Unlimited AI multiplied by an unbounded supply of fresh anonymous accounts is
the single largest financial risk in this release.

Demo users get a finite daily quota (~5) instead. The existing per-user Redis
counter already implements this; only the limit lookup changes.

### 4.3 Deep Dive: one global run per day

Deep Dive is Opus plus live web search — by far the most expensive path, and
under the default rule every fresh account would be entitled to its own run.

Instead: a `deep_dive:global:<date>` counter capped at **1**, first-come
first-served. The visitor who gets there first triggers a real generated report.
Everyone after sees a **pre-generated sample report** with a clear "today's run
is used" note, so the feature still reads as built and nobody hits a dead end.

`max_retries=0` already applies, since every attempt is billable.

### 4.4 Anthropic Console spend limit

Operator action, dashboard only. The backstop underneath all of the above: the
in-app caps stop the app from serving AI, the Console limit stops the bill if a
cap has a bug.

---

## 5. Architecture simplification: no Celery

With Deep Dive reduced to one run per day, a dedicated Celery worker is no
longer justified — it would roughly double the Fly bill to process at most one
job per day.

Deep Dive moves to a **FastAPI background task**. The existing polling frontend
is unaffected: it polls a queued report every 10s and stops once complete, which
works identically whether a worker or a background task produced it.

Redis stays — it carries quote caching, the slowapi limiter, and every quota
counter in section 4.

**Consequence:** Celery beat also goes, which means the demo purge and the quote
warm-up cannot be beat schedules. Both become **Fly scheduled machines** (cron).

This is a fortunate outcome: the existing `beat_schedule`
(`app/tasks/celery_app.py:20`) references `tasks.daily_price_snapshot` and
`tasks.check_price_alerts`, neither of which exists in `app/tasks/`. Beat would
likely fail to start. Dropping it sidesteps a latent bug rather than inheriting
it.

---

## 6. Scheduled jobs

Two Fly cron machines.

### 6.1 Purge expired demo accounts — daily

```sql
DELETE FROM users WHERE is_demo AND created_at < now() - interval '24 hours';
```

One statement is the entire job. Every relationship on `User` already declares
`cascade="all, delete-orphan"` and every FK is `ondelete="CASCADE"`, so all
portfolios, transactions, thesis threads, journal entries, and watchlist items
go with it.

**Known limitation:** this purges Velnor's `users` row, not the orphaned
Supabase `auth.users` record. Deleting those requires `service_role`, which the
backend deliberately does not hold — nothing in this codebase should be able to
bypass RLS. Anonymous users count toward Supabase's MAU, but against a 50,000
free-tier allowance at portfolio-piece traffic this is noise. Accepted.

### 6.2 Warm the quote cache — every 15 minutes

Pre-fetch quotes for the seed tickers only.

Yahoo Finance 429s on cold start are already known and pre-existing, and
datacenter IPs are throttled harder than residential ones. Fly gives the app a
stable outbound IP, so Yahoo sees one consistent caller rather than a rotating
pool. Keeping the demo's own symbols permanently warm means the first thing a
visitor sees never depends on a live Yahoo call succeeding.

Empty responses are not cached (`a648f6b`), so a throttled warm-up degrades
rather than poisoning the cache.

---

## 7. Hosting

| Component | Host | Notes |
|---|---|---|
| Frontend | Vercel (Hobby) | Free, no card. Non-commercial terms fit a portfolio piece. |
| Backend | Fly.io | One `shared-cpu-1x` / 512MB, always warm. ~$5/mo. Card required. |
| Redis | Upstash | Free tier, 10k commands/day. Quote caching is chatty — the likeliest thing to need upgrading. |
| Postgres | Supabase | Already running, free tier. |

### New files

- **`backend/Dockerfile`** — does not exist. `docker-compose.yml` already
  references it, so compose's `api`/`worker`/`beat` services cannot currently
  build. Writing it fixes local compose as a side effect.
- **`backend/fly.toml`** — one app, one process, always-on (no `auto_stop`; a
  cold start is the failure mode this release exists to avoid).

### Configuration

- `ALLOWED_ORIGINS` (`app/config.py:23`) gains the Vercel origin. It currently
  lists `http://localhost:3000` and `https://vela.finance`, neither of which is
  where this will run.
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `BACKEND_URL=https://<app>.fly.dev`. The `/api/v1/:path*` rewrite in
  `next.config.mjs` needs no change.
- Fly secrets are pushed from the existing populated `backend/.env` via
  `fly secrets set`. No secret is retyped, printed, or passed through chat. The
  Upstash `REDIS_URL` is the one new value and is set by the operator directly.

### Deployment is not a build artifact

`APP_ENV=production` and `DEBUG=false` on Fly. `DEBUG` currently defaults to
`true`, which turns on SQLAlchemy `echo` — every query logged in production.

---

## 8. Legal pages

`/privacy` and `/terms` carry `[Operator legal name]` placeholders and are listed
in `proxy.ts` as public paths.

**Decision: remove both links from the footer. Write no legal text.**

The GDPR analysis supports this. Anonymous sessions collect no email, no name,
and no real holdings; there is no personal data and therefore no controller
relationship. Supabase auth cookies are strictly necessary for functionality, so
no consent banner is required either.

What remained was purely presentational — a visitor clicking `/terms` and finding
an unfinished template. Unlinking removes that for zero effort. The pages stay
reachable by URL for anyone who goes looking, and the placeholders can be filled
in later if Velnor ever becomes something that needs them.

---

## 9. Testing

### Unit

- `demo_seed` is idempotent: calling it twice leaves exactly one portfolio.
- Anonymous email synthesis produces a unique address per `sub`, and **two
  anonymous users can be created in sequence** — the regression this release
  exists to prevent.
- A non-anonymous token with no email still raises, rather than being absorbed as
  a demo account.
- The global AI cap returns 429 at exactly the boundary, not one either side.
- The Deep Dive global counter admits exactly one run per day.

### Existing gates (must stay green)

`npm run type-check` · `npm test` (28 tests, including `compliance.test.ts` for
the no-advice guardrail and `voice.test.ts` for the §8 dash rules) ·
`NEXT_DIST_DIR=.next-verify npx next build`, then
`git checkout next-env.d.ts tsconfig.json`.

### Live verification, against a real anonymous session

The handoff's open item is that the tier unlock has never been seen working with
a real logged-in session. An anonymous demo user is a Navigator user, so the
demo release is exactly what proves it. Check the four endpoints that would still
403 if the unlock missed something:

1. `/reflect`
2. Company page — financial statements
3. Company page — management & governance
4. Company page — insider activity

Then the demo path end to end on a phone viewport: land, click, seeded dashboard,
Journey map showing non-uniform colouring.

---

## 10. Operator actions

Five things that cannot be automated.

1. Supabase → Authentication → Providers → **enable anonymous sign-ins**.
2. Anthropic Console → **set a monthly spend limit**.
3. Upstash → create a free Redis DB, then set `REDIS_URL` as a Fly secret
   directly.
4. `brew install flyctl && fly auth login`.
5. `npm i -g vercel && vercel login`.

Fly requires a card on file before deploying. Vercel and Upstash do not, on the
tiers used here.

---

## Implementation order

Sequenced so that each phase is verifiable locally before anything is public.
The public URL does not exist until phase 4, which means every earlier phase can
be checked without exposing a half-finished app.

1. **Anonymous identity** — migration `0008`, email synthesis, unit tests.
   Verifiable locally: two anonymous sessions in a row without a 500.
2. **Seed + endpoint** — `demo_seed.py`, `POST /demo/seed`, idempotency tests.
   Verifiable locally: a fresh anonymous session lands on a populated dashboard.
3. **Cost controls** — global AI ceiling, demo quota, Deep Dive global counter,
   pre-generated sample report. Verifiable locally: 429 at the boundary.
   **This phase must land before anything is deployed.**
4. **Hosting** — `Dockerfile`, `fly.toml`, Fly + Upstash + Vercel, CORS origin,
   `DEBUG=false`. First point at which a public URL exists.
5. **Scheduled jobs** — purge and warm-up cron machines.
6. **Polish** — landing CTA, waitlist removal, footer unlink, demo chrome marker.
7. **Live verification** — the four 403-risk endpoints, then the full demo path
   on a phone viewport.

Phase 3 gating phase 4 is the one ordering constraint that is not negotiable: a
public URL without the caps in place is an uncapped bill.

## Risks accepted

| Risk | Mitigation | Residual |
|---|---|---|
| Yahoo throttles the Fly IP | Stable outbound IP, 15-min warm-up of seed tickers, empty responses uncached | Arbitrary ticker lookups outside the seed set may still 429 |
| Orphaned Supabase `auth.users` rows accumulate | None — needs `service_role`, deliberately absent | MAU creep, negligible against 50k free tier |
| Upstash free tier exhausted by quote caching | Longer TTLs if it bites | Cache misses degrade to live Yahoo calls |
| Demo data vandalised | Per-visitor isolation; nobody shares a sandbox | None |
| `deep_dive_reports` RLS never applied | App-level `user_id` scoping; backend holds no `service_role` or anon key, so only our API reaches the table | Should still be applied; does not gate this release |
