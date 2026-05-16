"""
Tier enforcement.

Usage in any router:

    from app.core.tier import require_tier, Tier

    @router.get("/screener")
    async def get_screener(
        _: None = Depends(require_tier(Tier.VOYAGER)),
        user: User = Depends(get_current_user),
    ):
        ...

A 403 is returned with enough info for the frontend to render an upgrade prompt.
"""
from enum import IntEnum
from fastapi import Depends, HTTPException, status
from app.dependencies import get_current_user
from app.models.db import User


class Tier(IntEnum):
    HORIZON = 0    # free
    VOYAGER = 1    # $9/mo
    NAVIGATOR = 2  # $49/mo


TIER_NAME_MAP = {
    "horizon": Tier.HORIZON,
    "voyager": Tier.VOYAGER,
    "navigator": Tier.NAVIGATOR,
}


def require_tier(minimum: Tier):
    """
    FastAPI dependency factory.
    Raises 403 if the current user's tier is below `minimum`.
    """
    async def check(user: User = Depends(get_current_user)):
        user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
        if user_tier < minimum:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "TIER_REQUIRED",
                    "required": minimum.name.lower(),
                    "current": user.tier,
                    "upgrade_url": "/pricing",
                },
            )
    return check


def check_thread_limit(user: User, current_count: int) -> None:
    """Raise 403 if Horizon user has hit 3 thesis thread limit."""
    user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
    if user_tier == Tier.HORIZON and current_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "THREAD_LIMIT",
                "limit": 3,
                "upgrade_url": "/pricing",
            },
        )


def check_options_view_limit(user: User, views_this_week: int) -> None:
    """Raise 403 if Horizon user has hit 3 options chain views per week."""
    user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
    if user_tier == Tier.HORIZON and views_this_week >= 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "OPTIONS_VIEW_LIMIT",
                "limit": 3,
                "period": "week",
                "upgrade_url": "/pricing",
            },
        )


def check_dcf_model_limit(user: User, saved_count: int) -> None:
    """Raise 403 if Voyager user has hit 5 saved DCF model limit."""
    user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
    if user_tier == Tier.VOYAGER and saved_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DCF_MODEL_LIMIT",
                "limit": 5,
                "upgrade_url": "/pricing",
            },
        )


def get_quote_ttl(user: User) -> int:
    """Returns Redis TTL in seconds for quote caching based on user tier."""
    user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
    if user_tier >= Tier.NAVIGATOR:
        return 5
    if user_tier >= Tier.VOYAGER:
        return 15
    return 60


def get_chart_history_years(user: User) -> int:
    """Returns years of history available for the performance chart."""
    user_tier = TIER_NAME_MAP.get(user.tier, Tier.HORIZON)
    return 5 if user_tier >= Tier.VOYAGER else 1
