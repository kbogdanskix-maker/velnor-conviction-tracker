"""
Redis cache helpers.
All keys are namespaced under 'vela:' to avoid collisions.
"""
import json
import logging
from typing import Any
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def cache_get(key: str) -> Any | None:
    """Return parsed JSON value for key, or None if missing."""
    try:
        r = await get_redis()
        raw = await r.get(f"vela:{key}")
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning("Redis GET error for key %s: %s", key, e)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Serialise value to JSON and store with TTL (seconds)."""
    try:
        r = await get_redis()
        await r.set(f"vela:{key}", json.dumps(value), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET error for key %s: %s", key, e)


async def cache_delete(key: str) -> None:
    try:
        r = await get_redis()
        await r.delete(f"vela:{key}")
    except Exception as e:
        logger.warning("Redis DEL error for key %s: %s", key, e)


async def rate_limit_increment(key: str, limit: int, ttl: int) -> tuple[int, bool]:
    """Atomically increment a counter and check against a limit.
    Sets TTL only on first write (so counter expires at the natural rollover).
    Returns (current_count, allowed).
    """
    try:
        r = await get_redis()
        full_key = f"vela:{key}"
        count = await r.incr(full_key)
        if count == 1:
            # First increment — set expiry
            await r.expire(full_key, ttl)
        return count, count <= limit
    except Exception as e:
        logger.warning("Redis rate limit error for key %s: %s", key, e)
        # Fail open — don't block requests on Redis errors
        return 0, True


async def rate_limit_get(key: str) -> int:
    """Return current counter value (0 if not set)."""
    try:
        r = await get_redis()
        val = await r.get(f"vela:{key}")
        return int(val) if val else 0
    except Exception:
        return 0


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (e.g. 'quotes:*')."""
    try:
        r = await get_redis()
        keys = [k async for k in r.scan_iter(f"vela:{pattern}")]
        if keys:
            await r.delete(*keys)
    except Exception as e:
        logger.warning("Redis pattern DEL error for %s: %s", pattern, e)
