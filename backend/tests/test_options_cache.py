"""A failed options fetch must not be cached as "this ticker has no options".

`get_options_chain` answers a fetch failure with an empty chain — the right call,
since the Options tab can render "no options data" from it. Caching that answer
is not: the empty shape is indistinguishable from a security that genuinely has
no listed options, so a single upstream blip pinned "not loading" in front of
the user for the full 15-minute TTL, long after Yahoo recovered.

Same reasoning as `9a0dfdd` for insider data — serve what we have, cache only
what is real.
"""
import pytest

from app.core.cache import cache_delete, cache_get
from app.services import market_data

TICKER = "ZZTESTOPT"
CACHE_KEY = f"options:{TICKER}"


class _FakeChain:
    def __init__(self, calls, puts):
        self.calls = calls
        self.puts = puts


class _FakeFrame:
    """The slice of the pandas surface `_sync_options` actually touches."""

    def __init__(self, rows):
        self._rows = rows
        self.empty = not rows
        self.columns = list(rows[0].keys()) if rows else []

    def __getitem__(self, cols):
        return _FakeFrame([{c: r[c] for c in cols} for r in self._rows])

    def to_dict(self, orient="records"):
        return list(self._rows)


class _FakeTicker:
    options = ("2026-10-02",)

    class fast_info:  # noqa: N801 — mirrors yfinance's attribute name
        last_price = 100.0

    def option_chain(self, _expiry):
        row = {
            "strike": 100.0, "lastPrice": 5.0, "bid": 4.9, "ask": 5.1,
            "impliedVolatility": 0.3, "openInterest": 42, "volume": 7,
        }
        return _FakeChain(_FakeFrame([row]), _FakeFrame([row]))


@pytest.fixture
async def clean_cache():
    await cache_delete(CACHE_KEY)
    yield
    await cache_delete(CACHE_KEY)


async def test_a_failed_fetch_is_served_but_not_cached(monkeypatch, clean_cache):
    def _boom(_ticker):
        raise RuntimeError("Yahoo said no")

    monkeypatch.setattr(market_data._yfs, "ticker", _boom)

    result = await market_data.get_options_chain(TICKER)

    # Still answered, so the tab can say "no options data".
    assert result["expiries"] == []
    # But nothing pinned: the next request must be free to retry.
    assert await cache_get(CACHE_KEY) is None


async def test_the_next_request_retries_after_a_failure(monkeypatch, clean_cache):
    def _boom(_ticker):
        raise RuntimeError("Yahoo said no")

    monkeypatch.setattr(market_data._yfs, "ticker", _boom)
    assert (await market_data.get_options_chain(TICKER))["expiries"] == []

    # Upstream recovers. Without the fix this still served the cached blank
    # for 15 minutes.
    monkeypatch.setattr(market_data._yfs, "ticker", lambda _t: _FakeTicker())
    recovered = await market_data.get_options_chain(TICKER)

    assert recovered["expiries"] == ["2026-10-02"]
    assert recovered["chains"]["2026-10-02"]["calls"][0]["openInterest"] == 42


async def test_a_real_chain_is_still_cached(monkeypatch, clean_cache):
    monkeypatch.setattr(market_data._yfs, "ticker", lambda _t: _FakeTicker())

    await market_data.get_options_chain(TICKER)

    cached = await cache_get(CACHE_KEY)
    assert cached is not None
    assert cached["expiries"] == ["2026-10-02"]
    # The marker used to decide cacheability must never reach the client.
    assert "_failed" not in cached


async def test_the_failure_marker_is_not_served_to_the_client(monkeypatch, clean_cache):
    def _boom(_ticker):
        raise RuntimeError("Yahoo said no")

    monkeypatch.setattr(market_data._yfs, "ticker", _boom)

    result = await market_data.get_options_chain(TICKER)

    assert "_failed" not in result


class _NoExpiriesTicker:
    """`t.options` returns () with no exception — for an unknown symbol, and
    equally when Yahoo refuses the crumb handshake. The two are
    indistinguishable here, which is the whole problem."""

    options = ()

    class fast_info:  # noqa: N801
        last_price = 0.0


def _spy_on_cache(monkeypatch):
    calls = []

    async def _spy(key, value, ttl=60):
        calls.append({"key": key, "value": value, "ttl": ttl})

    monkeypatch.setattr(market_data, "cache_set", _spy)
    return calls


async def test_an_empty_chain_is_held_only_briefly(monkeypatch, clean_cache):
    """A silent refusal must not pin "no options" on a real ticker.

    yfinance answers a crumb refusal the same way it answers a nonsense symbol:
    an empty tuple, no exception. That is the failure mode `bd78e61` was about —
    empty rather than erroring, so it looks fine in tests. We cannot tell the
    two apart, so an empty chain gets a short TTL: a security that genuinely has
    no options costs one fetch a minute, and a refused real one recovers in a
    minute instead of a quarter of an hour.
    """
    monkeypatch.setattr(market_data._yfs, "ticker", lambda _t: _NoExpiriesTicker())
    calls = _spy_on_cache(monkeypatch)

    result = await market_data.get_options_chain(TICKER)

    assert result["expiries"] == []
    assert len(calls) == 1
    assert calls[0]["ttl"] == market_data.OPTIONS_EMPTY_TTL
    assert calls[0]["ttl"] < market_data.OPTIONS_TTL


async def test_a_populated_chain_keeps_the_full_ttl(monkeypatch, clean_cache):
    monkeypatch.setattr(market_data._yfs, "ticker", lambda _t: _FakeTicker())
    calls = _spy_on_cache(monkeypatch)

    await market_data.get_options_chain(TICKER)

    assert len(calls) == 1
    assert calls[0]["ttl"] == market_data.OPTIONS_TTL


async def test_a_raised_failure_is_still_never_cached(monkeypatch, clean_cache):
    """The short TTL is for empties we cannot explain; a raise we can."""
    def _boom(_ticker):
        raise RuntimeError("Yahoo said no")

    monkeypatch.setattr(market_data._yfs, "ticker", _boom)
    calls = _spy_on_cache(monkeypatch)

    await market_data.get_options_chain(TICKER)

    assert calls == []
