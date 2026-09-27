"""
Deep Dive API — request and read equity-research-style briefings on one ticker.

The HTTP layer only enqueues; the Opus run happens in a FastAPI background
task because it takes minutes. Gated by two independent limits:

- A per-user cooldown of one dive per COOLDOWN_DAYS (existing behavior).
- A global cap of one dive per day across all users (demo release — see
  app.core.ai_budget), first-come first-served. Everyone after the day's one
  run gets a 429 with `show_sample: True` so the frontend can fall back to a
  pre-generated example instead of dead-ending.

Reports persist. That is deliberate: a stored dive can be cited by later AI
surfaces instead of re-researching the same ground, and it becomes a dated
record of what was knowable at the time.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.ai_budget import consume_deep_dive_budget
from app.dependencies import get_current_user, get_db
from app.models.db import (
    User, Portfolio, Holding, ThesisThread, ThesisEntry,
    DecisionJournalEntry, DeepDiveReport,
)
from app.routers.ai import _fetch_calibration_summary
from app.services.deep_dive import COOLDOWN_DAYS
from app.tasks.deep_dive_task import run_deep_dive_sync

router = APIRouter(prefix="/deep-dive")


def _norm(ticker: str) -> str:
    return (ticker or "").upper().strip()


def _serialize(row: DeepDiveReport) -> dict:
    return {
        "id": str(row.id),
        "ticker": row.ticker,
        "status": row.status,
        "report": row.report,
        "error": row.error,
        "model": row.model,
        "requested_at": row.requested_at.isoformat() if row.requested_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        "usage": {
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "web_searches": row.web_searches,
        },
    }


async def _last_run(db: AsyncSession, user: User) -> DeepDiveReport | None:
    """Most recent dive that consumed the allowance (a failure does not)."""
    return (await db.execute(
        select(DeepDiveReport)
        .where(
            DeepDiveReport.user_id == user.id,
            DeepDiveReport.status.in_(("queued", "running", "complete")),
        )
        .order_by(desc(DeepDiveReport.requested_at))
        .limit(1)
    )).scalar_one_or_none()


def _next_available(last: DeepDiveReport | None) -> datetime | None:
    if last is None or last.requested_at is None:
        return None
    return last.requested_at + timedelta(days=COOLDOWN_DAYS)


async def _build_context(db: AsyncSession, user: User, ticker: str) -> dict:
    """Everything the user has personally recorded about this ticker.

    Scoped to the one name, except calibration, which is their whole track
    record and travels as background. Fed to the model for the thesis_check
    step only, after the sourced research is done.
    """
    # Their position, if any.
    portfolios = (await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id)
    )).scalars().all()
    portfolio_ids = [p.id for p in portfolios]

    holding = None
    if portfolio_ids:
        h = (await db.execute(
            select(Holding).where(
                Holding.portfolio_id.in_(portfolio_ids),
                Holding.ticker == ticker,
            ).limit(1)
        )).scalar_one_or_none()
        if h is not None:
            holding = {
                "shares": float(h.quantity),
                "avg_cost": float(h.avg_cost_basis),
            }

    # The thesis trail for this ticker, oldest first — the model quotes from this.
    threads = (await db.execute(
        select(ThesisThread).where(
            ThesisThread.user_id == user.id,
            ThesisThread.ticker == ticker,
        )
    )).scalars().all()

    trail: list[dict] = []
    for th in threads:
        entries = (await db.execute(
            select(ThesisEntry)
            .where(ThesisEntry.thread_id == th.id)
            .order_by(ThesisEntry.created_at)
        )).scalars().all()
        for e in entries:
            trail.append({
                "written_on": e.created_at.date().isoformat() if e.created_at else None,
                "type": e.entry_type,
                "thread": th.title,
                "body": e.body,
            })
    trail.sort(key=lambda x: x["written_on"] or "")

    # Decision journal for this ticker — structured conviction + outcome.
    journal_rows = (await db.execute(
        select(DecisionJournalEntry)
        .where(
            DecisionJournalEntry.user_id == user.id,
            DecisionJournalEntry.ticker == ticker,
        )
        .order_by(DecisionJournalEntry.decided_at)
    )).scalars().all()
    journal = [{
        "decided_on": j.decided_at.date().isoformat() if j.decided_at else None,
        "action": j.action,
        "conviction": j.conviction,
        "outcome": j.outcome,
        "rationale": (j.rationale or "")[:500],
    } for j in journal_rows]

    calibration = await _fetch_calibration_summary(db, user)

    return {
        "holding": holding,
        "thesis_trail": trail,
        "journal": journal,
        "calibration": calibration,
    }


@router.get("/eligibility")
async def eligibility(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Whether the user can run a dive now, and when the next one unlocks."""
    last = await _last_run(db, user)
    nxt = _next_available(last)
    now = datetime.now(timezone.utc)
    available = nxt is None or nxt <= now
    return {
        "available": available,
        "cooldown_days": COOLDOWN_DAYS,
        "next_available_at": nxt.isoformat() if nxt else None,
        "last_ticker": last.ticker if last else None,
        "in_progress": bool(last and last.status in ("queued", "running")),
    }


@router.get("")
async def list_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(DeepDiveReport)
        .where(DeepDiveReport.user_id == user.id)
        .order_by(desc(DeepDiveReport.requested_at))
        .limit(50)
    )).scalars().all()
    return [_serialize(r) for r in rows]


@router.get("/{report_id}")
async def get_report(
    report_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(DeepDiveReport).where(
            DeepDiveReport.id == report_id,
            DeepDiveReport.user_id == user.id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize(row)


@router.post("/{ticker}")
async def request_deep_dive(
    ticker: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue a deep dive. One per user per COOLDOWN_DAYS, and one globally per day."""
    tk = _norm(ticker)
    if not tk:
        raise HTTPException(status_code=400, detail="Ticker required")

    last = await _last_run(db, user)
    if last is not None and last.status in ("queued", "running"):
        raise HTTPException(
            status_code=409,
            detail=f"A deep dive on {last.ticker} is already running.",
        )

    nxt = _next_available(last)
    if nxt is not None and nxt > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=429,
            detail=f"Next deep dive available {nxt.date().isoformat()}.",
            headers={"X-Deep-Dive-Next-Available": nxt.isoformat()},
        )

    # Global budget claimed only now: every guard above that can still reject
    # the request (missing ticker, an in-progress dive, the per-user cooldown)
    # has already passed. With a daily limit of exactly 1, claiming any
    # earlier would let a request that was going to be rejected anyway spend
    # the one run nobody else could then use until tomorrow. Claimed before
    # the DeepDiveReport row is created, too: creating that row first and
    # denying the budget afterward would leave a "queued" row behind that
    # nothing ever advances — which would both trip the in-progress 409 guard
    # above and extend this user's own cooldown, for a dive that never ran.
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

    context = await _build_context(db, user, tk)

    row = DeepDiveReport(user_id=user.id, ticker=tk, status="queued")
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # Celery was dropped for the demo release: one job per day does not justify
    # a second always-on Fly machine. The frontend polls the report row every
    # 10s and stops when it completes, which behaves identically either way.
    background_tasks.add_task(run_deep_dive_sync, str(row.id), context, None)

    return _serialize(row)
