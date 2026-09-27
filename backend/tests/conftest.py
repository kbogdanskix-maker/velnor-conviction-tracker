"""Shared test fixtures.

No database fixture exists deliberately: Docker is unavailable on the dev
machine and the models are Postgres-specific (JSONB, UUID), so SQLite cannot
substitute. DB-touching logic is therefore split into pure functions tested
here, with persistence verified live. See the plan's "Critical context".
"""
import pytest_asyncio

from app.core.cache import get_redis

TEST_PREFIX = "test:"


@pytest_asyncio.fixture
async def redis_clean():
    """Yield Redis with every `vela:test:*` key removed before and after.

    Uses the real Homebrew Redis. Production keys are untouched because every
    key this fixture is used with starts with `test:`.
    """
    r = await get_redis()

    async def _purge():
        keys = [k async for k in r.scan_iter(f"vela:{TEST_PREFIX}*")]
        if keys:
            await r.delete(*keys)

    await _purge()
    yield r
    await _purge()
