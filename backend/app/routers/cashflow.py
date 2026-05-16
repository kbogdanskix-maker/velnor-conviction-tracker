"""
Cash Flow — recurring income & expense tracking.
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User, CashFlowEntry
from app.models.schemas import (
    CashFlowEntryCreate,
    CashFlowEntryUpdate,
    CashFlowEntryOut,
    CashFlowSummaryOut,
)

router = APIRouter(prefix="/cash-flow")


@router.get("/entries", response_model=list[CashFlowEntryOut])
async def list_entries(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CashFlowEntry)
        .where(CashFlowEntry.user_id == user.id)
        .order_by(CashFlowEntry.entry_type, CashFlowEntry.name)
    )
    return result.scalars().all()


@router.post("/entries", response_model=CashFlowEntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: CashFlowEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = CashFlowEntry(user_id=user.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}", response_model=CashFlowEntryOut)
async def update_entry(
    entry_id: uuid.UUID,
    body: CashFlowEntryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CashFlowEntry).where(
            CashFlowEntry.id == entry_id,
            CashFlowEntry.user_id == user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(CashFlowEntry)
        .where(CashFlowEntry.id == entry_id, CashFlowEntry.user_id == user.id)
        .returning(CashFlowEntry.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.commit()


@router.get("/summary", response_model=CashFlowSummaryOut)
async def get_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CashFlowEntry)
        .where(CashFlowEntry.user_id == user.id, CashFlowEntry.is_active == True)
        .order_by(CashFlowEntry.entry_type, CashFlowEntry.name)
    )
    entries = result.scalars().all()

    total_income = sum((e.amount for e in entries if e.entry_type == "income"), Decimal("0"))
    total_fixed = sum((e.amount for e in entries if e.entry_type == "fixed_expense"), Decimal("0"))
    total_variable = sum((e.amount for e in entries if e.entry_type == "variable_expense"), Decimal("0"))
    total_expenses = total_fixed + total_variable
    savings = total_income - total_expenses
    savings_rate = (savings / total_income * 100) if total_income > 0 else Decimal("0")

    return CashFlowSummaryOut(
        total_income=total_income,
        total_fixed=total_fixed,
        total_variable=total_variable,
        total_expenses=total_expenses,
        savings=savings,
        savings_rate=savings_rate,
        entries=entries,
    )
