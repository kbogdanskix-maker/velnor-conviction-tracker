"""Tests for `get_current_user_optional`.

Both paths below reach the real `get_current_user` and the real
`decode_supabase_token` — nothing is mocked. They are DB-free because neither
path gets as far as touching the session: an absent header returns early, and an
invalid token raises out of `decode_supabase_token` before the first
`db.execute`. `db` is therefore passed as a tripwire that fails loudly if it is
ever used, which is the assertion rather than a stand-in for a database.

The remaining path — a *valid* token upserting and returning a User — needs a
real Postgres and is not covered here. See tests/conftest.py for why no DB
fixture exists; that path stays verified live.
"""
import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.dependencies import get_current_user_optional


class _UnusableSession:
    """Stands in for AsyncSession and raises if anything touches it."""

    def __getattr__(self, name):
        raise AssertionError(f"database was used unexpectedly: .{name}")


async def test_missing_credentials_returns_none():
    assert await get_current_user_optional(None, _UnusableSession()) is None


async def test_invalid_token_returns_none_instead_of_raising():
    """The regression this test exists to prevent: the dependency used to call
    `get_current_user.__wrapped__`, which does not exist on an undecorated
    coroutine function. That raised AttributeError before the body ran, so the
    `except HTTPException` clause never fired and an unauthenticated caller got
    a 500 instead of None.

    "not.a.jwt" is malformed at the header, so PyJWT rejects it before any JWKS
    fetch — no network, no DB.
    """
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not.a.jwt")

    assert await get_current_user_optional(credentials, _UnusableSession()) is None


async def test_invalid_token_does_not_leak_a_non_http_exception():
    """Guards the failure mode directly: anything other than HTTPException from
    the inner call escapes the handler and becomes a 500."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="")

    try:
        result = await get_current_user_optional(credentials, _UnusableSession())
    except Exception as exc:  # pragma: no cover - only on regression
        pytest.fail(f"expected None, got {type(exc).__name__}: {exc}")

    assert result is None
