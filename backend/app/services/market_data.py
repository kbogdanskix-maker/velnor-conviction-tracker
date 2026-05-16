"""
Market data service — abstraction over yfinance + FMP.
All external calls are Redis-cached. This is the single source of truth
for price data throughout the application.
"""
import logging
from decimal import Decimal
from typing import Any
import asyncio
import yfinance as yf

from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)


async def get_quotes(tickers: list[str], ttl: int = 60) -> dict[str, dict]:
    """
    Fetch current quotes for a list of tickers.
    Returns a dict keyed by ticker with price, change, change_pct, etc.
    Results are Redis-cached with the given TTL (seconds).

    Falls back gracefully: missing tickers return an empty dict entry.
    """
    if not tickers:
        return {}

    # Try cache first, collect misses
    results: dict[str, dict] = {}
    misses: list[str] = []

    for ticker in tickers:
        cached = await cache_get(f"quote:{ticker}")
        if cached is not None:
            results[ticker] = cached
        else:
            misses.append(ticker)

    if misses:
        fresh = await _fetch_quotes_yfinance(misses)
        for ticker, data in fresh.items():
            results[ticker] = data
            await cache_set(f"quote:{ticker}", data, ttl=ttl)

    return results


async def _fetch_quotes_yfinance(tickers: list[str]) -> dict[str, dict]:
    """
    Fetch quotes from yfinance. Runs in a thread pool to avoid blocking the event loop.
    yfinance is synchronous — we use asyncio.to_thread to make it async-friendly.
    """
    def _sync_fetch(tickers: list[str]) -> dict[str, dict]:
        results = {}
        try:
            # yfinance batch download — official closing prices are more accurate
            # than fast_info for change calculations
            single = len(tickers) == 1
            data = yf.download(
                tickers,
                period="5d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )

            for ticker in tickers:
                try:
                    # Extract last 2 trading days from download data
                    if single:
                        ticker_data = data
                    else:
                        ticker_data = data[ticker] if ticker in data.columns.get_level_values(0) else None

                    price = None
                    prev_close = None
                    if ticker_data is not None and not ticker_data.empty:
                        closes = ticker_data["Close"].dropna()
                        if len(closes) >= 2:
                            price = round(float(closes.iloc[-1]), 4)
                            prev_close = round(float(closes.iloc[-2]), 4)
                        elif len(closes) == 1:
                            price = round(float(closes.iloc[-1]), 4)

                    # Fallback to fast_info if download didn't give us data
                    info = yf.Ticker(ticker).fast_info
                    if price is None:
                        price = round(float(info.last_price or 0), 4)
                    if prev_close is None:
                        prev_close = round(float(info.previous_close or 0), 4)

                    change = round(price - prev_close, 4)
                    change_pct = round((change / prev_close * 100) if prev_close else 0.0, 2)

                    results[ticker] = {
                        "price": price,
                        "prev_close": prev_close,
                        "change": change,
                        "change_pct": change_pct,
                        "volume": int(info.three_month_average_volume or 0),
                        "market_cap": float(info.market_cap or 0),
                        "currency": info.currency or "USD",
                    }
                except Exception as e:
                    logger.warning("Quote fetch failed for %s: %s", ticker, e)
                    results[ticker] = {}
        except Exception as e:
            logger.error("Batch yfinance fetch failed: %s", e)
            for ticker in tickers:
                results[ticker] = {}
        return results

    return await asyncio.to_thread(_sync_fetch, tickers)


async def get_historical_prices(
    ticker: str,
    period: str = "1y",
    interval: str = "1d",
) -> list[dict]:
    """
    Historical OHLCV for a ticker. Used for performance charts.
    Cached for 1 hour.
    """
    cache_key = f"history:{ticker}:{period}:{interval}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch():
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period=period, interval=interval, auto_adjust=True)
            rows = []
            for dt, row in hist.iterrows():
                rows.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": int(row["Volume"]),
                })
            return rows
        except Exception as e:
            logger.error("Historical fetch failed for %s: %s", ticker, e)
            return []

    data = await asyncio.to_thread(_sync_fetch)
    await cache_set(cache_key, data, ttl=3600)
    return data


async def get_price_on_date(ticker: str, target_date: "date") -> float | None:
    """
    Returns the closing price for a ticker on a given date.
    Falls back to the nearest prior trading day if the market was closed.
    """
    from datetime import date as date_type, timedelta

    cache_key = f"price:{ticker}:{target_date.isoformat()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch():
        try:
            t = yf.Ticker(ticker)
            # Fetch a small window around the target date to handle weekends/holidays
            start = target_date - timedelta(days=5)
            end = target_date + timedelta(days=1)
            hist = t.history(start=start.isoformat(), end=end.isoformat(), auto_adjust=True)
            if hist.empty:
                return None
            # Filter to rows on or before target_date, take the last one
            hist.index = hist.index.tz_localize(None)
            import pandas as pd
            mask = hist.index <= pd.Timestamp(target_date)
            valid = hist[mask]
            if valid.empty:
                return None
            return round(float(valid.iloc[-1]["Close"]), 4)
        except Exception as e:
            logger.error("Price on date fetch failed for %s on %s: %s", ticker, target_date, e)
            return None

    price = await asyncio.to_thread(_sync_fetch)
    if price is not None:
        await cache_set(cache_key, price, ttl=86400)  # cache for 24h — historical prices don't change
    return price


async def get_top_movers(ttl: int = 300) -> dict:
    """
    Returns top 10 gainers and losers from a set of large-cap tickers.
    Cached for 5 minutes by default.
    """
    cache_key = "markets:movers"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    # Representative large-cap universe
    universe = [
        "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO",
        "LLY", "JPM", "V", "MA", "UNH", "XOM", "PG", "HD", "COST", "ADBE",
        "CRM", "AMD", "NFLX", "ORCL", "QCOM", "TXN", "NOW", "INTU", "ISRG",
    ]
    quotes = await get_quotes(universe, ttl=ttl)

    sorted_by_change = sorted(
        [(ticker, data) for ticker, data in quotes.items() if data.get("change_pct") is not None],
        key=lambda x: x[1]["change_pct"],
    )

    result = {
        "gainers": [
            {"ticker": t, **d} for t, d in sorted_by_change[-10:][::-1]
        ],
        "losers": [
            {"ticker": t, **d} for t, d in sorted_by_change[:10]
        ],
    }
    await cache_set(cache_key, result, ttl=ttl)
    return result


def _epoch_to_iso(val: Any) -> str | None:
    """Convert a Unix epoch timestamp to ISO date string."""
    if val is None:
        return None
    try:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(int(val), tz=timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OSError):
        return None


async def get_ticker_info(ticker: str) -> dict[str, Any] | None:
    """
    Detailed company/fund information from yfinance.
    Includes description, sector, valuation, and key metrics.
    Cached 24 hours — fundamentals don't change intra-day.
    """
    cache_key = f"info:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch() -> dict[str, Any] | None:
        try:
            t = yf.Ticker(ticker)
            raw = t.info
            if not raw or not raw.get("longName"):
                return None

            def _f(val: Any) -> float | None:
                """Safely convert to float."""
                if val is None:
                    return None
                try:
                    return round(float(val), 4)
                except (TypeError, ValueError):
                    return None

            def _ratio(val: Any) -> float | None:
                """Convert yfinance dividend yield to ratio (0-1).
                yfinance returns percentage form (e.g. 0.42 = 0.42%,
                2.72 = 2.72%).  Always divide by 100 to get the ratio."""
                f = _f(val)
                if f is None:
                    return None
                # yfinance yields are always percentages — convert to ratio
                return round(f / 100, 4)

            return {
                "ticker": ticker,
                # Identity
                "name": raw.get("longName") or raw.get("shortName"),
                "sector": raw.get("sector"),
                "industry": raw.get("industry"),
                "website": raw.get("website"),
                "description": raw.get("longBusinessSummary"),
                "quote_type": raw.get("quoteType"),  # EQUITY, ETF, INDEX, etc.
                # Valuation
                "market_cap": _f(raw.get("marketCap")),
                "trailing_pe": _f(raw.get("trailingPE")),
                "forward_pe": _f(raw.get("forwardPE")),
                "beta": _f(raw.get("beta")),
                # Dividends — yfinance sometimes returns yield as pct
                # instead of ratio; normalise so it's always a ratio.
                # Sanity: cap at 20% — anything higher is bad data.
                "dividend_yield": (
                    lambda dy: dy if dy is None or dy <= 0.20 else None
                )(_ratio(raw.get("dividendYield"))),
                "dividend_rate": _f(raw.get("dividendRate")),  # annual $/share
                "payout_ratio": _f(raw.get("payoutRatio")),
                "ex_dividend_date": _epoch_to_iso(raw.get("exDividendDate")),
                "last_dividend_value": _f(raw.get("lastDividendValue")),
                "last_dividend_date": _epoch_to_iso(raw.get("lastDividendDate")),
                "five_year_avg_yield": (
                    round(_f(raw.get("fiveYearAvgDividendYield")) / 100, 4)
                    if _f(raw.get("fiveYearAvgDividendYield")) is not None
                    else None
                ),
                # Range & Volume
                "fifty_two_week_high": _f(raw.get("fiftyTwoWeekHigh")),
                "fifty_two_week_low": _f(raw.get("fiftyTwoWeekLow")),
                "average_volume": int(raw["averageVolume"]) if raw.get("averageVolume") else None,
                # Margins
                "gross_margins": _f(raw.get("grossMargins")),
                "operating_margins": _f(raw.get("operatingMargins")),
                "profit_margins": _f(raw.get("profitMargins")),
            }
        except Exception as e:
            logger.error("Ticker info fetch failed for %s: %s", ticker, e)
            return None

    info = await asyncio.to_thread(_sync_fetch)
    if info is not None:
        await cache_set(cache_key, info, ttl=86400)  # 24h cache
    return info


async def get_dcf_fundamentals(ticker: str) -> dict[str, Any] | None:
    """
    Fetch valuation-relevant fundamentals for DCF analysis.
    Returns FCF, shares outstanding, net cash, margins, growth, and price.
    Cached 24 hours.
    """
    cache_key = f"dcf:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch() -> dict[str, Any] | None:
        try:
            t = yf.Ticker(ticker)
            raw = t.info
            if not raw or not raw.get("longName"):
                return None

            def _safe(val: Any) -> float | None:
                if val is None:
                    return None
                try:
                    return float(val)
                except (TypeError, ValueError):
                    return None

            # Try to get FCF from cashflow statement
            fcf = None
            try:
                cf = t.cashflow
                if cf is not None and not cf.empty:
                    if "Free Cash Flow" in cf.index:
                        fcf = float(cf.loc["Free Cash Flow"].iloc[0])
                    elif "Operating Cash Flow" in cf.index and "Capital Expenditure" in cf.index:
                        ocf = float(cf.loc["Operating Cash Flow"].iloc[0])
                        capex = float(cf.loc["Capital Expenditure"].iloc[0])
                        fcf = ocf + capex  # capex is negative
            except Exception:
                pass

            # Revenue growth
            revenue_growth = _safe(raw.get("revenueGrowth"))
            earnings_growth = _safe(raw.get("earningsGrowth"))

            # Net cash = total cash - total debt
            total_cash = _safe(raw.get("totalCash"))
            total_debt = _safe(raw.get("totalDebt"))
            net_cash = None
            if total_cash is not None and total_debt is not None:
                net_cash = total_cash - total_debt

            shares = _safe(raw.get("sharesOutstanding"))
            price = _safe(raw.get("currentPrice")) or _safe(raw.get("regularMarketPrice"))

            result = {
                "ticker": ticker,
                "name": raw.get("longName") or raw.get("shortName"),
                "price": round(price, 2) if price else None,
                "shares_outstanding": round(shares / 1e6, 1) if shares else None,  # millions
                "market_cap": round(_safe(raw.get("marketCap")) / 1e6, 0) if _safe(raw.get("marketCap")) else None,  # millions
                "fcf": round(fcf / 1e6, 0) if fcf else None,  # millions
                "total_cash": round(total_cash / 1e6, 0) if total_cash else None,  # millions
                "total_debt": round(total_debt / 1e6, 0) if total_debt else None,  # millions
                "net_cash": round(net_cash / 1e6, 0) if net_cash else None,  # millions
                "revenue_growth": round(revenue_growth * 100, 1) if revenue_growth else None,  # percent
                "earnings_growth": round(earnings_growth * 100, 1) if earnings_growth else None,  # percent
                "profit_margins": round(_safe(raw.get("profitMargins")) * 100, 1) if _safe(raw.get("profitMargins")) else None,  # percent
                "operating_margins": round(_safe(raw.get("operatingMargins")) * 100, 1) if _safe(raw.get("operatingMargins")) else None,  # percent
                "trailing_pe": round(_safe(raw.get("trailingPE")), 1) if _safe(raw.get("trailingPE")) else None,
                "forward_pe": round(_safe(raw.get("forwardPE")), 1) if _safe(raw.get("forwardPE")) else None,
                "beta": round(_safe(raw.get("beta")), 2) if _safe(raw.get("beta")) else None,
            }
            return result
        except Exception as e:
            logger.error("DCF fundamentals fetch failed for %s: %s", ticker, e)
            return None

    data = await asyncio.to_thread(_sync_fetch)
    if data is not None:
        await cache_set(cache_key, data, ttl=86400)
    return data


async def search_tickers(query: str) -> list[dict]:
    """Ticker/company search via yfinance."""
    cache_key = f"search:{query.lower()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_search(q: str) -> list[dict]:
        try:
            results = yf.Search(q, max_results=10).quotes
            return [
                {
                    "ticker": r.get("symbol", ""),
                    "name": r.get("longname") or r.get("shortname", ""),
                    "exchange": r.get("exchange", ""),
                    "type": r.get("quoteType", ""),
                }
                for r in results
                if r.get("symbol")
            ]
        except Exception as e:
            logger.warning("Ticker search failed for '%s': %s", q, e)
            return []

    results = await asyncio.to_thread(_sync_search, query)
    await cache_set(cache_key, results, ttl=300)
    return results


async def get_ticker_news(ticker: str, ttl: int = 3600) -> list[dict]:
    """
    News articles for a ticker from yfinance.
    Cached 1 hour.  Returns up to 8 story-type articles.
    """
    cache_key = f"news:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch() -> list[dict]:
        try:
            t = yf.Ticker(ticker)
            raw = t.news or []
            items: list[dict] = []
            for article in raw:
                content = article.get("content", {})
                if content.get("contentType") != "STORY":
                    continue
                canonical = content.get("canonicalUrl") or {}
                provider = content.get("provider") or {}
                thumb = content.get("thumbnail") or {}
                items.append({
                    "title": content.get("title", ""),
                    "summary": content.get("summary", ""),
                    "published_at": content.get("pubDate"),
                    "source": provider.get("displayName", "Unknown"),
                    "url": canonical.get("url", ""),
                    "thumbnail": thumb.get("originalUrl"),
                    "ticker": ticker,
                })
                if len(items) >= 8:
                    break
            return items
        except Exception as e:
            logger.warning("News fetch failed for %s: %s", ticker, e)
            return []

    news = await asyncio.to_thread(_sync_fetch)
    await cache_set(cache_key, news, ttl=ttl)
    return news


async def get_correlation_data(tickers: list[str], period: str = "1y") -> dict:
    """
    Compute pairwise correlation matrix from historical daily returns.
    Returns {tickers: [...], matrix: [[...]]}. Cached 6 hours.
    """
    if len(tickers) < 2:
        return {"tickers": tickers, "matrix": [[1.0]] if tickers else []}

    sorted_tickers = sorted(set(t.upper() for t in tickers))
    cache_key = f"corr:{','.join(sorted_tickers)}:{period}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_compute() -> dict:
        import math
        try:
            data = yf.download(sorted_tickers, period=period, auto_adjust=True, progress=False)
            if data.empty:
                return {"tickers": sorted_tickers, "matrix": []}

            # Get close prices
            if len(sorted_tickers) == 1:
                closes = data[["Close"]].rename(columns={"Close": sorted_tickers[0]})
            else:
                closes = data["Close"]

            # Drop tickers with insufficient data (< 30 trading days)
            valid_tickers = [t for t in sorted_tickers if t in closes.columns and closes[t].dropna().shape[0] >= 30]
            if len(valid_tickers) < 2:
                return {"tickers": valid_tickers, "matrix": [[1.0]] * len(valid_tickers)}

            # Compute daily returns and correlation
            returns = closes[valid_tickers].pct_change().dropna()
            corr = returns.corr()

            # Convert to list[list[float]], replacing NaN with 0
            matrix = []
            for t1 in valid_tickers:
                row = []
                for t2 in valid_tickers:
                    val = float(corr.loc[t1, t2])
                    row.append(round(val, 3) if not math.isnan(val) else 0.0)
                matrix.append(row)

            return {"tickers": valid_tickers, "matrix": matrix}
        except Exception as e:
            logger.error("Correlation compute failed: %s", e)
            return {"tickers": sorted_tickers, "matrix": []}

    result = await asyncio.to_thread(_sync_compute)
    if result.get("matrix"):
        await cache_set(cache_key, result, ttl=21600)  # 6h cache
    return result


async def get_options_chain(ticker: str) -> dict:
    """
    Options chain from yfinance.
    Returns calls and puts for the nearest expiry dates.
    Cached 15 minutes.
    """
    cache_key = f"options:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_options(ticker: str) -> dict:
        try:
            t = yf.Ticker(ticker)
            expiries = list(t.options[:4])  # nearest 4 expiry dates
            chain_data = {}
            want_cols = ["strike", "lastPrice", "bid", "ask", "impliedVolatility", "openInterest", "volume"]
            for exp in expiries:
                chain = t.option_chain(exp)
                def _extract(df):
                    if df.empty:
                        return []
                    cols = [c for c in want_cols if c in df.columns]
                    rows = df[cols].to_dict(orient="records")
                    # Replace NaN with None for JSON
                    import math
                    for r in rows:
                        for k, v in r.items():
                            if isinstance(v, float) and math.isnan(v):
                                r[k] = None
                    return rows
                chain_data[exp] = {
                    "calls": _extract(chain.calls),
                    "puts": _extract(chain.puts),
                }
            # Also include current price for context
            try:
                price = float(t.fast_info.last_price or 0)
            except Exception:
                price = 0
            return {"ticker": ticker, "expiries": expiries, "chains": chain_data, "currentPrice": price}
        except Exception as e:
            logger.error("Options chain fetch failed for %s: %s", ticker, e)
            return {"ticker": ticker, "expiries": [], "chains": {}, "currentPrice": 0}

    result = await asyncio.to_thread(_sync_options, ticker)
    await cache_set(cache_key, result, ttl=900)
    return result
