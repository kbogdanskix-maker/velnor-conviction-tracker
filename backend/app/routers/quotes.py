"""
Quote endpoints — live prices for arbitrary tickers.
TTL is tier-aware.
"""
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.models.db import User
from app.core.tier import get_quote_ttl
from app.services import market_data

router = APIRouter(prefix="/quotes")


@router.get("")
async def get_quotes(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. AAPL,MSFT,NVDA"),
    user: User = Depends(get_current_user),
):
    """
    Fetch live quotes for a list of tickers.
    Cache TTL depends on user tier: Horizon=60s, Voyager=15s, Navigator=5s.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:50]
    ttl = get_quote_ttl(user)
    quotes = await market_data.get_quotes(ticker_list, ttl=ttl)
    return quotes


@router.get("/search")
async def search_tickers(
    q: str = Query(..., min_length=1, max_length=50),
    _: User = Depends(get_current_user),
):
    """Ticker/company name search via yfinance."""
    results = await market_data.search_tickers(q)
    return results


@router.get("/options/{ticker}")
async def get_options_chain(
    ticker: str,
    _: User = Depends(get_current_user),
):
    """Options chain — calls & puts for nearest 4 expiry dates."""
    return await market_data.get_options_chain(ticker.upper())
