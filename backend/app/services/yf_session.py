"""
Browser-impersonating HTTP session for every yfinance call.

Why this exists
---------------
Yahoo fingerprints the TLS handshake. A stock `requests`/`urllib3` client is
recognisable as a bot and its **crumb** request is refused outright:

    GET https://query1.finance.yahoo.com/v1/test/getcrumb  ->  429 Too Many Requests

The crumb is required by every `quoteSummary`-backed surface, so without it
`Ticker.info`, management, insiders, fundamentals, options and the screener all
fail — and yfinance surfaces that as an *empty* result rather than an error,
which is why it stayed invisible for so long.

This is NOT rate limiting and NOT a datacenter-IP block. Measured from inside
the production Fly machine, same IP, same second:

    requests (default TLS)        -> 429
    curl_cffi impersonate=chrome  -> 200  crumb='QWgTEWe7v7r'

Passing a `curl_cffi` session that reproduces a real browser's TLS fingerprint
fixes it with no proxy, no API key and no added cost. `KO` went from
"Info not available" to 187 info keys and 18 option expiries on that machine.

Usage
-----
Never call `yf.Ticker(...)` directly — use `ticker()` below, or pass
`session=yf_session()` to `yf.download` / `yf.Tickers`. A bare call silently
loses every `.info`-backed field in production.

Threading
---------
Market data runs under `asyncio.to_thread`, so calls land on a pool of worker
threads. `curl_cffi.requests.Session` wraps a libcurl handle and is not safe to
share across threads, so one session is kept per thread rather than one global.
The pool is small and long-lived, so this stays a handful of sessions.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

import yfinance as yf

logger = logging.getLogger(__name__)

# Chrome's fingerprint is the most common on the wire and so the least
# remarkable. curl_cffi rotates its aliases between releases; "chrome" always
# resolves to the newest one it ships.
_IMPERSONATE = "chrome"

_local = threading.local()


def yf_session() -> Any:
    """The calling thread's impersonating session, created on first use.

    Falls back to None (yfinance's own default client) if curl_cffi is
    unavailable, so a missing optional dependency degrades to today's
    behaviour instead of taking market data down entirely.
    """
    sess = getattr(_local, "session", None)
    if sess is not None:
        return sess

    try:
        from curl_cffi import requests as curl_requests
    except ImportError:
        # Warn once per thread rather than on every call.
        if not getattr(_local, "warned", False):
            _local.warned = True
            logger.warning(
                "curl_cffi is not installed — Yahoo will refuse the crumb handshake "
                "and every .info-backed field will come back empty."
            )
        _local.session = None
        return None

    sess = curl_requests.Session(impersonate=_IMPERSONATE)
    _local.session = sess
    return sess


def ticker(symbol: str) -> yf.Ticker:
    """`yf.Ticker` bound to this thread's impersonating session."""
    return yf.Ticker(symbol, session=yf_session())


def tickers(symbols: str) -> yf.Tickers:
    """`yf.Tickers` bound to this thread's impersonating session."""
    return yf.Tickers(symbols, session=yf_session())


def download(*args: Any, **kwargs: Any) -> Any:
    """`yf.download` bound to this thread's impersonating session."""
    kwargs.setdefault("session", yf_session())
    return yf.download(*args, **kwargs)
