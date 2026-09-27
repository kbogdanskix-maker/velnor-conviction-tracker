"""Maps a verified Supabase JWT payload to the identity we store locally.

Kept separate from `dependencies.get_current_user` so the rules are unit
testable without a database, and so the one security-sensitive decision here —
when an account counts as a demo account — lives in one readable place.
"""
from fastapi import HTTPException, status

# RFC 2606 reserves .invalid, so these addresses can never resolve or be
# mistaken for a real mailbox.
_DEMO_EMAIL_DOMAIN = "demo.invalid"


def resolve_identity(payload: dict) -> tuple[str, bool]:
    """Return (email, is_demo) for a verified token payload.

    Anonymous Supabase sessions carry no email, but `User.email` is UNIQUE and
    NOT NULL, so every anonymous user needs a distinct synthetic address derived
    from their `sub`.

    The anonymous branch is gated on the `is_anonymous` claim, never on "email
    is missing". A non-anonymous token arriving without an email is a real
    anomaly and must fail rather than silently become a demo account.
    """
    sub = payload["sub"]

    if payload.get("is_anonymous") is True:
        return f"anon-{sub}@{_DEMO_EMAIL_DOMAIN}", True

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no email and is not anonymous",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email, False
