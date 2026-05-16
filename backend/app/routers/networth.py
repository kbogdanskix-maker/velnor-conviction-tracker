"""
Net Worth — unified asset + liability tracking.
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User, NetWorthAsset, Holding, Portfolio
from app.models.schemas import (
    NetWorthAssetCreate,
    NetWorthAssetUpdate,
    NetWorthAssetOut,
    NetWorthSummaryOut,
)
from app.services import market_data
from app.services import portfolio_calc

router = APIRouter(prefix="/net-worth")


# ── CRUD ─────────────────────────────────────────────────────────────────────


@router.get("/assets", response_model=list[NetWorthAssetOut])
async def list_assets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NetWorthAsset)
        .where(NetWorthAsset.user_id == user.id)
        .order_by(NetWorthAsset.is_liability, NetWorthAsset.name)
    )
    return result.scalars().all()


@router.post("/assets", response_model=NetWorthAssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(
    body: NetWorthAssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = NetWorthAsset(user_id=user.id, **body.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.patch("/assets/{asset_id}", response_model=NetWorthAssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    body: NetWorthAssetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NetWorthAsset).where(
            NetWorthAsset.id == asset_id,
            NetWorthAsset.user_id == user.id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)

    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(NetWorthAsset)
        .where(NetWorthAsset.id == asset_id, NetWorthAsset.user_id == user.id)
        .returning(NetWorthAsset.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()


# ── Summary (assets + liabilities + live portfolio) ──────────────────────────


@router.get("/summary", response_model=NetWorthSummaryOut)
async def get_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all manual assets/liabilities
    result = await db.execute(
        select(NetWorthAsset)
        .where(NetWorthAsset.user_id == user.id)
        .order_by(NetWorthAsset.is_liability, NetWorthAsset.name)
    )
    items = result.scalars().all()

    # Compute live portfolio value from holdings
    portfolio_value = Decimal("0")
    port_result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id)
    )
    portfolios = port_result.scalars().all()

    for p in portfolios:
        h_result = await db.execute(
            select(Holding).where(Holding.portfolio_id == p.id)
        )
        holdings = h_result.scalars().all()
        if holdings:
            tickers = [h.ticker for h in holdings]
            quotes = await market_data.get_quotes(tickers, ttl=60)
            for h in holdings:
                q = quotes.get(h.ticker, {})
                price = q.get("price", 0) or 0
                portfolio_value += h.quantity * Decimal(str(price))

    total_assets = sum(
        (a.value for a in items if not a.is_liability), Decimal("0")
    ) + portfolio_value

    total_liabilities = sum(
        (a.value for a in items if a.is_liability), Decimal("0")
    )

    return NetWorthSummaryOut(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=total_assets - total_liabilities,
        portfolio_value=portfolio_value,
        assets=items,
    )
