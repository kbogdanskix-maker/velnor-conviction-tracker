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
