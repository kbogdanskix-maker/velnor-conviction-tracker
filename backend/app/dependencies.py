"""
Shared FastAPI dependencies.
Injected via Depends() across all routers.
"""
import uuid
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.config import settings
from app.core.security import decode_supabase_token
from app.models.db import User

logger = logging.getLogger(__name__)

# ── Database ──────────────────────────────────────────────────────────────────

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── Auth ──────────────────────────────────────────────────────────────────────

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the Supabase JWT and upserts the user into our local DB.
    This is the core auth dependency — all protected routes depend on it.
    """
    token = credentials.credentials
    payload = decode_supabase_token(token)

    supabase_uid = uuid.UUID(payload["sub"])
    email = payload.get("email") or ""

    # Upsert: find existing user or create on first login
    result = await db.execute(
        select(User).where(User.supabase_uid == supabase_uid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            supabase_uid=supabase_uid,
            email=email,
            tier="horizon",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("New user created: %s", email)
    elif user.email != email and email:
        # Keep email in sync if it changed in Supabase
        user.email = email
        await db.commit()

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None for unauthenticated requests (public routes)."""
    if credentials is None:
        return None
    try:
        return await get_current_user.__wrapped__(credentials, db)  # type: ignore
    except HTTPException:
        return None
