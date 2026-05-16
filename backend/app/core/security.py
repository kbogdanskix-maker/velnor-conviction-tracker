"""
Supabase JWT verification.
Every request to a protected endpoint passes its Bearer token here.
We decode it using the Supabase JWKS public key (ES256) and extract the user's
supabase_uid (sub claim). The get_current_user dependency then upserts
that uid into our local users table.
"""
import logging
import httpx
import jwt as pyjwt
from jwt import PyJWKClient
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

# Cache the JWKS client — it fetches keys once and caches them
_jwks_client = PyJWKClient(
    f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    lifespan=3600,
)


def decode_supabase_token(token: str) -> dict:
    """
    Decodes and validates a Supabase-issued JWT using JWKS (ES256).
    Returns the full payload on success.
    Raises HTTP 401 on any failure.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        sub: str | None = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except pyjwt.ExpiredSignatureError:
        logger.warning("JWT expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.warning("JWT decode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
