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
