from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import uuid

from app.dependencies import get_current_user, get_db
from app.models.db import User, WatchlistItem
from app.models.schemas import WatchlistItemCreate, WatchlistItemOut
from app.services import market_data

router = APIRouter(prefix="/watchlist")


@router.get("", response_model=list[WatchlistItemOut])
async def get_watchlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.added_at.desc())
    )
    items = result.scalars().all()

    if not items:
        return []

    tickers = [i.ticker for i in items]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    enriched = []
    for item in items:
        q = quotes.get(item.ticker, {})
        enriched.append(
            WatchlistItemOut(
                id=item.id,
                ticker=item.ticker,
                asset_type=item.asset_type,
                notes=item.notes,
                added_at=item.added_at,
                current_price=q.get("price"),
                day_change_pct=q.get("change_pct"),
            )
        )
    return enriched


@router.post("", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    body: WatchlistItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id,
            WatchlistItem.ticker == body.ticker.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ticker already in watchlist")

    item = WatchlistItem(user_id=user.id, ticker=body.ticker.upper(), **body.model_dump(exclude={"ticker"}))
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return WatchlistItemOut(**item.__dict__)


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    ticker: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.user_id == user.id,
            WatchlistItem.ticker == ticker.upper(),
        ).returning(WatchlistItem.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Ticker not in watchlist")
    await db.commit()
