"""
Macro data service — FRED API + Fed minutes RSS.
All series are cached daily in Redis.
"""
import asyncio
import logging
from datetime import date, datetime
from typing import Optional
import pandas as pd
import feedparser
from fredapi import Fred
from app.config import settings
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

# Series that are index levels — need YoY % change calculation
YOY_SERIES = {"CPIAUCSL", "CPILFESL", "PCEPI"}

# FRED series IDs and their display metadata
FRED_SERIES: dict[str, dict] = {
    # Bond yields
    "DGS10": {
        "name": "10-Year Treasury Yield",
        "unit": "%",
        "group": "yields",
        "context": "Rising 10Y yields compress growth stock multiples (higher discount rate). Watch for impact on long-duration equities.",
    },
    "DGS2": {
        "name": "2-Year Treasury Yield",
        "unit": "%",
        "group": "yields",
        "context": "Sensitive to near-term Fed policy expectations. 2Y > 10Y (inversion) has historically preceded recessions.",
    },
    "T10Y2Y": {
        "name": "10Y–2Y Yield Spread",
        "unit": "%",
        "group": "yields",
        "context": "Negative = inverted yield curve. A sustained inversion has preceded every US recession since 1955.",
    },
    "DGS3MO": {
        "name": "3-Month T-Bill Yield",
        "unit": "%",
        "group": "yields",
        "context": "Used as the risk-free rate in Sharpe ratio and DCF calculations.",
    },
    # Inflation
    "CPIAUCSL": {
        "name": "CPI (All Items, YoY %)",
        "unit": "% YoY",
        "group": "inflation",
        "context": "Headline inflation. High CPI forces the Fed to maintain restrictive policy, pressuring equity valuations.",
    },
    "CPILFESL": {
        "name": "Core CPI (ex Food & Energy, YoY %)",
        "unit": "% YoY",
        "group": "inflation",
        "context": "Fed's preferred short-term inflation gauge. Strips out volatile components for a cleaner trend signal.",
    },
    "PCEPI": {
        "name": "PCE Price Index (YoY %)",
        "unit": "% YoY",
        "group": "inflation",
        "context": "The Fed's official target measure (2% target). Below 2% supports rate cuts; above sustains higher-for-longer rates.",
    },
    # Fed / Policy
    "FEDFUNDS": {
        "name": "Fed Funds Rate",
        "unit": "%",
        "group": "fed",
        "context": "The policy rate set by the FOMC. Directly impacts borrowing costs, mortgage rates, and equity discount rates.",
    },
    "UNRATE": {
        "name": "Unemployment Rate",
        "unit": "%",
        "group": "fed",
        "context": "Fed's dual mandate: price stability + maximum employment. Rising unemployment may trigger rate cuts.",
    },
}

FED_MINUTES_RSS = "https://www.federalreserve.gov/feeds/press_all.xml"


async def get_macro_dashboard() -> dict:
    """
    Returns all macro series grouped by category.
    Data is cached daily in Redis.
    """
    cache_key = "macro:dashboard"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    # Fetch all FRED series concurrently
    series_data = await asyncio.to_thread(_fetch_all_fred_series)

    # Group by category
    groups: dict[str, list] = {"yields": [], "inflation": [], "fed": []}

    for series_id, meta in FRED_SERIES.items():
        value, as_of_date = series_data.get(series_id, (None, None))
        groups[meta["group"]].append({
            "series_id": series_id,
            "name": meta["name"],
            "value": value,
            "date": as_of_date,
            "unit": meta["unit"],
            "context": meta["context"],
        })

    result = {
        "yields": groups["yields"],
        "inflation": groups["inflation"],
        "fed": groups["fed"],
        "updated_at": datetime.utcnow().isoformat(),
    }

    # Cache for 6 hours (FRED data updates at most daily)
    await cache_set(cache_key, result, ttl=21600)
    return result


def _fetch_all_fred_series() -> dict[str, tuple[Optional[float], Optional[str]]]:
    """
    Synchronously fetches all FRED series (runs in thread pool).
    Returns dict: series_id → (value, date_string)
    """
    try:
        fred = Fred(api_key=settings.FRED_API_KEY)
        results = {}
        for series_id in FRED_SERIES:
            try:
                series = fred.get_series(series_id, observation_start="2020-01-01")
                if series is not None and not series.empty:
                    clean = series.dropna()
                    latest = float(clean.iloc[-1])
                    latest_date = str(clean.index[-1].date())

                    if series_id in YOY_SERIES:
                        # Index level → compute YoY % change
                        # Find the value ~12 months ago
                        target_date = clean.index[-1] - pd.DateOffset(years=1)
                        # Get nearest value at or before target_date
                        past = clean.loc[:target_date]
                        if not past.empty:
                            year_ago = float(past.iloc[-1])
                            if year_ago > 0:
                                yoy_pct = round((latest - year_ago) / year_ago * 100, 1)
                                results[series_id] = (yoy_pct, latest_date)
                            else:
                                results[series_id] = (None, latest_date)
                        else:
                            results[series_id] = (None, latest_date)
                    else:
                        results[series_id] = (round(latest, 3), latest_date)
                else:
                    results[series_id] = (None, None)
            except Exception as e:
                logger.warning("FRED fetch failed for %s: %s", series_id, e)
                results[series_id] = (None, None)
        return results
    except Exception as e:
        logger.error("FRED client init failed: %s", e)
        return {}


async def get_fed_minutes() -> dict:
    """
    Fetches the latest Fed minutes/press releases from the official RSS feed.
    Returns the 5 most recent items. Cached 1 hour.
    """
    cache_key = "macro:fed_minutes"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch():
        try:
            feed = feedparser.parse(FED_MINUTES_RSS)
            items = []
            for entry in feed.entries[:10]:
                title = entry.get("title", "")
                # Filter for minutes, statements, and FOMC-related releases
                if any(kw in title.lower() for kw in ["minutes", "fomc", "monetary policy", "federal reserve"]):
                    items.append({
                        "title": title,
                        "url": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "summary": entry.get("summary", "")[:300] if entry.get("summary") else None,
                    })
                if len(items) >= 5:
                    break
            return {"items": items}
        except Exception as e:
            logger.error("Fed minutes RSS fetch failed: %s", e)
            return {"items": []}

    result = await asyncio.to_thread(_sync_fetch)
    await cache_set(cache_key, result, ttl=3600)
    return result
