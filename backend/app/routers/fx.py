"""
FX endpoints — live exchange rates via yfinance forex pairs.
Cached in Redis for 5 minutes.
"""
import logging
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models.db import User
from app.core.cache import cache_get, cache_set
import asyncio
import yfinance as yf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fx")

# 20 major currencies — same set as the frontend
CURRENCIES = [
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "INR",
    "KRW", "SGD", "HKD", "SEK", "NOK", "MXN", "BRL", "PLN", "TRY", "ZAR",
]

FX_TTL = 300  # 5 minutes


def _build_pairs() -> list[str]:
    """Build yfinance forex pair symbols: EURUSD=X, GBPUSD=X, etc."""
    return [f"{c}USD=X" for c in CURRENCIES if c != "USD"]


def _fetch_rates_sync() -> dict[str, float]:
    """Fetch all rates vs USD from yfinance (blocking)."""
    pairs = _build_pairs()
    rates: dict[str, float] = {"USD": 1.0}

    try:
        tickers = yf.Tickers(" ".join(pairs))
        for pair in pairs:
            code = pair.replace("USD=X", "")
            try:
                info = tickers.tickers[pair].fast_info
                price = float(info.last_price or 0)
                if price > 0:
                    rates[code] = price
            except Exception as e:
                logger.warning("FX fetch failed for %s: %s", pair, e)
    except Exception as e:
        logger.error("FX batch fetch failed: %s", e)

    return rates


async def get_fx_rates() -> dict[str, float]:
    """Get all FX rates vs USD, cached for 5 min."""
    cached = await cache_get("fx:rates")
    if cached is not None:
        return cached

    rates = await asyncio.to_thread(_fetch_rates_sync)
    if len(rates) > 1:  # only cache if we got real data
        await cache_set("fx:rates", rates, ttl=FX_TTL)

    return rates


@router.get("")
async def fx_rates(
    _: User = Depends(get_current_user),
):
    """
    Returns exchange rates for 20 currencies vs USD.
    Each value is how many USD 1 unit of that currency buys.
    Example: {"EUR": 1.085, "GBP": 1.265, "JPY": 0.00667, ...}
    """
    rates = await get_fx_rates()
    return {"base": "USD", "rates": rates}
