import pytest
from fastapi import HTTPException

from app.core.identity import resolve_identity


def test_real_user_keeps_their_email():
    email, is_demo = resolve_identity({"sub": "a" * 36, "email": "me@example.com"})
    assert email == "me@example.com"
    assert is_demo is False


def test_anonymous_user_gets_synthetic_address():
    sub = "11111111-1111-1111-1111-111111111111"
    email, is_demo = resolve_identity({"sub": sub, "is_anonymous": True})
    assert email == f"anon-{sub}@demo.invalid"
    assert is_demo is True


def test_two_anonymous_users_get_different_addresses():
    """The regression this release exists to prevent: User.email is UNIQUE, so
    two anonymous users sharing an address makes the second signup a 500."""
    a, _ = resolve_identity({"sub": "1" * 36, "is_anonymous": True})
    b, _ = resolve_identity({"sub": "2" * 36, "is_anonymous": True})
    assert a != b


def test_non_anonymous_token_without_email_is_rejected():
    """Must fail loudly rather than being absorbed as a demo account."""
    with pytest.raises(HTTPException) as exc:
        resolve_identity({"sub": "c" * 36})
    assert exc.value.status_code == 401


def test_anonymous_claim_wins_over_a_present_email():
    sub = "33333333-3333-3333-3333-333333333333"
    email, is_demo = resolve_identity(
        {"sub": sub, "email": "spoof@example.com", "is_anonymous": True}
    )
    assert email == f"anon-{sub}@demo.invalid"
    assert is_demo is True
