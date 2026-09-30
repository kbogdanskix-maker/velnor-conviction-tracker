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
from app.core.identity import resolve_identity
from app.models.db import User

logger = logging.getLogger(__name__)

# ── Database ──────────────────────────────────────────────────────────────────

# We connect through Supabase's **session-mode** pooler (port 5432), which caps
# the whole project at 15 clients:
#
#   asyncpg.exceptions.InternalServerError:
#   (EMAXCONNSESSION) max clients reached in session mode
#   - max clients are limited to pool_size: 15
#
# pool_size=10 + max_overflow=20 let this one process ask for 30 — twice the
# ceiling — so under concurrency the pooler starts refusing and requests 500
# instead of queueing. Hit while driving ~59 pages from a single browser, which
# is less load than a link doing the rounds.
#
# 10 total leaves headroom inside the 15 for the cron machines (purge_demo_users
# touches the DB) and for a one-off script or an `fly ssh` session. pool_timeout
# makes a request that cannot get a connection fail in 10s rather than hang.
#
# To raise this ceiling properly, move to the **transaction-mode** pooler
# (port 6543), which allows far more clients — that needs asyncpg's prepared
# statements disabled (`statement_cache_size=0`), so it wants a deliberate
# change and a load test, not a launch-day edit.
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=5,
    pool_timeout=10,
    pool_recycle=1800,
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
    email, is_demo = resolve_identity(payload)

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
            is_demo=is_demo,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("New user created: %s", email)
    elif not user.is_demo and user.email != email and email:
        # Keep email in sync if it changed in Supabase. Skipped for demo users,
        # whose address is synthesized from `sub` and never changes.
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
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
