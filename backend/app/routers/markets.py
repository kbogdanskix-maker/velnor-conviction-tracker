"""
Markets page — US indices, international indices, top movers.
All data from yfinance, cached aggressively.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from app.dependencies import get_current_user
from app.models.db import User
from app.services import market_data
from app.core.tier import require_tier, Tier

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


@router.get("/info/bulk")
async def get_ticker_info_bulk(tickers: str, _: User = Depends(get_current_user)):
    """
    Batch fetch fundamentals for multiple tickers.
    ?tickers=AAPL,TSLA,MSFT — returns dict keyed by ticker.
    Each value merges info (fundamentals) + live quote (price/change).
    """
    import asyncio as _asyncio
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:10]
    info_tasks = [market_data.get_ticker_info(t) for t in ticker_list]
    # Tolerate per-ticker fetch failures so one bad ticker doesn't 500 the batch.
    infos = await _asyncio.gather(*info_tasks, return_exceptions=True)
    infos = [i if not isinstance(i, Exception) else {} for i in infos]
    quotes = await market_data.get_quotes(ticker_list, ttl=60)

    result = {}
    for ticker, info in zip(ticker_list, infos):
        q = quotes.get(ticker, {})
        if info:
            result[ticker] = {**info, **q}
        else:
            result[ticker] = {"ticker": ticker, **q}
    return result


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


@router.get("/financials/{ticker}")
async def get_financials(
    ticker: str,
    _tier: None = Depends(require_tier(Tier.NAVIGATOR)),
    _: User = Depends(get_current_user),
):
    """
    Multi-year income statement, balance sheet, and cash flow.
    Navigator tier. Factual filing data only.
    503 = upstream temporarily unavailable (retry). 200 with error=not_covered
    = the source genuinely doesn't publish statements for this security.
    """
    try:
        data = await market_data.get_financials(ticker.upper())
    except market_data.MarketDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail=f"Statement data for {ticker.upper()} couldn't be loaded right now — the source is likely rate-limiting. Try again shortly.",
        )
    if not data:
        return {
            "ticker": ticker.upper(),
            "error": "not_covered",
            "detail": "Financial statements are not reported by the source for this security (typical for ETFs, indices, and some ADRs).",
        }
    return data


@router.get("/management/{ticker}")
async def get_management(
    ticker: str,
    _tier: None = Depends(require_tier(Tier.NAVIGATOR)),
    _: User = Depends(get_current_user),
):
    """
    Company management & governance: officers, governance risk scores,
    insider/institutional ownership. Navigator tier. Factual only.
    503 = upstream temporarily unavailable (retry).
    """
    try:
        data = await market_data.get_company_management(ticker.upper())
    except market_data.MarketDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail=f"Management data for {ticker.upper()} couldn't be loaded right now — the source is likely rate-limiting. Try again shortly.",
        )
    if not data:
        return {"ticker": ticker.upper(), "error": "not_covered"}
    return data


@router.get("/insiders/{ticker}")
async def get_insiders(
    ticker: str,
    _tier: None = Depends(require_tier(Tier.NAVIGATOR)),
    _: User = Depends(get_current_user),
):
    """
    Insider trading activity from SEC Form 4 filings: 6-month buy/sell
    summary plus recent transactions. Navigator tier. Factual only.
    503 = upstream temporarily unavailable (retry). A 200 with empty
    transactions means the company genuinely has no recent Form 4 filings.
    """
    try:
        data = await market_data.get_insider_activity(ticker.upper())
    except market_data.MarketDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail=f"Insider data for {ticker.upper()} couldn't be loaded right now — the source is likely rate-limiting. Try again shortly.",
        )
    if not data:
        return {"ticker": ticker.upper(), "error": "not_covered"}
    return data
