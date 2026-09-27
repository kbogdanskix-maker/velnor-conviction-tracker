"""Global spend ceilings for AI features.

The public demo gives every anonymous visitor a Navigator account, and
Navigator's per-user AI quota is unlimited. Per-user limits therefore cannot
bound total spend on their own — an unbounded supply of accounts multiplies any
per-user number. These are the ceilings that make the bill finite regardless of
how many accounts exist.

Counters are per UTC day, keyed by date, and expire on their own.

FAIL-CLOSED, DELIBERATELY, UNLIKE `rate_limit_increment` ITSELF:
`rate_limit_increment` (app.core.cache) fails OPEN on a Redis error — it
returns (0, True) so a Redis outage doesn't block requests for its other
callers (the slowapi limiter, per-user quotas), where the cost of a false
allow is a UX nuisance. These two functions exist for a different reason:
bounding a financial liability. Here, a false allow during a Redis outage is
not a nuisance, it's an uncapped bill, at exactly the moment infrastructure is
already unhealthy. Degraded AI features beat an unbounded bill, so we invert
the primitive's fail-open behavior at this layer instead of changing it
globally. Do not "fix" this back to match `rate_limit_increment` — that
would silently remove the ceiling during every Redis outage.

The signal used to detect the swallowed-exception path: a successful Redis
INCR always returns >= 1 (it's a post-increment count), so
`rate_limit_increment` returning a count of exactly 0 uniquely identifies
"Redis raised and we caught it", not "Redis said no". We treat that as a
refusal here rather than trusting the `allowed` bool it paired with 0.
"""
from datetime import datetime, timezone

from app.core.cache import rate_limit_increment

GLOBAL_AI_KEY_PREFIX = "ai:global"
DEEP_DIVE_KEY_PREFIX = "deep_dive:global"

# 26h: comfortably past a day rollover, so a counter cannot outlive its date.
_TTL_SECONDS = 26 * 60 * 60


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _consume_budget(prefix: str, limit: int, key: str | None) -> bool:
    """Claim one unit of today's budget for `prefix`. True if granted.

    See module docstring: fails CLOSED on a Redis error, unlike the
    `rate_limit_increment` primitive it wraps.
    """
    if limit <= 0:
        return False
    counter = key or f"{prefix}:{_today()}"
    count, allowed = await rate_limit_increment(counter, limit, ttl=_TTL_SECONDS)
    if count == 0:
        # rate_limit_increment's swallowed-exception signal. A real INCR
        # result is always >= 1, so this can only be the fail-open path.
        return False
    return allowed


async def consume_global_ai_budget(limit: int, key: str | None = None) -> bool:
    """Claim one unit of today's global AI budget. True if granted."""
    return await _consume_budget(GLOBAL_AI_KEY_PREFIX, limit, key)


async def consume_deep_dive_budget(limit: int, key: str | None = None) -> bool:
    """Claim today's Deep Dive run. True if this caller got it.

    First-come first-served by design: Deep Dive is Opus plus live web search,
    so the cheapest correct policy is one run a day for whoever asks first.
    """
    return await _consume_budget(DEEP_DIVE_KEY_PREFIX, limit, key)
