"""Delete demo accounts older than 24 hours. Run by a Fly cron machine.

One DELETE is the whole job: every relationship on User declares
cascade="all, delete-orphan" and every FK is ondelete="CASCADE", so portfolios,
transactions, thesis threads, journal entries and watchlist items go with it.

Known limitation: this removes Velnor's users row, not the orphaned Supabase
auth.users record. Deleting those needs service_role, which this backend
deliberately does not hold.
"""
import asyncio
import logging

from sqlalchemy import text

from app.dependencies import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("purge_demo_users")


async def main() -> None:
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                "DELETE FROM users "
                "WHERE is_demo AND created_at < now() - interval '24 hours'"
            )
        )
        logger.info("Purged %s expired demo accounts", result.rowcount)


if __name__ == "__main__":
    asyncio.run(main())
