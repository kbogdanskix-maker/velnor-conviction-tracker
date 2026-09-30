"""Rebuild the screener universe. Run daily by a Fly cron machine.

The screener is assembled from per-ticker `info:*` cache entries, and a ticker
whose fetch failed is simply absent — so the universe silently shrinks rather
than erroring. The in-request background warm cannot be relied on to repair it:
it is a FastAPI BackgroundTask, so every deploy kills it mid-pass and nothing
restarts it until a visitor opens the screener.

Throttling lives in the warm itself (~4 req/s), so a full pass over ~5700
tickers takes ~25 minutes. That is why this is daily and not hourly.
"""
import asyncio
import logging

from app.routers.screener import warm_screener_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("warm_screener_cache")


async def main() -> None:
    logger.info("Rebuilding screener universe")
    await warm_screener_cache()
    logger.info("Screener universe rebuild complete")


if __name__ == "__main__":
    asyncio.run(main())
