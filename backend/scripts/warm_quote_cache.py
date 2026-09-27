"""Keep the demo's own tickers warm in Redis. Run by a Fly cron machine.

Yahoo throttles datacenter IPs harder than residential ones, and a demo whose
prices are blank reads as broken rather than rate-limited. Warming only the seed
tickers keeps the first thing a visitor sees independent of a live Yahoo call
succeeding. Empty responses are not cached (a648f6b), so a throttled run
degrades instead of poisoning the cache.
"""
import asyncio
import logging

from app.services import market_data
from app.services.demo_seed_data import (
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("warm_quote_cache")

TICKERS = sorted(
    {t.ticker for t in SEED_TRANSACTIONS} | {w.ticker for w in SEED_WATCHLIST}
)


async def main() -> None:
    logger.info("Warming %d tickers", len(TICKERS))
    for ticker in TICKERS:
        try:
            # market_data has no singular get_quote — every call site (routers
            # and services) batches through get_quotes, even for one ticker.
            await market_data.get_quotes([ticker])
        except Exception as e:
            # A throttled or failed ticker must not abort the rest.
            logger.warning("Warm failed for %s: %s", ticker, e)
        await asyncio.sleep(0.3)  # respect the ~4 req/s throttle from 1fd8e5c
    logger.info("Warm-up complete")


if __name__ == "__main__":
    asyncio.run(main())
