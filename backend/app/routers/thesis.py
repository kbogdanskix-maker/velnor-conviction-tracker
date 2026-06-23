"""
Thesis — versioned conviction notebook.

A ThesisThread is one idea, keyed to a ticker. Each edit appends a new
ThesisEntry (bull | bear | update | note) — entries are NEVER overwritten, so the
thread is a conviction trail over time. This append-only history is what the Stock
Journey map (Phase 3) and the conviction-aware AI surfaces read from.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.db import User, ThesisThread, ThesisEntry
from app.models.schemas import (
    ThesisThreadCreate,
    ThesisEntryCreate,
    ThesisEntryOut,
    ThesisThreadOut,
    ThesisThreadSummary,
)

router = APIRouter(prefix="/thesis")

_VALID_ENTRY_TYPES = {"bull", "bear", "update", "note"}


def _norm_ticker(ticker: str) -> str:
    """One canonical ticker form across Thesis / alerts / Journey."""
    return ticker.strip().upper()


def _norm_entry_type(value: str) -> str:
    v = (value or "note").strip().lower()
    return v if v in _VALID_ENTRY_TYPES else "note"


async def _owned_thread(thread_id, user: User, db: AsyncSession, with_entries: bool = False) -> ThesisThread:
    stmt = select(ThesisThread).where(
        ThesisThread.id == thread_id,
        ThesisThread.user_id == user.id,
    )
    if with_entries:
        stmt = stmt.options(selectinload(ThesisThread.entries))
    thread = (await db.execute(stmt)).scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thesis not found")
    return thread


@router.get("", response_model=list[ThesisThreadSummary])
async def list_threads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All of the user's thesis threads, most-recently-updated first, with a
    cheap entry count + latest entry type (no full entry bodies)."""
    threads = (await db.execute(
        select(ThesisThread)
        .where(ThesisThread.user_id == user.id)
        .order_by(ThesisThread.updated_at.desc())
    )).scalars().all()

    if not threads:
        return []

    # entry counts in one grouped query
    counts = dict((tid, n) for tid, n in (await db.execute(
        select(ThesisEntry.thread_id, sqlfunc.count(ThesisEntry.id))
        .where(ThesisEntry.thread_id.in_([t.id for t in threads]))
        .group_by(ThesisEntry.thread_id)
    )).all())

    out: list[ThesisThreadSummary] = []
    for t in threads:
        latest = (await db.execute(
            select(ThesisEntry.entry_type)
            .where(ThesisEntry.thread_id == t.id)
            .order_by(ThesisEntry.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        out.append(ThesisThreadSummary(
            id=t.id, ticker=t.ticker, title=t.title,
            created_at=t.created_at, updated_at=t.updated_at,
            entry_count=counts.get(t.id, 0), latest_entry_type=latest,
        ))
    return out


@router.get("/{thread_id}", response_model=ThesisThreadOut)
async def get_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A single thread with its full entry history (oldest first — the trail)."""
    thread = await _owned_thread(thread_id, user, db, with_entries=True)
    return thread


@router.post("", response_model=ThesisThreadOut, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ThesisThreadCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a thread, optionally with its opening entry."""
    thread = ThesisThread(
        user_id=user.id,
        ticker=_norm_ticker(body.ticker),
        title=body.title.strip(),
    )
    db.add(thread)
    await db.flush()  # assign thread.id

    if body.initial_body and body.initial_body.strip():
        db.add(ThesisEntry(
            thread_id=thread.id,
            body=body.initial_body.strip(),
            entry_type=_norm_entry_type(body.entry_type),
        ))

    await db.commit()
    # reload with entries for the response
    return await _owned_thread(thread.id, user, db, with_entries=True)


@router.post("/{thread_id}/entries", response_model=ThesisEntryOut, status_code=status.HTTP_201_CREATED)
async def add_entry(
    thread_id: str,
    body: ThesisEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Append a new entry. This is how a conviction evolves — never edit in place."""
    thread = await _owned_thread(thread_id, user, db)
    entry = ThesisEntry(
        thread_id=thread.id,
        body=body.body.strip(),
        entry_type=_norm_entry_type(body.entry_type),
    )
    db.add(entry)
    # bump the thread so it sorts to the top of the list
    thread.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a thread and its entries (cascade). Owner-only."""
    thread = await _owned_thread(thread_id, user, db)
    await db.delete(thread)
    await db.commit()
