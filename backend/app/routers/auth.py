"""
Auth router — minimal surface since Supabase handles the actual authentication.
These endpoints let the frontend verify a token and fetch the current user profile.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User
from app.core.tier import effective_tier_name
from app.models.schemas import UserOut, UserUpdate

router = APIRouter(prefix="/auth")


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile.

    `tier` is the EFFECTIVE tier, which is what the frontend's TierGate keys
    off. Reporting the stored column here would leave the UI locked while the
    backend happily served the data. Built as a copy so the ORM object is never
    mutated and nothing can be flushed back to the database.
    """
    out = UserOut.model_validate(user)
    out.tier = effective_tier_name(user)
    return out


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update display name or preferred base currency."""
    if body.display_name is not None:
        user.display_name = body.display_name
    await db.commit()
    await db.refresh(user)
    return user
