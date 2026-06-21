"""
Sentiment — real news-based sentiment scoring via VADER NLP.

Fetches recent news headlines from yfinance and scores them with
VADER (Valence Aware Dictionary and sEntiment Reasoner), a model
specifically tuned for financial/social media short text.

Returns compound score (-100..100), bullish/bearish breakdown,
article count (proxy for buzz), and per-headline scores.
"""
import asyncio
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, Holding, WatchlistItem
from app.services import market_data
from app.services.market_data import cache_get, cache_set

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sentiment")

_analyzer = SentimentIntensityAnalyzer()

SENTIMENT_CACHE_TTL = 4 * 3600  # 4 hours


def _score_articles(articles: list[dict]) -> dict:
    """Score a list of news articles and return aggregated sentiment."""
    if not articles:
        return {
            "overall_score": 0,
            "bullish_pct": 0,
            "bearish_pct": 0,
            "neutral_pct": 100,
            "article_count": 0,
            "headlines": [],
        }

    scored = []
    for a in articles:
        title = a.get("title", "")
        summary = a.get("summary", "")
        # Score title (weighted 2x) + summary combined
        text = f"{title}. {summary}" if summary else title
        vs = _analyzer.polarity_scores(text)
        compound = vs["compound"]
        if compound >= 0.05:
            label = "bullish"
        elif compound <= -0.05:
            label = "bearish"
        else:
            label = "neutral"
        scored.append({
            "title": title,
            "compound": round(compound, 3),
            "label": label,
            "published_at": a.get("published_at"),
            "source": a.get("source", ""),
            "url": a.get("url", ""),
        })

    compounds = [s["compound"] for s in scored]
    avg_compound = sum(compounds) / len(compounds)
    overall_score = round(avg_compound * 100, 1)  # scale to -100..100

    bullish = sum(1 for s in scored if s["label"] == "bullish")
    bearish = sum(1 for s in scored if s["label"] == "bearish")
    neutral = len(scored) - bullish - bearish

    return {
        "overall_score": overall_score,
        "bullish_pct": round(bullish / len(scored) * 100),
        "bearish_pct": round(bearish / len(scored) * 100),
        "neutral_pct": round(neutral / len(scored) * 100),
        "article_count": len(scored),
        "headlines": scored[:6],  # top 6 for the UI
    }


async def _get_sentiment_for_ticker(ticker: str) -> dict:
    """Fetch and score sentiment for a single ticker. Cached 4h."""
    cache_key = f"vela:sentiment:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    articles = await market_data.get_ticker_news(ticker, ttl=3600)
    result = _score_articles(articles)
    result["ticker"] = ticker

    await cache_set(cache_key, result, ttl=SENTIMENT_CACHE_TTL)
    return result


@router.get("/{ticker}")
async def get_ticker_sentiment(
    ticker: str,
    user: User = Depends(get_current_user),
):
    """Sentiment score for a single ticker based on recent news."""
    return await _get_sentiment_for_ticker(ticker.upper())


@router.get("")
async def get_portfolio_sentiment(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sentiment scores for all of the user's holdings + watchlist."""
    # Collect holdings
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

    # Collect watchlist
    wl_result = await db.execute(
        select(WatchlistItem.ticker).where(WatchlistItem.user_id == user.id)
    )
    tickers.update(row[0] for row in wl_result.all())

    if not tickers:
        return []

    results = await asyncio.gather(
        *[_get_sentiment_for_ticker(t) for t in tickers],
        return_exceptions=True,
    )

    output = []
    for ticker, res in zip(tickers, results):
        if isinstance(res, Exception):
            logger.warning("Sentiment failed for %s: %s", ticker, res)
            continue
        output.append(res)

    # Sort by absolute sentiment strength (most opinionated first)
    output.sort(key=lambda x: abs(x["overall_score"]), reverse=True)
    return output
