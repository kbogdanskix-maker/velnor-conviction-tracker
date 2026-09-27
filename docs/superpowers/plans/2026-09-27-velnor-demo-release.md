# Velnor Public Demo Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Velnor as a public, one-click-entry demo on Fly + Vercel, where an anonymous visitor lands in a pre-seeded portfolio in seconds and Anthropic spend is capped by construction.

**Architecture:** Supabase anonymous sign-in produces a normal ES256 JWT that the existing auth layer already verifies. A new `POST /api/v1/demo/seed` endpoint populates that user's portfolio, thesis threads, and journal from a declarative fixture. Three Redis counters cap AI spend: a global daily ceiling, a finite per-demo-user quota, and a single global Deep Dive run per day. Celery is dropped in favour of a FastAPI background task, so the backend is one always-warm Fly machine plus two Fly cron machines.

**Tech Stack:** FastAPI · SQLAlchemy 2 async · Alembic · Redis (Upstash in prod, Homebrew locally) · Supabase Postgres + Auth · Next.js 14 App Router · pytest + pytest-asyncio (new) · Fly.io · Vercel

**Spec:** `docs/superpowers/specs/2026-09-27-velnor-demo-release-design.md`

---

## Critical context for the implementer

Read these before starting. Each one has already caused a wrong assumption during planning.

1. **`tests/` in the backend is empty and pytest is not installed.** The "28 tests" referenced in `HANDOFF.md` are frontend vitest tests. Task 1 stands up backend pytest from nothing.
2. **Docker is not running on this machine.** There is no throwaway Postgres available. Therefore DB-touching logic is designed as pure functions tested without a database, and persistence is verified live against the real Supabase dev DB. Do not add testcontainers.
3. **`ThesisEntry` has NO `conviction` column.** It has `body`, `entry_type`, `created_at` only. Conviction (1–5) lives on `DecisionJournalEntry.conviction`. Some project docs claim otherwise — the model at `app/models/db.py:214` is the truth.
4. **`Holding` is a materialised table.** Inserting transactions does not create positions. You must call `portfolio_calc.recompute_holdings(portfolio_id, db)` afterwards.
5. **`User.email` is `unique=True, nullable=False`.** This is the bug the release exists around: two anonymous users both get `email=""` and the second 500s.
6. **The backend venv is `.venv` and must be used explicitly.** A bare `uvicorn`/`pytest` resolves to anaconda's. Always `.venv/bin/...`.
7. **Latest migration is `0007_deep_dive_reports.py`.** Yours is `0008`.

---

## File structure

### Backend — create

| File | Responsibility |
|---|---|
| `backend/tests/conftest.py` | pytest fixtures: event loop policy, isolated Redis keyspace |
| `backend/tests/test_identity.py` | anonymous identity resolution (pure) |
| `backend/tests/test_demo_seed_data.py` | seed fixture shape (pure) |
| `backend/tests/test_ai_caps.py` | global AI ceiling + Deep Dive counter (real Redis) |
| `backend/app/core/identity.py` | `resolve_identity()` — pure mapping from JWT payload to (email, is_demo) |
| `backend/app/services/demo_seed_data.py` | the fixture: declarative, pure, no ORM imports |
| `backend/app/services/demo_seed.py` | persists the fixture for one user; idempotent |
| `backend/app/routers/demo.py` | `POST /demo/seed` |
| `backend/app/core/ai_budget.py` | global AI ceiling + Deep Dive global counter |
| `backend/migrations/versions/0008_users_is_demo.py` | `users.is_demo` column + index |
| `backend/Dockerfile` | container image (referenced by compose today, never written) |
| `backend/fly.toml` | one always-on app |
| `backend/scripts/purge_demo_users.py` | cron entrypoint |
| `backend/scripts/warm_quote_cache.py` | cron entrypoint |

### Backend — modify

| File | Change |
|---|---|
| `app/dependencies.py:49` | `get_current_user` uses `resolve_identity`, sets `is_demo` |
| `app/models/db.py:23` | `User.is_demo` column |
| `app/routers/ai.py:450` | global ceiling before per-user; demo users get finite quota |
| `app/routers/deep_dive.py` | global 1/day counter; background task instead of Celery |
| `app/config.py` | new settings; `ALLOWED_ORIGINS` |
| `app/main.py` | register `demo.router` |
| `requirements.txt` | pytest, pytest-asyncio |

### Frontend — modify

| File | Change |
|---|---|
| `frontend/lib/demo.ts` (create) | `enterDemo()` — anonymous sign-in then seed |
| `frontend/app/page.tsx` | CTA becomes "Enter the demo"; waitlist form removed |
| `frontend/components/instrument/TopBar.tsx` | persistent sample-data marker |
| footer component | remove `/privacy` and `/terms` links |

---

## Task 1: Backend pytest infrastructure

Nothing here exists. Without it no later task can be TDD'd.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/conftest.py`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Add test dependencies**

Append to `backend/requirements.txt`:

```
pytest==8.3.4
pytest-asyncio==0.25.0
```

- [ ] **Step 2: Install them**

Run: `cd backend && .venv/bin/pip install pytest==8.3.4 pytest-asyncio==0.25.0`
Expected: `Successfully installed pytest-8.3.4 pytest-asyncio-0.25.0`

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
```

`asyncio_mode = auto` means async test functions need no decorator.

- [ ] **Step 4: Create `backend/tests/conftest.py`**

```python
"""Shared test fixtures.

No database fixture exists deliberately: Docker is unavailable on the dev
machine and the models are Postgres-specific (JSONB, UUID), so SQLite cannot
substitute. DB-touching logic is therefore split into pure functions tested
here, with persistence verified live. See the plan's "Critical context".
"""
import pytest_asyncio

from app.core.cache import get_redis

TEST_PREFIX = "test:"


@pytest_asyncio.fixture
async def redis_clean():
    """Yield Redis with every `vela:test:*` key removed before and after.

    Uses the real Homebrew Redis. Production keys are untouched because every
    key this fixture is used with starts with `test:`.
    """
    r = await get_redis()

    async def _purge():
        keys = [k async for k in r.scan_iter(f"vela:{TEST_PREFIX}*")]
        if keys:
            await r.delete(*keys)

    await _purge()
    yield r
    await _purge()
```

- [ ] **Step 5: Verify the harness collects**

Run: `cd backend && .venv/bin/pytest -q`
Expected: `no tests ran` and exit code 5. That is success — the harness works and there are no tests yet.

- [ ] **Step 6: Confirm Redis is up**

Run: `/opt/homebrew/bin/redis-cli ping`
Expected: `PONG`. If not: `brew services start redis`.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/conftest.py
git commit -m "test: stand up backend pytest infrastructure"
```

---

## Task 2: Anonymous identity resolution

The unique-email collision, fixed as a pure function so it is testable without a database.

**Files:**
- Create: `backend/app/core/identity.py`
- Test: `backend/tests/test_identity.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_identity.py`:

```python
import pytest
from fastapi import HTTPException

from app.core.identity import resolve_identity


def test_real_user_keeps_their_email():
    email, is_demo = resolve_identity({"sub": "a" * 36, "email": "me@example.com"})
    assert email == "me@example.com"
    assert is_demo is False


def test_anonymous_user_gets_synthetic_address():
    sub = "11111111-1111-1111-1111-111111111111"
    email, is_demo = resolve_identity({"sub": sub, "is_anonymous": True})
    assert email == f"anon-{sub}@demo.invalid"
    assert is_demo is True


def test_two_anonymous_users_get_different_addresses():
    """The regression this release exists to prevent: User.email is UNIQUE, so
    two anonymous users sharing an address makes the second signup a 500."""
    a, _ = resolve_identity({"sub": "1" * 36, "is_anonymous": True})
    b, _ = resolve_identity({"sub": "2" * 36, "is_anonymous": True})
    assert a != b


def test_non_anonymous_token_without_email_is_rejected():
    """Must fail loudly rather than being absorbed as a demo account."""
    with pytest.raises(HTTPException) as exc:
        resolve_identity({"sub": "c" * 36})
    assert exc.value.status_code == 401


def test_anonymous_claim_wins_over_a_present_email():
    sub = "33333333-3333-3333-3333-333333333333"
    email, is_demo = resolve_identity(
        {"sub": sub, "email": "spoof@example.com", "is_anonymous": True}
    )
    assert email == f"anon-{sub}@demo.invalid"
    assert is_demo is True
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/test_identity.py -q`
Expected: collection error, `ModuleNotFoundError: No module named 'app.core.identity'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/core/identity.py`:

```python
"""Maps a verified Supabase JWT payload to the identity we store locally.

Kept separate from `dependencies.get_current_user` so the rules are unit
testable without a database, and so the one security-sensitive decision here —
when an account counts as a demo account — lives in one readable place.
"""
from fastapi import HTTPException, status

# RFC 2606 reserves .invalid, so these addresses can never resolve or be
# mistaken for a real mailbox.
_DEMO_EMAIL_DOMAIN = "demo.invalid"


def resolve_identity(payload: dict) -> tuple[str, bool]:
    """Return (email, is_demo) for a verified token payload.

    Anonymous Supabase sessions carry no email, but `User.email` is UNIQUE and
    NOT NULL, so every anonymous user needs a distinct synthetic address derived
    from their `sub`.

    The anonymous branch is gated on the `is_anonymous` claim, never on "email
    is missing". A non-anonymous token arriving without an email is a real
    anomaly and must fail rather than silently become a demo account.
    """
    sub = payload["sub"]

    if payload.get("is_anonymous") is True:
        return f"anon-{sub}@{_DEMO_EMAIL_DOMAIN}", True

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no email and is not anonymous",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email, False
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/test_identity.py -q`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/identity.py backend/tests/test_identity.py
git commit -m "feat: resolve anonymous JWT identities to unique synthetic emails"
```

---

## Task 3: `users.is_demo` column

**Files:**
- Modify: `backend/app/models/db.py:23-34`
- Create: `backend/migrations/versions/0008_users_is_demo.py`

- [ ] **Step 1: Add the column to the model**

In `backend/app/models/db.py`, in `class User`, immediately after the `tier` line (`app/models/db.py:30`):

```python
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
```

`Boolean` is already imported in this module.

- [ ] **Step 2: Create the migration**

Create `backend/migrations/versions/0008_users_is_demo.py`:

```python
"""users.is_demo — marks one-click anonymous demo accounts

Revision ID: 0008
Revises: 0007
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="false"),
    )
    # The daily purge filters on this column; without an index it is a full scan
    # of the users table on every run.
    op.create_index("idx_users_is_demo", "users", ["is_demo"])


def downgrade() -> None:
    op.drop_index("idx_users_is_demo", table_name="users")
    op.drop_column("users", "is_demo")
```

- [ ] **Step 3: Confirm the revision id matches the existing chain**

Run: `cd backend && grep -n "^revision\|^down_revision" migrations/versions/0007_deep_dive_reports.py`
Expected: `revision = "0007"`. If it is a hash rather than `"0007"`, set this migration's `down_revision` to that exact value instead.

- [ ] **Step 4: Apply it**

Run: `cd backend && .venv/bin/alembic upgrade head`
Expected: `Running upgrade 0007 -> 0008`

- [ ] **Step 5: Verify the column landed**

Run: `cd backend && .venv/bin/python -c "
import asyncio
from sqlalchemy import text
from app.dependencies import engine
async def go():
    async with engine.connect() as c:
        r = await c.execute(text(\"select column_name from information_schema.columns where table_name='users' and column_name='is_demo'\"))
        print(r.fetchall())
asyncio.run(go())
"`
Expected: `[('is_demo',)]`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/db.py backend/migrations/versions/0008_users_is_demo.py
git commit -m "feat: add users.is_demo for one-click demo accounts"
```

---

## Task 4: Wire identity into `get_current_user`

**Files:**
- Modify: `backend/app/dependencies.py:49-80`

- [ ] **Step 1: Replace the email/upsert block**

In `backend/app/dependencies.py`, add the import near the existing `from app.core.security import decode_supabase_token`:

```python
from app.core.identity import resolve_identity
```

Then replace these two lines (`app/dependencies.py:61-62`):

```python
    supabase_uid = uuid.UUID(payload["sub"])
    email = payload.get("email") or ""
```

with:

```python
    supabase_uid = uuid.UUID(payload["sub"])
    email, is_demo = resolve_identity(payload)
```

And replace the `User(...)` construction:

```python
        user = User(
            supabase_uid=supabase_uid,
            email=email,
            tier="horizon",
        )
```

with:

```python
        user = User(
            supabase_uid=supabase_uid,
            email=email,
            tier="horizon",
            is_demo=is_demo,
        )
```

- [ ] **Step 2: Guard the email-sync branch against demo accounts**

The existing sync branch would rewrite a demo user's synthetic address on every request. Replace (`app/dependencies.py:75-78`):

```python
    elif user.email != email and email:
        # Keep email in sync if it changed in Supabase
        user.email = email
        await db.commit()
```

with:

```python
    elif not user.is_demo and user.email != email and email:
        # Keep email in sync if it changed in Supabase. Skipped for demo users,
        # whose address is synthesized from `sub` and never changes.
        user.email = email
        await db.commit()
```

- [ ] **Step 3: Verify nothing else broke**

Run: `cd backend && .venv/bin/pytest -q && .venv/bin/python -c "import app.main"`
Expected: `5 passed`, then no output from the import (success).

- [ ] **Step 4: Commit**

```bash
git add backend/app/dependencies.py
git commit -m "feat: accept anonymous sessions in get_current_user"
```

---

## Task 5: The seed fixture (pure)

Declarative and ORM-free, so its shape is testable without a database. The tests encode the demo's actual requirements, not trivia.

**Files:**
- Create: `backend/app/services/demo_seed_data.py`
- Test: `backend/tests/test_demo_seed_data.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_demo_seed_data.py`:

```python
from datetime import datetime, timezone
from decimal import Decimal

from app.services.demo_seed_data import (
    SEED_JOURNAL,
    SEED_THESES,
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)


def test_has_enough_tickers_to_look_populated():
    """Seven bought, one of which (NKE) is closed out, leaving six open."""
    buys = {t.ticker for t in SEED_TRANSACTIONS if t.transaction_type == "buy"}
    assert len(buys) >= 7


def test_has_a_fully_closed_position():
    """Closed & Lessons and Calibration are both empty without one."""
    sells = [t for t in SEED_TRANSACTIONS if t.transaction_type == "sell"]
    assert sells, "need at least one sell"
    for sell in sells:
        bought = sum(
            t.quantity
            for t in SEED_TRANSACTIONS
            if t.ticker == sell.ticker and t.transaction_type == "buy"
        )
        assert bought == sell.quantity, f"{sell.ticker} must be fully closed"


def test_transactions_span_at_least_a_year():
    """Flat cost basis makes returns and the Journey timeline meaningless."""
    dates = [t.executed_at for t in SEED_TRANSACTIONS]
    assert (max(dates) - min(dates)).days >= 365


def test_all_transaction_dates_are_in_the_past():
    now = datetime.now(timezone.utc)
    assert all(t.executed_at < now for t in SEED_TRANSACTIONS)


def test_conviction_moves_over_time_for_some_ticker():
    """A flat conviction line makes the Journey map pointless."""
    by_ticker: dict[str, list[int]] = {}
    for e in SEED_JOURNAL:
        by_ticker.setdefault(e.ticker, []).append(e.conviction)
    assert any(len(set(v)) > 1 for v in by_ticker.values())


def test_conviction_values_are_in_range():
    assert all(1 <= e.conviction <= 5 for e in SEED_JOURNAL)


def test_at_least_one_thesis_diverged():
    """Spec section 3: a uniformly green Journey map demonstrates nothing."""
    assert any(t.diverged for t in SEED_THESES)


def test_theses_have_multiple_entries():
    assert all(len(t.entries) >= 2 for t in SEED_THESES)


def test_every_thesis_ticker_is_held_or_was_held():
    traded = {t.ticker for t in SEED_TRANSACTIONS}
    assert all(t.ticker in traded for t in SEED_THESES)


def test_watchlist_is_not_empty():
    assert len(SEED_WATCHLIST) >= 3


def test_prices_are_decimals_not_floats():
    """Numeric columns; floats introduce representation drift in cost basis."""
    assert all(isinstance(t.price, Decimal) for t in SEED_TRANSACTIONS)
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/test_demo_seed_data.py -q`
Expected: `ModuleNotFoundError: No module named 'app.services.demo_seed_data'`

- [ ] **Step 3: Write the fixture**

Create `backend/app/services/demo_seed_data.py`:

```python
"""The demo portfolio fixture.

Pure data: no ORM imports, no database, no clock beyond a fixed anchor. Kept
separate from `demo_seed.py` so its shape can be unit tested without a Postgres
instance (Docker is unavailable on the dev machine).

VOICE AND ATTRIBUTION — read before editing any prose here.
These notes are written as an explicitly fictional sample investor. They are
operator-authored content about real securities, so the AI no-advice guardrail
does NOT cover them; attribution to a labelled persona is what keeps them
demonstrably not the operator's own research. Keep every entry in first person
as this character, keep the UI marker "Sample portfolio - not investment
advice" in place, and never write anything that reads as a recommendation to a
reader: no price targets, no buy/sell language, no "you should".
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Dates are relative to a fixed anchor rather than `now()` so the fixture is
# deterministic and its tests cannot break on a particular day.
_ANCHOR = datetime(2026, 9, 1, 14, 30, tzinfo=timezone.utc)


def _months_ago(n: int) -> datetime:
    return _ANCHOR - timedelta(days=n * 30)


@dataclass(frozen=True)
class SeedTransaction:
    ticker: str
    transaction_type: str  # buy | sell
    quantity: Decimal
    price: Decimal
    executed_at: datetime
    notes: str = ""


@dataclass(frozen=True)
class SeedThesisEntry:
    body: str
    entry_type: str  # bull | bear | update | note
    created_at: datetime


@dataclass(frozen=True)
class SeedThesis:
    ticker: str
    title: str
    diverged: bool
    entries: list[SeedThesisEntry] = field(default_factory=list)


@dataclass(frozen=True)
class SeedJournalEntry:
    ticker: str
    action: str  # buy | sell | hold | trim | add | watch
    conviction: int  # 1-5
    rationale: str
    decided_at: datetime
    outcome: str | None = None


@dataclass(frozen=True)
class SeedWatchlistItem:
    ticker: str
    notes: str


# ── Transactions ──────────────────────────────────────────────────────────────
# Six open positions plus one fully closed (NKE), spanning ~20 months.

SEED_TRANSACTIONS: list[SeedTransaction] = [
    SeedTransaction("MSFT", "buy", Decimal("18"), Decimal("402.15"), _months_ago(20),
                    "Starter position. Azure margin story is the whole reason."),
    SeedTransaction("ASML", "buy", Decimal("9"), Decimal("712.40"), _months_ago(18),
                    "EUV monopoly. Sized small because the cyclicality scares me."),
    SeedTransaction("NKE", "buy", Decimal("60"), Decimal("98.20"), _months_ago(17),
                    "Brand turnaround bet."),
    SeedTransaction("COST", "buy", Decimal("11"), Decimal("735.60"), _months_ago(14),
                    "Membership renewal rates are the moat."),
    SeedTransaction("MSFT", "buy", Decimal("7"), Decimal("441.80"), _months_ago(11),
                    "Adding after the capex scare. Thesis unchanged."),
    SeedTransaction("NVDA", "buy", Decimal("14"), Decimal("118.90"), _months_ago(9),
                    "Late to this one and sizing accordingly."),
    SeedTransaction("NKE", "sell", Decimal("60"), Decimal("74.85"), _months_ago(7),
                    "Closing out. Four quarters of the turnaround not showing up."),
    SeedTransaction("ADBE", "buy", Decimal("12"), Decimal("512.30"), _months_ago(6),
                    "Assuming AI is additive to seats, not a substitute for them."),
    SeedTransaction("TSM", "buy", Decimal("22"), Decimal("172.45"), _months_ago(4),
                    "The whole industry rents its capacity."),
    SeedTransaction("COST", "buy", Decimal("4"), Decimal("881.20"), _months_ago(2),
                    "Topping up on no new information, which I should be honest about."),
]

# ── Theses ────────────────────────────────────────────────────────────────────
# ADBE is the deliberate divergence: the assumption is being contradicted and
# the entries say so, which is what makes the Journey map show amber/red.

SEED_THESES: list[SeedThesis] = [
    SeedThesis(
        ticker="MSFT",
        title="Azure margin expansion outlasts the capex cycle",
        diverged=False,
        entries=[
            SeedThesisEntry(
                "Core assumption: Azure gross margin keeps climbing even while capex "
                "runs hot, because the incremental workload mix is higher-margin than "
                "the base. If margin flattens for two consecutive quarters while capex "
                "stays elevated, I am wrong.",
                "bull", _months_ago(20),
            ),
            SeedThesisEntry(
                "Capex guide came in heavier than I modelled and the stock took it "
                "badly. Margin still expanded. This is the scenario I wrote down, so I "
                "added rather than trimmed.",
                "update", _months_ago(11),
            ),
            SeedThesisEntry(
                "Four quarters on, margin trend intact. Noting that I have not "
                "re-underwritten the assumption since I wrote it, only re-confirmed it, "
                "which is a different and weaker thing.",
                "note", _months_ago(3),
            ),
        ],
    ),
    SeedThesis(
        ticker="ADBE",
        title="Generative AI is additive to seat count, not a substitute",
        diverged=True,
        entries=[
            SeedThesisEntry(
                "Assumption: AI tooling pulls more people into Creative Cloud than it "
                "displaces, so net seats grow. Falsifier: two quarters of decelerating "
                "net-new subscriptions with AI features shipped.",
                "bull", _months_ago(6),
            ),
            SeedThesisEntry(
                "Net-new subscription growth decelerated again. That is the second "
                "quarter. By my own falsifier I am on the wrong side of this, and I am "
                "writing it down before I start explaining it away.",
                "bear", _months_ago(2),
            ),
            SeedThesisEntry(
                "Still holding, and I want to be honest that the reason is inertia "
                "rather than a revised thesis. Revisit with a decision next quarter.",
                "update", _months_ago(1),
            ),
        ],
    ),
    SeedThesis(
        ticker="NKE",
        title="Brand-led turnaround shows up in wholesale reorders",
        diverged=True,
        entries=[
            SeedThesisEntry(
                "Assumption: the direct-to-consumer reset is temporary and wholesale "
                "reorders recover within four quarters.",
                "bull", _months_ago(17),
            ),
            SeedThesisEntry(
                "Four quarters gone, reorders have not recovered. I set the window "
                "myself and it closed. Exiting.",
                "bear", _months_ago(7),
            ),
        ],
    ),
    SeedThesis(
        ticker="ASML",
        title="EUV monopoly survives the China restrictions",
        diverged=False,
        entries=[
            SeedThesisEntry(
                "Assumption: export restrictions dent the order book but not the "
                "monopoly, because there is no second supplier at this node.",
                "bull", _months_ago(18),
            ),
            SeedThesisEntry(
                "Order book lumpier than expected, monopoly unchallenged. Sizing stays "
                "small because I cannot time the cycle and have stopped pretending I "
                "can.",
                "update", _months_ago(5),
            ),
        ],
    ),
]

# ── Journal ───────────────────────────────────────────────────────────────────
# Conviction moves for MSFT (4 -> 3 -> 5) and ADBE (4 -> 2), which is what the
# Journey map's conviction trend reads.

SEED_JOURNAL: list[SeedJournalEntry] = [
    SeedJournalEntry("MSFT", "buy", 4,
                     "Opening at what I think is a fair price for a compounding margin story.",
                     _months_ago(20)),
    SeedJournalEntry("ASML", "buy", 3,
                     "High conviction in the moat, low conviction in my entry timing.",
                     _months_ago(18)),
    SeedJournalEntry("NKE", "buy", 4,
                     "Turnaround bet with a four-quarter window I have written down.",
                     _months_ago(17)),
    SeedJournalEntry("COST", "buy", 4,
                     "Paying up for predictability. Aware that is a choice.",
                     _months_ago(14)),
    SeedJournalEntry("MSFT", "hold", 3,
                     "Capex scare knocked my conviction even though the thesis held. "
                     "Recording the wobble rather than pretending it did not happen.",
                     _months_ago(12)),
    SeedJournalEntry("MSFT", "add", 5,
                     "Margin expanded through the capex cycle exactly as written. "
                     "Conviction is now higher than before the scare.",
                     _months_ago(11)),
    SeedJournalEntry("NVDA", "buy", 3,
                     "Buying something already well understood by everyone. Small size.",
                     _months_ago(9)),
    SeedJournalEntry("NKE", "sell", 2,
                     "My own window closed without the evidence arriving.",
                     _months_ago(7), outcome="loss"),
    SeedJournalEntry("ADBE", "buy", 4,
                     "Betting AI expands the seat base. Falsifier written into the thesis.",
                     _months_ago(6)),
    SeedJournalEntry("TSM", "buy", 4,
                     "The capacity everyone else depends on.",
                     _months_ago(4)),
    SeedJournalEntry("ADBE", "hold", 2,
                     "Falsifier hit. Conviction down hard and I have not acted yet, "
                     "which is itself the thing worth tracking.",
                     _months_ago(2)),
]

SEED_WATCHLIST: list[SeedWatchlistItem] = [
    SeedWatchlistItem("LVMH.PA", "Want to understand aspirational-spend cyclicality first."),
    SeedWatchlistItem("V", "Waiting to see whether stablecoin rails dent the take rate."),
    SeedWatchlistItem("SHOP", "Interested, but I do not have an edge on GMV durability."),
    SeedWatchlistItem("NVO", "Watching supply constraints ease before forming a view."),
]

DEMO_PORTFOLIO_NAME = "Sample Portfolio"
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/test_demo_seed_data.py -q`
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/demo_seed_data.py backend/tests/test_demo_seed_data.py
git commit -m "feat: add the demo portfolio fixture"
```

---

## Task 6: Seed persistence and endpoint

**Files:**
- Create: `backend/app/services/demo_seed.py`
- Create: `backend/app/routers/demo.py`
- Modify: `backend/app/main.py:128`

- [ ] **Step 1: Write the persistence service**

Create `backend/app/services/demo_seed.py`:

```python
"""Persist the demo fixture for one user.

Idempotent: a user who already owns a portfolio is left alone, so a double-click
on "Enter the demo" or a retried request cannot duplicate anything.
"""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    DecisionJournalEntry,
    Portfolio,
    ThesisEntry,
    ThesisThread,
    Transaction,
    User,
    WatchlistItem,
)
from app.services import portfolio_calc
from app.services.demo_seed_data import (
    DEMO_PORTFOLIO_NAME,
    SEED_JOURNAL,
    SEED_THESES,
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)

logger = logging.getLogger(__name__)


async def seed_demo_user(user: User, db: AsyncSession) -> uuid.UUID:
    """Create the sample portfolio and history. Returns the portfolio id.

    Safe to call repeatedly — returns the existing portfolio's id if the user
    already has one.
    """
    existing = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id).limit(1)
    )
    portfolio = existing.scalar_one_or_none()
    if portfolio is not None:
        return portfolio.id

    portfolio = Portfolio(
        user_id=user.id,
        name=DEMO_PORTFOLIO_NAME,
        currency="USD",
        is_default=True,
        account_type="brokerage",
    )
    db.add(portfolio)
    await db.flush()  # assigns portfolio.id without committing

    for t in SEED_TRANSACTIONS:
        db.add(
            Transaction(
                portfolio_id=portfolio.id,
                ticker=t.ticker,
                asset_type="stock",
                transaction_type=t.transaction_type,
                quantity=t.quantity,
                price=t.price,
                currency="USD",
                executed_at=t.executed_at,
                notes=t.notes or None,
                source="manual",
            )
        )

    for th in SEED_THESES:
        thread = ThesisThread(user_id=user.id, ticker=th.ticker, title=th.title)
        db.add(thread)
        await db.flush()
        for e in th.entries:
            db.add(
                ThesisEntry(
                    thread_id=thread.id,
                    body=e.body,
                    entry_type=e.entry_type,
                    created_at=e.created_at,
                )
            )

    for j in SEED_JOURNAL:
        db.add(
            DecisionJournalEntry(
                user_id=user.id,
                ticker=j.ticker,
                action=j.action,
                conviction=j.conviction,
                rationale=j.rationale,
                decided_at=j.decided_at,
                outcome=j.outcome,
            )
        )

    for w in SEED_WATCHLIST:
        db.add(WatchlistItem(user_id=user.id, ticker=w.ticker, notes=w.notes))

    await db.commit()

    # Holdings is a materialised table — transactions alone produce no
    # positions, and the dashboard reads holdings. recompute_holdings only
    # stages the delete+insert on the session; it does not commit (matching
    # every other call site in app/routers/portfolio.py), so we must commit
    # again here or the recomputed rows are rolled back when the request's
    # session closes and the demo dashboard comes up empty.
    await portfolio_calc.recompute_holdings(portfolio.id, db)
    await db.commit()

    logger.info("Seeded demo portfolio for user %s", user.id)
    return portfolio.id
```

> **Corrected during execution.** The original plan omitted the second
> `await db.commit()`. `recompute_holdings` does not commit, and `get_db` does
> not commit on clean exit, so the materialised holdings would have been rolled
> back — the demo dashboard would have rendered with zero positions while the
> transactions persisted fine. Landed as `9213114`.

- [ ] **Step 2: Write the router**

Create `backend/app/routers/demo.py`:

```python
"""Demo account provisioning."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User
from app.services.demo_seed import seed_demo_user

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
async def seed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Populate the calling demo account with the sample portfolio.

    Restricted to demo accounts: a real user calling this would get someone
    else's fictional history written into their own records.
    """
    if not user.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is only available to demo accounts",
        )
    portfolio_id = await seed_demo_user(user, db)
    return {"portfolio_id": str(portfolio_id)}
```

- [ ] **Step 3: Register the router**

In `backend/app/main.py`, after line 128 (`app.include_router(deep_dive.router, ...)`):

```python
app.include_router(demo.router,         prefix=PREFIX, tags=["demo"])
```

And add `demo` to the existing router import list at the top of the file, alongside `deep_dive`.

- [ ] **Step 4: Verify the app imports and the route exists**

Run: `cd backend && .venv/bin/python -c "
from app.main import app
print([r.path for r in app.routes if 'demo' in r.path])
"`
Expected: `['/api/v1/demo/seed']`

- [ ] **Step 5: Run the whole suite**

Run: `cd backend && .venv/bin/pytest -q`
Expected: `16 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/demo_seed.py backend/app/routers/demo.py backend/app/main.py
git commit -m "feat: add POST /demo/seed to provision demo accounts"
```

---

## Task 7: Global AI spend ceiling

**Files:**
- Create: `backend/app/core/ai_budget.py`
- Modify: `backend/app/config.py`
- Test: `backend/tests/test_ai_caps.py`

- [ ] **Step 1: Add the settings**

In `backend/app/config.py`, after the `UNLOCK_ALL_TIERS` block:

```python
    # ── Demo release cost controls ────────────────────────────────────────
    # Velnor's public demo hands every anonymous visitor a Navigator account,
    # and Navigator's AI quota is unlimited. These caps are what stop an
    # unbounded supply of fresh accounts becoming an unbounded bill. Settings
    # rather than constants so they can be raised without a redeploy.
    AI_GLOBAL_DAILY_LIMIT: int = 100
    DEMO_USER_DAILY_AI_LIMIT: int = 5
    DEEP_DIVE_GLOBAL_DAILY_LIMIT: int = 1
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_ai_caps.py`:

```python
from app.core.ai_budget import (
    GLOBAL_AI_KEY_PREFIX,
    consume_deep_dive_budget,
    consume_global_ai_budget,
)


async def test_global_budget_allows_up_to_the_limit(redis_clean):
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:allow"
    for _ in range(3):
        assert await consume_global_ai_budget(limit=3, key=key) is True


async def test_global_budget_refuses_past_the_limit(redis_clean):
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:refuse"
    for _ in range(3):
        assert await consume_global_ai_budget(limit=3, key=key) is True
    assert await consume_global_ai_budget(limit=3, key=key) is False


async def test_global_budget_boundary_is_exact(redis_clean):
    """Off-by-one here either blocks a paid-for call or serves a free one."""
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:boundary"
    assert await consume_global_ai_budget(limit=1, key=key) is True
    assert await consume_global_ai_budget(limit=1, key=key) is False


async def test_deep_dive_allows_exactly_one_run(redis_clean):
    key = "test:deep_dive:one"
    assert await consume_deep_dive_budget(limit=1, key=key) is True
    assert await consume_deep_dive_budget(limit=1, key=key) is False


async def test_zero_limit_refuses_everything(redis_clean):
    key = "test:deep_dive:zero"
    assert await consume_deep_dive_budget(limit=0, key=key) is False
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/test_ai_caps.py -q`
Expected: `ModuleNotFoundError: No module named 'app.core.ai_budget'`

- [ ] **Step 4: Write the implementation**

Create `backend/app/core/ai_budget.py`:

```python
"""Global spend ceilings for AI features.

The public demo gives every anonymous visitor a Navigator account, and
Navigator's per-user AI quota is unlimited. Per-user limits therefore cannot
bound total spend on their own — an unbounded supply of accounts multiplies any
per-user number. These are the ceilings that make the bill finite regardless of
how many accounts exist.

Counters are per UTC day, keyed by date, and expire on their own.
"""
from datetime import datetime, timezone

from app.core.cache import rate_limit_increment

GLOBAL_AI_KEY_PREFIX = "ai:global"
DEEP_DIVE_KEY_PREFIX = "deep_dive:global"

# 26h: comfortably past a day rollover, so a counter cannot outlive its date.
_TTL_SECONDS = 26 * 60 * 60


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def consume_global_ai_budget(limit: int, key: str | None = None) -> bool:
    """Claim one unit of today's global AI budget. True if granted."""
    if limit <= 0:
        return False
    counter = key or f"{GLOBAL_AI_KEY_PREFIX}:{_today()}"
    _, allowed = await rate_limit_increment(counter, limit, ttl=_TTL_SECONDS)
    return allowed


async def consume_deep_dive_budget(limit: int, key: str | None = None) -> bool:
    """Claim today's Deep Dive run. True if this caller got it.

    First-come first-served by design: Deep Dive is Opus plus live web search,
    so the cheapest correct policy is one run a day for whoever asks first.
    """
    if limit <= 0:
        return False
    counter = key or f"{DEEP_DIVE_KEY_PREFIX}:{_today()}"
    _, allowed = await rate_limit_increment(counter, limit, ttl=_TTL_SECONDS)
    return allowed
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/test_ai_caps.py -q`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/ai_budget.py backend/app/config.py backend/tests/test_ai_caps.py
git commit -m "feat: add global daily ceilings for AI and Deep Dive spend"
```

---

## Task 8: Enforce the caps in the AI router

**Files:**
- Modify: `backend/app/routers/ai.py:450-495`

- [ ] **Step 1: Add the imports**

At the top of `backend/app/routers/ai.py`, alongside the existing cache import:

```python
from app.core.ai_budget import consume_global_ai_budget
from app.config import settings
```

(`settings` may already be imported — check before adding.)

- [ ] **Step 2: Give demo users a finite quota**

Replace the `_INSIGHT_LIMITS` lookup in `_enforce_insight_quota` (`app/routers/ai.py:474`):

```python
    daily_limit = _INSIGHT_LIMITS.get(tier, 0)
```

with:

```python
    # Demo accounts resolve to Navigator (UNLOCK_ALL_TIERS), whose limit is -1
    # for unlimited. Unlimited AI on freely-creatable accounts is unbounded
    # spend, so demo accounts get a finite quota regardless of tier.
    if user.is_demo:
        daily_limit = settings.DEMO_USER_DAILY_AI_LIMIT
    else:
        daily_limit = _INSIGHT_LIMITS.get(tier, 0)
```

- [ ] **Step 3: Check the global ceiling LAST**

> **Corrected during execution.** The original plan put this check first, right
> after the `daily_limit` assignment. That is wrong: it consumes a unit of the
> *shared* global counter on every request, including ones immediately refused
> for being horizon-tier (403) or for having exhausted their own per-user quota
> (429). Because the counter is shared, a client spamming requests its own quota
> would reject could burn down the global ceiling and deny service to every
> other visitor for the rest of the day, without ever reaching the paid API.
> The check belongs **last**, immediately before `return sse_headers`, so a unit
> is only spent once the request has cleared every gate that would refuse it for
> free. Landed as `e9269e5`.

Immediately before `return sse_headers`, after the per-user quota block, insert:

```python
    # Checked before the per-user quota so one visitor cannot drain the day for
    # everyone else, and so the ceiling holds however many accounts exist.
    if not await consume_global_ai_budget(settings.AI_GLOBAL_DAILY_LIMIT):
        raise HTTPException(
            status_code=429,
            detail="Today's AI capacity for the demo has been used. It resets at 00:00 UTC.",
        )
```

- [ ] **Step 4: Verify the module imports and the suite is green**

Run: `cd backend && .venv/bin/python -c "import app.routers.ai" && .venv/bin/pytest -q`
Expected: no import output, then `21 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/ai.py
git commit -m "feat: cap demo AI spend globally and per demo user"
```

---

## Task 9: Deep Dive — one global run per day, sample report fallback

**Files:**
- Modify: `backend/app/routers/deep_dive.py`

- [ ] **Step 1: Read the router first**

Run: `cd backend && sed -n '1,80p' app/routers/deep_dive.py`

You need the existing generate endpoint's name, its response shape, and how it currently enqueues the Celery task. The edits below attach to that endpoint; do not guess its signature.

- [ ] **Step 2: Add the imports**

```python
from app.core.ai_budget import consume_deep_dive_budget
from app.config import settings
```

- [ ] **Step 3: Gate the generate endpoint**

At the very start of the generate endpoint body, before any work is queued:

```python
    # Opus plus live web search is the most expensive path in the product, and
    # every fresh anonymous account would otherwise be entitled to its own run.
    # One run per day, first-come first-served; everyone after gets the
    # pre-generated sample so the feature still demonstrates itself.
    if not await consume_deep_dive_budget(settings.DEEP_DIVE_GLOBAL_DAILY_LIMIT):
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DEEP_DIVE_BUDGET_SPENT",
                "message": "Today's Deep Dive has already been generated. "
                           "Showing a previously generated example instead.",
                "show_sample": True,
            },
        )
```

- [ ] **Step 4: Replace the Celery enqueue with a background task**

Add `BackgroundTasks` to the endpoint signature:

```python
async def generate(
    background_tasks: BackgroundTasks,
    # ... keep every existing parameter exactly as it is
):
```

Import it from fastapi:

```python
from fastapi import BackgroundTasks
```

Then replace the Celery `.delay(...)` call with:

```python
    # Celery was dropped for the demo release: one job per day does not justify
    # a second always-on Fly machine. The frontend polls the report row every
    # 10s and stops when it completes, which behaves identically either way.
    background_tasks.add_task(run_deep_dive_sync, str(report.id))
```

Where `run_deep_dive_sync` is the plain function the Celery task wrapped — find it in `app/tasks/deep_dive_task.py` and import it directly. If the Celery task body contains the logic inline rather than calling a function, extract that body into a module-level function in `app/services/deep_dive.py` first and have both call it.

- [ ] **Step 5: Verify it imports**

Run: `cd backend && .venv/bin/python -c "import app.routers.deep_dive" && .venv/bin/pytest -q`
Expected: no import output, then `21 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/deep_dive.py backend/app/services/deep_dive.py backend/app/tasks/deep_dive_task.py
git commit -m "feat: limit Deep Dive to one global run per day, drop Celery"
```

---

## Task 10: Cron entrypoints

**Files:**
- Create: `backend/scripts/purge_demo_users.py`
- Create: `backend/scripts/warm_quote_cache.py`

- [ ] **Step 1: Write the purge script**

Create `backend/scripts/purge_demo_users.py`:

```python
"""Delete demo accounts older than 24 hours. Run by a Fly cron machine.

One DELETE is the whole job: every relationship on User declares
cascade="all, delete-orphan" and every FK is ondelete="CASCADE", so portfolios,
transactions, thesis threads, journal entries and watchlist items go with it.

Known limitation: this removes Velnor's users row, not the orphaned Supabase
auth.users record. Deleting those needs service_role, which this backend
deliberately does not hold.
"""
import asyncio
import logging

from sqlalchemy import text

from app.dependencies import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("purge_demo_users")


async def main() -> None:
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                "DELETE FROM users "
                "WHERE is_demo AND created_at < now() - interval '24 hours'"
            )
        )
        logger.info("Purged %s expired demo accounts", result.rowcount)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Write the warm-up script**

Create `backend/scripts/warm_quote_cache.py`:

```python
"""Keep the demo's own tickers warm in Redis. Run by a Fly cron machine.

Yahoo throttles datacenter IPs harder than residential ones, and a demo whose
prices are blank reads as broken rather than rate-limited. Warming only the seed
tickers keeps the first thing a visitor sees independent of a live Yahoo call
succeeding. Empty responses are not cached (a648f6b), so a throttled run
degrades instead of poisoning the cache.
"""
import asyncio
import logging

from app.services import market_data
from app.services.demo_seed_data import (
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("warm_quote_cache")

TICKERS = sorted(
    {t.ticker for t in SEED_TRANSACTIONS} | {w.ticker for w in SEED_WATCHLIST}
)


async def main() -> None:
    logger.info("Warming %d tickers", len(TICKERS))
    for ticker in TICKERS:
        try:
            await market_data.get_quote(ticker)
        except Exception as e:
            # A throttled or failed ticker must not abort the rest.
            logger.warning("Warm failed for %s: %s", ticker, e)
        await asyncio.sleep(0.3)  # respect the ~4 req/s throttle from 1fd8e5c
    logger.info("Warm-up complete")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Confirm the quote function name**

> **Corrected during execution.** There is no singular `get_quote`. The real
> helper is `async def get_quotes(tickers: list[str], ttl: int = 60) -> dict`,
> and every call site in the app batches through it even for one ticker. The
> script calls `await market_data.get_quotes([ticker])`. Landed as `4489bf8`.

- [ ] **Step 4: Dry-run the warm-up locally**

Run: `cd backend && .venv/bin/python -m scripts.warm_quote_cache`
Expected: `Warming 11 tickers` then `Warm-up complete` (7 traded plus 4 watchlist). Individual `Warm failed` lines are acceptable — Yahoo throttling is pre-existing.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/
git commit -m "feat: add demo purge and quote warm-up cron entrypoints"
```

---

## Task 11: Container image and Fly config

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/fly.toml`

- [ ] **Step 1: Write the Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build deps for asyncpg and friends, removed in the same layer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Note: no `--reload` here. This also fixes `docker-compose.yml`, which has referenced this file all along without it existing.

- [ ] **Step 2: Write fly.toml**

Create `backend/fly.toml`:

```toml
app = "velnor-api"
primary_region = "lhr"

[build]
  dockerfile = "Dockerfile"

[env]
  APP_ENV = "production"
  DEBUG = "false"
  PORT = "8000"

[http_service]
  internal_port = 8000
  force_https = true
  # A cold start is the exact failure this release exists to avoid: a visitor
  # clicking a LinkedIn link will not wait 30 seconds for a machine to boot.
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

`DEBUG = "false"` matters: it defaults to `true`, which switches on SQLAlchemy `echo` and logs every query.

- [ ] **Step 3: Verify the image builds**

Docker is unavailable locally, so this is verified by Fly's remote builder in Task 14. Do not attempt a local `docker build`.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/fly.toml
git commit -m "build: add backend Dockerfile and Fly config"
```

---

## Task 12: CORS origin

**Files:**
- Modify: `backend/app/config.py:23`

- [ ] **Step 1: Make allowed origins configurable**

`ALLOWED_ORIGINS` currently hardcodes `http://localhost:3000` and
`https://vela.finance`, neither of which is where this deploys. Replace:

```python
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "https://vela.finance"]
```

with:

```python
    # Overridable from the environment so the Vercel origin can be set at deploy
    # time without a code change. pydantic-settings parses a JSON list from env.
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://vela.finance",
    ]
```

The value is then set on Fly as a JSON array once the Vercel URL is known (Task 14).

- [ ] **Step 2: Verify parsing works**

Run: `cd backend && ALLOWED_ORIGINS='["https://example.vercel.app"]' .venv/bin/python -c "
from app.config import Settings
print(Settings().ALLOWED_ORIGINS)
"`
Expected: `['https://example.vercel.app']`

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "chore: allow ALLOWED_ORIGINS to be set from the environment"
```

---

## Task 13: Frontend demo entry

**Files:**
- Create: `frontend/lib/demo.ts`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Write the entry helper**

Create `frontend/lib/demo.ts`:

```typescript
import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * Sign in anonymously and provision the sample portfolio.
 *
 * Supabase anonymous sign-in returns an ordinary ES256 access token carrying
 * `is_anonymous: true`, which the backend verifies against the same JWKS as any
 * other session. The seed call is idempotent, so a double click is harmless.
 */
export async function enterDemo(): Promise<void> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Could not start the demo: ${error.message}`);

  const token = data.session?.access_token;
  if (!token) throw new Error("Could not start the demo: no session returned");

  const res = await fetch("/api/v1/demo/seed", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Could not prepare the demo portfolio (${res.status})`);
  }
}
```

- [ ] **Step 2: Wire the CTA**

In `frontend/app/page.tsx`, add the import:

```typescript
import { enterDemo } from "@/lib/demo";
```

Add state next to the existing `useState` calls:

```typescript
  const [entering, setEntering] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
```

Add the handler:

```typescript
  async function handleEnterDemo() {
    setEntering(true);
    setDemoError(null);
    try {
      await enterDemo();
      router.push("/dashboard");
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : "Something went wrong");
      setEntering(false);
    }
  }
```

Replace the waitlist form in the hero with:

```tsx
  <div className="flex flex-col items-start gap-3">
    <button
      onClick={handleEnterDemo}
      disabled={entering}
      className="inline-flex items-center gap-2 rounded-lg bg-vela-teal px-5 py-3
                 font-medium text-vela-bg transition hover:brightness-110
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {entering ? "Preparing your demo…" : "Enter the demo"}
      {!entering && icons.arrow}
    </button>
    <p className="text-sm text-vela-muted">
      No signup. A sample portfolio, ready to explore.
    </p>
    {demoError && (
      <p className="text-sm text-loss" role="alert">
        {demoError}
      </p>
    )}
  </div>
```

Confirm `router` is already in scope — `useRouter` is imported at
`frontend/app/page.tsx:3`.

- [ ] **Step 3: Check the dashboard route path**

Run: `cd frontend && ls "app/(dashboard)/" | head -20`

Confirm whether the landing dashboard is `/dashboard` or something else, and fix
the `router.push` target to match.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors. Unused-variable errors for the removed waitlist state are real — delete that state too.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/demo.ts frontend/app/page.tsx
git commit -m "feat: one-click demo entry on the landing page"
```

---

## Task 14: Sample-data marker and footer unlink

**Files:**
- Modify: `frontend/components/instrument/TopBar.tsx`
- Modify: whichever component renders the footer legal links

- [ ] **Step 1: Find the footer links**

Run: `cd frontend && grep -rn '"/privacy"\|"/terms"' app components | grep -v node_modules`

- [ ] **Step 2: Remove both links**

Delete the `/privacy` and `/terms` anchors from the footer. Leave the route files
in `app/(legal)/` untouched — the pages stay reachable by URL, they are simply
not advertised, which is what avoids publishing `[Operator legal name]`.

- [ ] **Step 3: Add the marker to TopBar**

Read the file first: `cd frontend && sed -n '1,60p' components/instrument/TopBar.tsx`

Add a `isDemo` prop, and render beside the title:

```tsx
{isDemo && (
  <span className="rounded border border-vela-border px-2 py-0.5 font-mono
                   text-[10px] uppercase tracking-wider text-vela-muted">
    Sample portfolio · not investment advice
  </span>
)}
```

This marker is load-bearing, not decoration: the seeded thesis prose is
operator-authored content about real securities, and the label is what keeps it
attributable to a fictional persona.

- [ ] **Step 4: Source `isDemo`**

`/auth/me` already returns the user. Add `is_demo` to that response in
`backend/app/routers/auth.py` and read it wherever TopBar's other user data
comes from. Run this to find the response shape:

Run: `cd backend && grep -n "def me\|/me" app/routers/auth.py`

- [ ] **Step 5: Type-check and test**

Run: `cd frontend && npm run type-check && npm test`
Expected: no type errors, 28 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/components frontend/app backend/app/routers/auth.py
git commit -m "feat: mark demo sessions as sample data, unlink legal templates"
```

---

## Task 15: Deploy

Requires the operator to have completed all five actions in spec section 10.
**Do not start this task until Tasks 7, 8 and 9 are committed** — a public URL
without the spend caps is an uncapped bill.

- [ ] **Step 1: Confirm the operator prerequisites**

Ask the user to confirm, and stop until they do:
1. Anonymous sign-ins enabled in Supabase
2. Anthropic Console spend limit set
3. Upstash Redis created
4. `fly auth login` done
5. `vercel login` done

- [ ] **Step 2: Create the Fly app**

Run: `cd backend && fly launch --no-deploy --copy-config --name velnor-api --region lhr`
Expected: `Created app velnor-api`. Decline any offer to create a Postgres or Redis — Supabase and Upstash cover both.

- [ ] **Step 3: Push secrets from the existing .env**

```bash
cd backend && fly secrets set \
  DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" \
  DATABASE_URL_SYNC="$(grep '^DATABASE_URL_SYNC=' .env | cut -d= -f2-)" \
  SUPABASE_URL="$(grep '^SUPABASE_URL=' .env | cut -d= -f2-)" \
  ANTHROPIC_API_KEY="$(grep '^ANTHROPIC_API_KEY=' .env | cut -d= -f2-)" \
  FRED_API_KEY="$(grep '^FRED_API_KEY=' .env | cut -d= -f2-)"
```

Values are read from disk and never printed. Do not echo them.

- [ ] **Step 4: Have the operator set the Redis URL**

Give the user this command to run themselves, so the value never passes through
the conversation:

```bash
cd backend && fly secrets set REDIS_URL='<paste the Upstash redis:// URL>'
```

- [ ] **Step 5: Deploy the backend**

Run: `cd backend && fly deploy`
Expected: build succeeds on Fly's remote builder, then `1 desired, 1 placed, 1 healthy`

- [ ] **Step 6: Smoke-test the backend**

Run: `curl -s https://velnor-api.fly.dev/health`
Expected: a healthy JSON response. If `/health` does not exist, run
`cd backend && grep -n '"/health"' app/main.py` to find the real path.

- [ ] **Step 7: Deploy the frontend**

```bash
cd frontend && vercel --prod \
  -e NEXT_PUBLIC_SUPABASE_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)" \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2-)" \
  -e BACKEND_URL="https://velnor-api.fly.dev"
```

Note the returned production URL.

- [ ] **Step 8: Set the CORS origin to the Vercel URL**

```bash
cd backend && fly secrets set ALLOWED_ORIGINS='["https://<your-vercel-url>"]'
```

This restarts the machine. Wait for healthy before continuing.

- [ ] **Step 9: Create the two cron machines**

```bash
cd backend && fly machine run . \
  --schedule daily \
  --command "python -m scripts.purge_demo_users" \
  --name velnor-purge-demo
```

```bash
cd backend && fly machine run . \
  --schedule hourly \
  --command "python -m scripts.warm_quote_cache" \
  --name velnor-warm-quotes
```

Fly's scheduler offers hourly/daily/weekly/monthly, not arbitrary cron, so the
warm-up runs hourly rather than the spec's 15 minutes. Acceptable: quote TTLs
outlive an hour and the purge only needs daily granularity.

- [ ] **Step 10: Commit any config drift**

```bash
git add backend/fly.toml && git commit -m "chore: Fly app config from launch" || true
```

---

## Task 16: Live verification

The handoff's standing open item is that the tier unlock has never been seen
working in a real logged-in session. A demo user resolves to Navigator, so this
is what finally proves it.

- [ ] **Step 1: Walk the entry path**

Open the Vercel URL in the browser pane. Click "Enter the demo". Confirm you
reach a populated dashboard with positions, without typing anything.

- [ ] **Step 2: Check the console and network**

Use `read_console_messages` and `read_network_requests`. Expected: zero errors,
and `POST /api/v1/demo/seed` returning 200.

- [ ] **Step 3: Verify the four endpoints that would still 403**

These are the specific ones the handoff flags as unproven:
1. `/reflect`
2. Company page — financial statements
3. Company page — management & governance
4. Company page — insider activity

Any 403 here means the tier unlock missed something. Report it rather than
working around it.

- [ ] **Step 4: Verify the Journey map is not uniformly green**

Open the Journey page for `ADBE`. The seed makes this the deliberate divergence,
so its bubbles must show amber or red. A uniformly green map means the colour
rubric is not reading `DecisionJournalEntry.conviction` as expected.

- [ ] **Step 5: Verify the caps actually bite**

Temporarily set the ceiling to 1, confirm the second AI call returns 429, then
restore:

```bash
cd backend && fly secrets set AI_GLOBAL_DAILY_LIMIT=1
# make two AI calls in the UI; the second must show the capacity message
cd backend && fly secrets set AI_GLOBAL_DAILY_LIMIT=100
```

- [ ] **Step 6: Check two visitors do not collide**

Open the site in a second browser context and enter the demo again. Confirm both
sessions work and neither sees the other's edits. This is the unique-email
regression from Task 2, verified end to end.

- [ ] **Step 7: Mobile viewport**

`resize_window` to the mobile preset, reload, walk the entry path again. Confirm
no horizontal overflow at 375px.

- [ ] **Step 8: Update HANDOFF.md**

Record: the live URLs, that the tier unlock is now verified (or what 403'd), the
Fly app and cron machine names, and that Celery is no longer used.

```bash
git add HANDOFF.md && git commit -m "docs: record the demo release state"
```

---

## Blockers found during execution

**yfinance 0.2.50 could not fetch any market data at all.** `requirements.txt`
pinned it, and against Yahoo's current API every request returns non-JSON, so
yfinance reports every symbol as "possibly delisted" and `fast_info` raises
`KeyError: 'currentTradingPeriod'`. Verified directly: MSFT history returned 0
rows on 0.2.50 and 5 rows on 1.3.0. This would have shipped a portfolio tracker
that renders no prices — the single worst outcome for this release. Found
because the new warm-up script failed on all 11 seed tickers. Fixed by pinning
`yfinance==1.3.0` (`0693dbf`).

**`LVMH.PA` is not a Yahoo symbol.** LVMH on Euronext Paris is `MC.PA`. It was
the one seed ticker still failing after the yfinance fix (`215758d`). All 11 now
warm with zero failures.

**Anonymous sign-ins were already enabled** on the Supabase project, so that
operator step is already done. Verified against the live project: the token is
ES256 with `sub` present, `email: ''`, and `is_anonymous: True` as a real
boolean — exactly what `resolve_identity` keys off.

**The demo marker had to move to the dashboard layout.** Task 14 put it in
`TopBar`, but `TopBar` is opt-in per page and only 26 of 61 dashboard pages
render it. A compliance control visible on 43% of pages is not a control, so it
moved to `app/(dashboard)/layout.tsx`, which wraps every page and already hosts
the `<Disclaimer />` component for exactly this purpose.

**Two ordering bugs in the original plan**, both corrected in place above: the
missing `db.commit()` after `recompute_holdings` (Task 6), and the global AI
ceiling being claimed before the cheaper rejection paths (Task 8).

## Self-review notes

**Spec coverage.** Section 1 → Tasks 13, 14. Section 2 → Tasks 2, 3, 4.
Section 3 → Tasks 5, 6. Section 4.1/4.2 → Tasks 7, 8. Section 4.3 → Task 9.
Section 4.4 → Task 15 step 1. Section 5 → Task 9 step 4. Section 6 → Tasks 10,
15. Section 7 → Tasks 11, 12, 15. Section 8 → Task 14. Section 9 → Task 16.
Section 10 → Task 15 step 1.

**Deviations from the spec, deliberate:**
- Warm-up runs hourly, not every 15 minutes: Fly's scheduler has no arbitrary
  cron granularity. Noted in Task 15 step 9.
- No DB-integration test for seed idempotency. Docker is unavailable and the
  models are Postgres-specific, so the fixture's shape is unit tested (Task 5)
  and the idempotency guard is verified live (Task 16 step 6). The spec's
  section 9 asks for an idempotency test; this is the closest honest
  substitute and the reason is recorded here rather than silently dropped.

**Known unknowns the implementer must resolve by reading, flagged in-task:**
Task 9 step 1 (Deep Dive endpoint signature), Task 10 step 3 (`get_quote` name),
Task 13 step 3 (dashboard route), Task 14 steps 1/4 (footer component,
`/auth/me` shape), Task 15 step 6 (`/health` path).
