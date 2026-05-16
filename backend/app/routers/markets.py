"""
Markets page — US indices, international indices, top movers.
All data from yfinance, cached aggressively.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.models.db import User
from app.services import market_data

router = APIRouter(prefix="/markets")

US_INDICES = {
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ",
    "^RUT": "Russell 2000",
    "^DJI": "Dow Jones",
    "^VIX": "VIX",
}

INTL_INDICES = {
    "^GDAXI": "DAX",
    "^FTSE": "FTSE 100",
    "^N225": "Nikkei 225",
    "^HSI": "Hang Seng",
    "^FCHI": "CAC 40",
    "^STOXX50E": "Euro Stoxx 50",
    "^AXJO": "ASX 200",
}


@router.get("/overview")
async def get_market_overview(_: User = Depends(get_current_user)):
    """US + international indices with day change. Cached 60 seconds."""
    all_tickers = list(US_INDICES.keys()) + list(INTL_INDICES.keys())
    quotes = await market_data.get_quotes(all_tickers, ttl=60)

    us = [
        {
            "ticker": t,
            "name": US_INDICES[t],
            **quotes.get(t, {}),
        }
        for t in US_INDICES
    ]
    intl = [
        {
            "ticker": t,
            "name": INTL_INDICES[t],
            **quotes.get(t, {}),
        }
        for t in INTL_INDICES
    ]

    return {"us_indices": us, "international_indices": intl}


@router.get("/movers")
async def get_top_movers(_: User = Depends(get_current_user)):
    """Top gainers and losers from the S&P 500. Cached 5 minutes."""
    movers = await market_data.get_top_movers(ttl=300)
    return movers


@router.get("/info/{ticker}")
async def get_ticker_info(ticker: str, _: User = Depends(get_current_user)):
    """
    Detailed company information — description, sector, valuation, fundamentals.
    Cached 24 hours. Used by the ticker detail modal.
    """
    info = await market_data.get_ticker_info(ticker.upper())
    if info is None:
        return {"ticker": ticker.upper(), "error": "Info not available"}
    return info


@router.get("/quote/{ticker}")
async def get_single_quote(ticker: str, _: User = Depends(get_current_user)):
    """Live quote for a single ticker."""
    quotes = await market_data.get_quotes([ticker.upper()], ttl=60)
    quote = quotes.get(ticker.upper())
    if not quote:
        return {"ticker": ticker.upper(), "error": "Quote not available"}
    return {"ticker": ticker.upper(), **quote}


@router.get("/price/{ticker}")
async def get_price_on_date(
    ticker: str,
    on: date = Query(..., description="Date to look up (YYYY-MM-DD)"),
    _: User = Depends(get_current_user),
):
    """
    Returns the closing price for a ticker on a specific date.
    Used by the transaction editor to auto-fill prices.
    Falls back to the nearest available trading day.
    """
    price = await market_data.get_price_on_date(ticker.upper(), on)
    if price is None:
        return {"ticker": ticker.upper(), "date": on.isoformat(), "price": None}
    return {"ticker": ticker.upper(), "date": on.isoformat(), "price": price}


@router.get("/fundamentals/{ticker}")
async def get_dcf_fundamentals(ticker: str, _: User = Depends(get_current_user)):
    """
    DCF-relevant fundamentals: FCF, shares outstanding, net cash, growth, margins.
    Used by the DCF and Reverse DCF valuation tools.
    """
    data = await market_data.get_dcf_fundamentals(ticker.upper())
    if not data:
        return {"ticker": ticker.upper(), "error": "Fundamentals not available"}
    return data
