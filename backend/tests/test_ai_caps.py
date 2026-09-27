from app.core.ai_budget import (
    GLOBAL_AI_KEY_PREFIX,
    consume_deep_dive_budget,
    consume_global_ai_budget,
)


async def test_global_budget_allows_up_to_the_limit(redis_clean):
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:allow"
    for _ in range(3):
        assert await consume_global_ai_budget(limit=3, key=key) is True


async def test_global_budget_refuses_past_the_limit(redis_clean):
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:refuse"
    for _ in range(3):
        assert await consume_global_ai_budget(limit=3, key=key) is True
    assert await consume_global_ai_budget(limit=3, key=key) is False


async def test_global_budget_boundary_is_exact(redis_clean):
    """Off-by-one here either blocks a paid-for call or serves a free one."""
    key = f"test:{GLOBAL_AI_KEY_PREFIX}:boundary"
    assert await consume_global_ai_budget(limit=1, key=key) is True
    assert await consume_global_ai_budget(limit=1, key=key) is False


async def test_deep_dive_allows_exactly_one_run(redis_clean):
    key = "test:deep_dive:one"
    assert await consume_deep_dive_budget(limit=1, key=key) is True
    assert await consume_deep_dive_budget(limit=1, key=key) is False


async def test_zero_limit_refuses_everything(redis_clean):
    key = "test:deep_dive:zero"
    assert await consume_deep_dive_budget(limit=0, key=key) is False
