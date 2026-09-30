<div align="center">

# Velnor

**A conviction tracker for people who make their own investment calls.**

Write down *why* you bought. Watch each thesis play out against the price.
Find out how right you've actually been.

<img src="frontend/public/velnor-banner.png" alt="Velnor" width="640">

`Next.js 16` · `FastAPI` · `PostgreSQL` · `Redis` · `Claude API`
· ~53k LOC · 23 API routers · 66 pages

</div>

---

## What it is

Most portfolio apps tell you *what* you own. Velnor is built around the part
that actually determines returns: **the reasoning behind each position, and
whether it held up.**

You log a thesis and a conviction level (1-5) when you buy. Velnor tracks that
thesis against what subsequently happened, scores your hit rate *by how sure
you were*, and shows you what occurred after you sold. The AI surfaces reflect
your own recorded reasoning back at you rather than handing you opinions.

> **Status:** pre-launch, built solo as a personal project. It is not a live
> product and not accepting users. Published as a portfolio piece.

---

## The engineering problems worth reading about

This is the part I'd actually point an engineer at.

### 1. A regulatory constraint expressed as architecture

Under MiFID II / Polish KNF rules, telling a user that *their specific holding*
is over-valued, or that they should trim it, is **investment advice** — a
licensed activity. ESMA's 2023 supervisory briefing is explicit that a
disclaimer does not reclassify advice: the *substance* has to be non-directive.

So "not financial advice" in the footer is not a solution. The constraint had
to be enforced in the system:

- A shared `_NO_ADVICE_GUARDRAIL` is injected into **all seven** AI surfaces
  (`backend/app/services/ai_service.py`), not bolted onto individual prompts.
- The same rule applies to *deterministic* output. Rule-based text that reads
  your numbers and tells you what to do is still advice (robo-advice is
  advice), so the frontend's computed insights are held to it too.
- It is **regression-tested**: [`frontend/lib/compliance.test.ts`](frontend/lib/compliance.test.ts)
  runs the insight generators over triggering inputs and fails the build if a
  directive phrase reappears.

The distinction the system enforces: reflecting your own words back
(*"you logged conviction 5 and sold three weeks later"*) is allowed and is the
whole product. Issuing a verdict is not.

### 2. Structured output and tool use are mutually exclusive

The "Deep Dive" feature researches a company with live web search, then returns
a **strictly-schema'd JSON report**. Both at once returns:

```
400 invalid_request_error: The compiled grammar is too large
```

It isn't a schema-size problem — isolating it showed the schema alone passes,
all tools with no schema pass, and schema + *any single tool* fails. The
feature needs both, so it was split into two passes
([`backend/app/services/deep_dive.py`](backend/app/services/deep_dive.py)):

1. **Research** — tools on, no schema. Gathers sourced notes.
2. **Format** — schema on, tools off. Shapes those notes into the report.

The split turned out to fix a second problem for free. The research pass no
longer receives the user's own thesis at all, so their existing view **cannot**
bias which facts get looked up. That ordering used to be a request in the
prompt; now it's structural.

### 3. Making a design system enforceable instead of aspirational

A house style rule nobody can run is a rule that decays. The same punctuation
violation was fixed four separate times before it was turned into a test:
[`frontend/lib/voice.test.ts`](frontend/lib/voice.test.ts) scans every source
file and fails with `file:line` on a violation.

Writing it immediately surfaced five live bugs that months of manual grepping
had missed — they were *en*-dashes (`–`) in numeric ranges while every previous
search looked for em-dashes (`—`).

It also found the root cause of the recurring issue: the prompts instructed the
model "no em-dashes" while feeding it 24 of them in the instructions and data.
Models imitate their context.

### 4. A silent failure that looked like rate limiting and wasn't

Yahoo started refusing the cookie/crumb handshake the market-data layer depends
on. `yfinance` surfaces that as `YFRateLimitError`, so the obvious reading was
throttling — and when it didn't clear on retry, didn't reproduce from my laptop,
and only affected the deployed box, the next obvious reading was a datacenter-IP
block. That conclusion pointed at a proxy or a paid data provider.

It was wrong. The check is on the **TLS fingerprint**, not the IP. Holding the
IP constant and changing only the handshake, from inside the same machine, in
the same second:

```
requests (default TLS)        -> 429 Too Many Requests
curl_cffi impersonate=chrome  -> 200  crumb='QWgTEWe7v7r'
```

The fix is a session that reproduces a real browser's handshake
([`backend/app/services/yf_session.py`](backend/app/services/yf_session.py)) —
no proxy, no vendor, no cost.

What made it expensive to find is the failure *shape*. The crumb gates Yahoo's
`quoteSummary`, so every field behind it came back **empty rather than raising**:
company info, management, insiders, fundamentals, options, and the screener.
Nothing errored, no alert fired, and the pages still rendered. The screener is
assembled from per-ticker cache entries and a ticker that fails is simply
absent — so it had quietly decayed to 1,691 of 5,692 symbols, missing 18 of the
20 largest US companies, while still presenting itself as the whole market.

Two things came out of that beyond the fix. Absence is no longer reported as
fact — a failed lookup returns 503 instead of "Ticker TSLA not found", which had
been telling users a real company did not exist. And the repair path itself was
unreliable: it was a background task started by a page view, so every deploy
killed it. It is a scheduled job now.


---

## Features

| Area | What it does |
|---|---|
| **Conviction journal** | Thesis + conviction (1-5) per position, tracked over time |
| **Stock Journey** | A position's full arc: entries, thesis changes, price, outcome |
| **Calibration** | Hit rate *by conviction level* — are your 5s actually better than your 3s? |
| **Closed & Lessons** | FIFO realised P&L, and what the stock did after you sold |
| **Deep Dive** | Opus-powered research briefing with live web search and full sourcing |
| **Reflect** | Retrospective AI that reasons about your record, not your future |
| **Screener** | US-listed common stock — 5,692 symbols from the NASDAQ trader directory, ~5,600 with fundamentals, progressively loaded and Redis-cached |
| **Valuation** | DCF and reverse-DCF |
| **The Lab** | Risk, correlation, attribution, tax, dividends, Monte Carlo, and more |

---

## Architecture

```
frontend/          Next.js 16 (App Router) · TypeScript · Tailwind
  app/(dashboard)  61 authenticated pages
  components/      42 components; instrument/ is the shared design kit
  lib/             deterministic insight engines + the enforcement tests
  proxy.ts         Next 16 middleware — auth gate + session refresh

backend/           FastAPI · SQLAlchemy (async) · Alembic
  app/routers/     23 routers
  app/services/    market data, portfolio maths, AI, Deep Dive
  app/tasks/       Celery workers for long-running AI jobs

PostgreSQL (Supabase) · Redis cache · Anthropic Claude API
```

**Design notes**

- **Auth is gated twice** on purpose: `proxy.ts` refreshes the session, and the
  dashboard layout independently re-checks server-side. Defence in depth.
- **Market data is cached and throttled** in Redis. An early version hammered
  the upstream at ~50 req/s and got rate-limited into returning empty payloads,
  which were then cached — poisoning downstream features. It now refuses to
  cache a degenerate response.
- **AI model choice is per-surface**: Haiku for short high-frequency insights,
  Sonnet for reasoning, Opus for Deep Dive.

---

## Running locally

**Prerequisites:** Node 20+, Python 3.13, Redis, a Supabase project, an
Anthropic API key.

```bash
git clone https://github.com/<you>/velnor.git && cd velnor

# ── Backend ──────────────────────────────────────────────
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in Supabase + Anthropic values
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# ── Frontend ─────────────────────────────────────────────
cd ../frontend
npm install
cp .env.local.example .env.local   # fill in Supabase values
npm run dev                        # http://localhost:3000
```

Redis must be running (`redis-server`). Deep Dive additionally needs a Celery
worker: `celery -A app.tasks.celery_app worker`.

### Tests

```bash
cd frontend
npm run type-check
npm test          # includes the compliance + design-system enforcement suites
```

---

## Notes for anyone reading the code

- The legal pages under `app/(legal)/` are **templates with unfilled
  placeholders**. They are not valid legal documents — do not reuse them as-is.
- Deploying this yourself makes *you* responsible for your own regulatory
  position. See the notice in [LICENSE](LICENSE).
- `docs/` contains the real design and compliance notes written during
  development, including the audit that drove the guardrail work.

## License

[**AGPL-3.0**](LICENSE) — see [NOTICE](NOTICE) for the project-specific terms.

AGPL rather than a permissive licence because of section 13: if you run a
modified version as a network service, you must offer your users the source of
your modifications. For closed-source or commercial redistribution, contact the
copyright holder.

**Not investment advice.** Velnor is an educational tool, not an investment
adviser. Deploying or modifying it makes you responsible for your own
regulatory position. See [NOTICE](NOTICE).
