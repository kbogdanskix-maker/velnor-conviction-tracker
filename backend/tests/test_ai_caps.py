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


async def test_global_budget_fails_closed_on_redis_error(monkeypatch):
    """rate_limit_increment fails open (0, True) on a Redis error. For a
    spend ceiling that must be treated as a refusal, not a grant."""

    async def fake_rate_limit_increment(key, limit, ttl):
        return (0, True)

    monkeypatch.setattr(
        "app.core.ai_budget.rate_limit_increment", fake_rate_limit_increment
    )
    assert await consume_global_ai_budget(limit=5, key="test:doesnt-matter") is False


async def test_deep_dive_fails_closed_on_redis_error(monkeypatch):
    async def fake_rate_limit_increment(key, limit, ttl):
        return (0, True)

    monkeypatch.setattr(
        "app.core.ai_budget.rate_limit_increment", fake_rate_limit_increment
    )
    assert await consume_deep_dive_budget(limit=5, key="test:doesnt-matter") is False


# ── Per-feature, per-user allowances ─────────────────────────────────────────
# These split the pooled per-user quota so one visitor cannot spend the whole
# allowance on the most expensive surface (Reflect, on Sonnet 5) and leave
# nothing for anyone else.

from app.core.ai_budget import (  # noqa: E402
    consume_user_feature_budget,
    peek_budget,
    user_feature_counter,
)


def _k(feature: str, uid: str) -> str:
    """Test-prefixed counter, so the redis_clean fixture actually purges it."""
    return f"test:ai:feature:{feature}:{uid}"


async def test_feature_budget_allows_exactly_its_limit(redis_clean):
    k = _k("reflect", "user-a")
    for _ in range(5):
        assert await consume_user_feature_budget("reflect", "u", limit=5, key=k) is True
    assert await consume_user_feature_budget("reflect", "u", limit=5, key=k) is False


async def test_feature_budgets_are_independent_per_feature(redis_clean):
    """Exhausting Reflect must not touch the earnings allowance."""
    kr, ke = _k("reflect", "user-b"), _k("earnings", "user-b")
    for _ in range(5):
        await consume_user_feature_budget("reflect", "u", limit=5, key=kr)
    assert await consume_user_feature_budget("reflect", "u", limit=5, key=kr) is False
    assert await consume_user_feature_budget("earnings", "u", limit=2, key=ke) is True


async def test_feature_budgets_are_independent_per_user(redis_clean):
    """One visitor exhausting their allowance must not affect the next."""
    kc, kd = _k("earnings", "user-c"), _k("earnings", "user-d")
    for _ in range(2):
        await consume_user_feature_budget("earnings", "u", limit=2, key=kc)
    assert await consume_user_feature_budget("earnings", "u", limit=2, key=kc) is False
    assert await consume_user_feature_budget("earnings", "u", limit=2, key=kd) is True


async def test_reflect_allows_one_chat_but_five_answers(redis_clean):
    """The shape the demo actually sells: one conversation, five turns in it."""
    ko, ka = _k("reflect_open", "user-e"), _k("reflect", "user-e")
    assert await consume_user_feature_budget("reflect_open", "u", limit=1, key=ko) is True
    assert await consume_user_feature_budget("reflect_open", "u", limit=1, key=ko) is False
    for _ in range(5):
        assert await consume_user_feature_budget("reflect", "u", limit=5, key=ka) is True
    assert await consume_user_feature_budget("reflect", "u", limit=5, key=ka) is False


async def test_peek_does_not_consume(redis_clean):
    """A Reflect opening checks both counters before spending either. If peek
    consumed, opening a chat with the answers exhausted would burn the one
    conversation of the day and generate nothing."""
    counter = _k("reflect", "user-f")
    assert await peek_budget(counter) == 0
    assert await peek_budget(counter) == 0
    await consume_user_feature_budget("reflect", "u", limit=5, key=counter)
    assert await peek_budget(counter) == 1


async def test_feature_budget_fails_closed_on_redis_error(monkeypatch):
    """Same argument as the global ceiling: during a Redis outage a false
    allow is an uncapped bill, not a UX nuisance."""

    async def fake_rate_limit_increment(key, limit, ttl):
        return (0, True)

    monkeypatch.setattr(
        "app.core.ai_budget.rate_limit_increment", fake_rate_limit_increment
    )
    assert await consume_user_feature_budget(
        "reflect", "u", limit=5, key=_k("reflect", "user-g")
    ) is False


def test_user_feature_counter_separates_users_and_features():
    """The production key derivation. If two users or two features collapsed to
    one counter, one visitor's usage would silently spend another's allowance —
    and the per-key tests above use explicit keys, so nothing else covers this.
    """
    a = user_feature_counter("reflect", "user-1")
    b = user_feature_counter("reflect", "user-2")
    c = user_feature_counter("earnings", "user-1")
    assert a != b, "two users must not share a counter"
    assert a != c, "two features must not share a counter"
    assert a.startswith("ai:feature:reflect:user-1:"), a
    # Dated, so an allowance resets on the UTC day boundary rather than never.
    assert a.rsplit(":", 1)[-1].count("-") == 2, a
