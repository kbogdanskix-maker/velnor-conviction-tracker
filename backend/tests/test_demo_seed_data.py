from datetime import datetime, timezone
from decimal import Decimal

from app.services.demo_seed_data import (
    SEED_JOURNAL,
    SEED_THESES,
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)


def test_has_enough_tickers_to_look_populated():
    """Seven bought, one of which (NKE) is closed out, leaving six open."""
    buys = {t.ticker for t in SEED_TRANSACTIONS if t.transaction_type == "buy"}
    assert len(buys) >= 7


def test_has_a_fully_closed_position():
    """Closed & Lessons and Calibration are both empty without one."""
    sells = [t for t in SEED_TRANSACTIONS if t.transaction_type == "sell"]
    assert sells, "need at least one sell"
    for sell in sells:
        bought = sum(
            t.quantity
            for t in SEED_TRANSACTIONS
            if t.ticker == sell.ticker and t.transaction_type == "buy"
        )
        assert bought == sell.quantity, f"{sell.ticker} must be fully closed"


def test_transactions_span_at_least_a_year():
    """Flat cost basis makes returns and the Journey timeline meaningless."""
    dates = [t.executed_at for t in SEED_TRANSACTIONS]
    assert (max(dates) - min(dates)).days >= 365


def test_all_transaction_dates_are_in_the_past():
    now = datetime.now(timezone.utc)
    assert all(t.executed_at < now for t in SEED_TRANSACTIONS)


def test_conviction_moves_over_time_for_some_ticker():
    """A flat conviction line makes the Journey map pointless."""
    by_ticker: dict[str, list[int]] = {}
    for e in SEED_JOURNAL:
        by_ticker.setdefault(e.ticker, []).append(e.conviction)
    assert any(len(set(v)) > 1 for v in by_ticker.values())


def test_conviction_values_are_in_range():
    assert all(1 <= e.conviction <= 5 for e in SEED_JOURNAL)


def test_at_least_one_thesis_diverged():
    """Spec section 3: a uniformly green Journey map demonstrates nothing."""
    assert any(t.diverged for t in SEED_THESES)


def test_theses_have_multiple_entries():
    assert all(len(t.entries) >= 2 for t in SEED_THESES)


def test_every_thesis_ticker_is_held_or_was_held():
    traded = {t.ticker for t in SEED_TRANSACTIONS}
    assert all(t.ticker in traded for t in SEED_THESES)


def test_watchlist_is_not_empty():
    assert len(SEED_WATCHLIST) >= 3


def test_prices_are_decimals_not_floats():
    """Numeric columns; floats introduce representation drift in cost basis."""
    assert all(isinstance(t.price, Decimal) for t in SEED_TRANSACTIONS)
