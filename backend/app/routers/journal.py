"""
Decision Journal — CRUD for investment decision tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import uuid

from app.dependencies import get_current_user, get_db
from app.models.db import User, DecisionJournalEntry
from app.models.schemas import JournalEntryCreate, JournalEntryUpdate, JournalEntryOut

router = APIRouter(prefix="/journal")


@router.get("", response_model=list[JournalEntryOut])
async def list_entries(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DecisionJournalEntry)
        .where(DecisionJournalEntry.user_id == user.id)
        .order_by(DecisionJournalEntry.decided_at.desc())
    )
    return result.scalars().all()


@router.get("/stats")
async def journal_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats for the decision journal."""
    result = await db.execute(
        select(DecisionJournalEntry)
        .where(DecisionJournalEntry.user_id == user.id)
    )
    entries = result.scalars().all()

    total = len(entries)
    reviewed = [e for e in entries if e.outcome and e.outcome != "pending"]
    wins = len([e for e in reviewed if e.outcome == "win"])
    losses = len([e for e in reviewed if e.outcome == "loss"])
    breakeven = len([e for e in reviewed if e.outcome == "breakeven"])
    pending = total - len(reviewed)

    avg_conviction = sum(e.conviction for e in entries) / total if total else 0

    # Win rate for reviewed entries
    win_rate = wins / len(reviewed) if reviewed else None

    # Conviction vs outcome correlation
    win_avg_conv = sum(e.conviction for e in reviewed if e.outcome == "win") / wins if wins else None
    loss_avg_conv = sum(e.conviction for e in reviewed if e.outcome == "loss") / losses if losses else None

    # Action distribution
    action_counts = {}
    for e in entries:
        action_counts[e.action] = action_counts.get(e.action, 0) + 1

    return {
        "total": total,
        "wins": wins,
        "losses": losses,
        "breakeven": breakeven,
        "pending": pending,
        "win_rate": round(win_rate, 3) if win_rate is not None else None,
        "avg_conviction": round(avg_conviction, 1),
        "win_avg_conviction": round(win_avg_conv, 1) if win_avg_conv is not None else None,
        "loss_avg_conviction": round(loss_avg_conv, 1) if loss_avg_conv is not None else None,
        "action_counts": action_counts,
    }


@router.post("", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: JournalEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    data["ticker"] = data["ticker"].upper()
    entry = DecisionJournalEntry(user_id=user.id, **data)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryOut)
async def update_entry(
    entry_id: uuid.UUID,
    body: JournalEntryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DecisionJournalEntry).where(
            DecisionJournalEntry.id == entry_id,
            DecisionJournalEntry.user_id == user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        if key == "ticker" and value:
            value = value.upper()
        setattr(entry, key, value)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(DecisionJournalEntry)
        .where(
            DecisionJournalEntry.id == entry_id,
            DecisionJournalEntry.user_id == user.id,
        )
        .returning(DecisionJournalEntry.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    await db.commit()
