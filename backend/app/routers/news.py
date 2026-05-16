"""
News — contextual news feed from yfinance.
Aggregates news for user's portfolio holdings + watchlist.
"""
import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, Holding, WatchlistItem
from app.services import market_data

router = APIRouter(prefix="/news")


@router.get("")
async def get_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Combined news feed for user's holdings + watchlist tickers."""
    # Collect tickers from holdings
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()

    tickers: set[str] = set()
    if portfolio:
        holdings_result = await db.execute(
            select(Holding.ticker).where(Holding.portfolio_id == portfolio.id)
        )
        tickers.update(row[0] for row in holdings_result.all())

    # Collect tickers from watchlist
    wl_result = await db.execute(
        select(WatchlistItem.ticker).where(WatchlistItem.user_id == user.id)
    )
    tickers.update(row[0] for row in wl_result.all())

    if not tickers:
        return []

    # Fetch news for all tickers in parallel
    tasks = {t: market_data.get_ticker_news(t) for t in tickers}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    all_articles = []
    for ticker, articles in zip(tasks.keys(), results):
        if isinstance(articles, Exception) or not articles:
            continue
        all_articles.extend(articles)

    # Deduplicate by URL — merge tickers for same article
    seen: dict[str, dict] = {}
    for article in all_articles:
        url = article["url"]
        if url in seen:
            if article["ticker"] not in seen[url]["tickers"]:
                seen[url]["tickers"].append(article["ticker"])
        else:
            seen[url] = {**article, "tickers": [article["ticker"]]}
            del seen[url]["ticker"]

    # Sort by date descending
    feed = sorted(
        seen.values(),
        key=lambda a: a.get("published_at") or "",
        reverse=True,
    )
    return feed


@router.get("/{ticker}")
async def get_ticker_news(
    ticker: str,
    _: User = Depends(get_current_user),
):
    """News for a single ticker."""
    articles = await market_data.get_ticker_news(ticker.upper())
    # Add tickers array for frontend consistency
    return [
        {**a, "tickers": [a["ticker"]]}
        for a in articles
        if "ticker" in a
    ]
