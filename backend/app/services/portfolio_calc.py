"""
Portfolio calculation service.
All financial logic lives here — no computation in the API layer.

Key functions:
- recompute_holdings()     → weighted average cost basis per ticker
- compute_realized_pnl()   → FIFO matching of buys and sells
- enrich_holdings_with_quotes() → attach live prices to holdings
- compute_twr()            → time-weighted return vs benchmark
- compute_risk_metrics()   → Sharpe ratio, volatility, max drawdown, beta
"""
import uuid
import math
import logging
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.db import Transaction, Holding, PortfolioSnapshot

logger = logging.getLogger(__name__)

ZERO = Decimal("0")
PENNY = Decimal("0.0001")


# ── Holdings Recomputation ────────────────────────────────────────────────────

async def recompute_holdings(portfolio_id: uuid.UUID, db: AsyncSession) -> None:
    """
    Recompute the materialised holdings table from raw transactions.
    Called after every transaction add/delete.

    Uses weighted average cost basis (not FIFO) for the holdings table.
    FIFO is used only for realized P&L calculation.
    """
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.portfolio_id == portfolio_id,
            Transaction.transaction_type.in_(["buy", "sell"]),
        )
        .order_by(Transaction.executed_at)
    )
    transactions = result.scalars().all()

    # Aggregate by ticker
    position: dict[str, dict] = {}  # ticker → {qty, total_cost, currency, asset_type}

    for tx in transactions:
        ticker = tx.ticker
        if ticker not in position:
            position[ticker] = {
                "quantity": ZERO,
                "total_cost": ZERO,
                "currency": tx.currency,
                "asset_type": tx.asset_type,
            }

        pos = position[ticker]
        qty = Decimal(str(tx.quantity))
        price = Decimal(str(tx.price))
        fees = Decimal(str(tx.fees))
        fx_rate = Decimal(str(tx.fx_rate))
        cost_in_base = (price * qty + fees) * fx_rate

        if tx.transaction_type == "buy":
            pos["quantity"] += qty
            pos["total_cost"] += cost_in_base
        elif tx.transaction_type == "sell":
            if pos["quantity"] > ZERO:
                # Reduce cost proportionally
                if pos["quantity"] >= qty:
                    cost_per_unit = pos["total_cost"] / pos["quantity"]
                    pos["total_cost"] -= cost_per_unit * qty
                    pos["quantity"] -= qty
                else:
                    # Oversell — clamp (shouldn't happen in normal use)
                    pos["quantity"] = ZERO
                    pos["total_cost"] = ZERO

    # Delete existing holdings for this portfolio, re-insert
    await db.execute(
        delete(Holding).where(Holding.portfolio_id == portfolio_id)
    )

    for ticker, pos in position.items():
        qty = pos["quantity"].quantize(PENNY, rounding=ROUND_HALF_UP)
        if qty <= ZERO:
            continue  # fully closed position — don't store

        avg_cost = (pos["total_cost"] / qty).quantize(PENNY, rounding=ROUND_HALF_UP) if qty > ZERO else ZERO
        holding = Holding(
            portfolio_id=portfolio_id,
            ticker=ticker,
            asset_type=pos["asset_type"],
            quantity=qty,
            avg_cost_basis=avg_cost,
            total_cost=pos["total_cost"].quantize(PENNY, rounding=ROUND_HALF_UP),
            currency=pos["currency"],
        )
        db.add(holding)


# ── Live Enrichment ───────────────────────────────────────────────────────────

def enrich_holdings_with_quotes(
    holdings: list[Holding],
    quotes: dict[str, dict],
) -> tuple[list[dict], dict]:
    """
    Attaches live price data to each holding.
    Returns (enriched_holdings, aggregate_totals).
    """
    enriched = []
    total_value = ZERO
    total_cost = ZERO
    total_day_change = ZERO

    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = Decimal(str(q.get("price", 0) or 0))
        prev_close = Decimal(str(q.get("prev_close", 0) or 0))

        market_value = (price * h.quantity).quantize(PENNY)
        unrealized_pnl = (market_value - h.total_cost).quantize(PENNY)
        unrealized_pnl_pct = (
            (unrealized_pnl / h.total_cost * 100).quantize(Decimal("0.01"))
            if h.total_cost > ZERO else ZERO
        )
        day_change = ((price - prev_close) * h.quantity).quantize(PENNY)
        day_change_pct = (
            ((price - prev_close) / prev_close * 100).quantize(Decimal("0.01"))
            if prev_close > ZERO else ZERO
        )

        total_value += market_value
        total_cost += h.total_cost
        total_day_change += day_change

        enriched.append({
            "ticker": h.ticker,
            "asset_type": h.asset_type,
            "quantity": h.quantity,
            "avg_cost_basis": h.avg_cost_basis,
            "total_cost": h.total_cost,
            "currency": h.currency,
            "current_price": price,
            "market_value": market_value,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_pct": unrealized_pnl_pct,
            "day_change": day_change,
            "day_change_pct": day_change_pct,
        })

    unrealized_pnl_total = total_value - total_cost
    unrealized_pnl_pct_total = (
        (unrealized_pnl_total / total_cost * 100).quantize(Decimal("0.01"))
        if total_cost > ZERO else ZERO
    )
    day_change_pct_total = (
        (total_day_change / (total_value - total_day_change) * 100).quantize(Decimal("0.01"))
        if (total_value - total_day_change) > ZERO else ZERO
    )

    totals = {
        "total_value": total_value.quantize(PENNY),
        "total_cost": total_cost.quantize(PENNY),
        "unrealized_pnl": unrealized_pnl_total.quantize(PENNY),
        "unrealized_pnl_pct": unrealized_pnl_pct_total,
        "day_change": total_day_change.quantize(PENNY),
        "day_change_pct": day_change_pct_total,
    }

    return enriched, totals


# ── Realized P&L (FIFO) ───────────────────────────────────────────────────────

async def compute_realized_pnl(
    portfolio_id: uuid.UUID,
    db: AsyncSession,
) -> Decimal:
    """
    Computes total realized P&L using FIFO lot matching.
    For each sell transaction, matches against the earliest buy lots.
    Returns total realized gain/loss in the portfolio's base currency.
    """
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.portfolio_id == portfolio_id,
            Transaction.transaction_type.in_(["buy", "sell"]),
        )
        .order_by(Transaction.executed_at, Transaction.created_at)
    )
    transactions = result.scalars().all()

    # FIFO lots per ticker: list of (qty, cost_per_unit_in_base)
    lots: dict[str, list[list[Decimal]]] = defaultdict(list)
    realized_pnl = ZERO

    for tx in transactions:
        if tx.transaction_type == "buy":
            cost_per_unit = (tx.price * tx.fx_rate + tx.fees * tx.fx_rate / tx.quantity).quantize(PENNY)
            lots[tx.ticker].append([tx.quantity, cost_per_unit])

        elif tx.transaction_type == "sell":
            sell_qty = tx.quantity
            sell_price_base = tx.price * tx.fx_rate - tx.fees * tx.fx_rate / tx.quantity
            ticker_lots = lots[tx.ticker]

            while sell_qty > ZERO and ticker_lots:
                lot_qty, lot_cost = ticker_lots[0]

                if lot_qty <= sell_qty:
                    # Consume this lot entirely
                    gain = (sell_price_base - lot_cost) * lot_qty
                    realized_pnl += gain
                    sell_qty -= lot_qty
                    ticker_lots.pop(0)
                else:
                    # Partial consumption
                    gain = (sell_price_base - lot_cost) * sell_qty
                    realized_pnl += gain
                    ticker_lots[0][0] -= sell_qty
                    sell_qty = ZERO

    return realized_pnl.quantize(PENNY)


# ── Time-Weighted Return ──────────────────────────────────────────────────────

async def compute_twr(
    portfolio_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Computes time-weighted return (TWR) from daily portfolio snapshots.
    TWR eliminates the distortion of cash flows (deposits/withdrawals).
    Returns daily TWR as a percentage and comparison vs S&P 500.

    Formula:
        TWR = product of (1 + sub-period return) for each day - 1
        Sub-period return = (end_value - begin_value) / begin_value
    """
    result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.portfolio_id == portfolio_id)
        .order_by(PortfolioSnapshot.date)
    )
    snapshots = result.scalars().all()

    if len(snapshots) < 2:
        return {"twr": ZERO, "snapshots": []}

    twr_factor = Decimal("1")
    series = []

    for i in range(1, len(snapshots)):
        prev = snapshots[i - 1]
        curr = snapshots[i]

        begin_value = prev.total_value
        end_value = curr.total_value

        if begin_value > ZERO:
            sub_period_return = (end_value - begin_value) / begin_value
            twr_factor *= (1 + sub_period_return)
            series.append({
                "date": curr.date.isoformat(),
                "value": float(end_value),
                "twr_pct": float((twr_factor - 1) * 100),
            })

    twr_pct = (twr_factor - 1) * 100
    return {
        "twr": twr_pct.quantize(Decimal("0.01")),
        "snapshots": series,
    }


# ── Portfolio Risk Metrics ───────────────────────────────────────────────────

RISK_FREE_RATE = 0.05  # ~5% annualized (T-bill proxy)
TRADING_DAYS = 252


async def compute_risk_metrics(
    holdings: list[dict],
    period: str = "1y",
) -> dict[str, Any]:
    """
    Computes portfolio-level risk metrics from historical price data.

    holdings: list of dicts with 'ticker' and 'market_value' keys
    Returns: sharpe_ratio, annualized_volatility, max_drawdown, beta, annualized_return

    Uses allocation-weighted daily returns across all holdings.
    """
    from app.services.market_data import get_historical_prices

    if not holdings:
        return _empty_risk()

    total_value = sum(h["market_value"] for h in holdings if h.get("market_value"))
    if total_value <= 0:
        return _empty_risk()

    # Fetch historical prices for all holdings + SPY (benchmark)
    tickers = [h["ticker"] for h in holdings if h.get("market_value", 0) > 0]
    weights = {
        h["ticker"]: h["market_value"] / total_value
        for h in holdings if h.get("market_value", 0) > 0
    }

    import asyncio
    tasks = {t: get_historical_prices(t, period=period) for t in tickers}
    tasks["^GSPC"] = get_historical_prices("^GSPC", period=period)

    # Tolerate per-ticker fetch failures (a single yfinance rate-limit/network
    # error must not 500 the whole endpoint). Failed tickers degrade to empty
    # history, which the guards below handle gracefully (_empty_risk fallback).
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    history = {
        t: (r if isinstance(r, list) else [])
        for t, r in zip(tasks.keys(), results)
    }

    # Build daily returns per ticker
    ticker_returns: dict[str, dict[str, float]] = {}
    for ticker, rows in history.items():
        if len(rows) < 2:
            continue
        returns = {}
        for i in range(1, len(rows)):
            prev_close = rows[i - 1]["close"]
            curr_close = rows[i]["close"]
            if prev_close > 0:
                returns[rows[i]["date"]] = (curr_close - prev_close) / prev_close
        ticker_returns[ticker] = returns

    # Find common dates across all holdings
    if not ticker_returns or "^GSPC" not in ticker_returns:
        return _empty_risk()

    benchmark_returns = ticker_returns.pop("^GSPC")
    common_dates = set(benchmark_returns.keys())
    for t in tickers:
        if t in ticker_returns:
            common_dates &= set(ticker_returns[t].keys())

    common_dates = sorted(common_dates)
    if len(common_dates) < 30:
        return _empty_risk()

    # Portfolio daily returns (allocation-weighted)
    port_daily = []
    bench_daily = []
    for date in common_dates:
        port_ret = sum(
            weights.get(t, 0) * ticker_returns[t].get(date, 0)
            for t in tickers if t in ticker_returns
        )
        port_daily.append(port_ret)
        bench_daily.append(benchmark_returns[date])

    n = len(port_daily)

    # Annualized return
    cumulative = 1.0
    for r in port_daily:
        cumulative *= (1 + r)
    annualized_return = (cumulative ** (TRADING_DAYS / n) - 1) if n > 0 else 0

    # Annualized volatility
    mean_daily = sum(port_daily) / n
    variance = sum((r - mean_daily) ** 2 for r in port_daily) / (n - 1)
    daily_vol = math.sqrt(variance)
    annualized_vol = daily_vol * math.sqrt(TRADING_DAYS)

    # Sharpe ratio
    sharpe = (annualized_return - RISK_FREE_RATE) / annualized_vol if annualized_vol > 0 else 0

    # Max drawdown
    cumulative_values = []
    cum = 1.0
    for r in port_daily:
        cum *= (1 + r)
        cumulative_values.append(cum)

    peak = cumulative_values[0]
    max_dd = 0.0
    for v in cumulative_values:
        if v > peak:
            peak = v
        dd = (peak - v) / peak
        if dd > max_dd:
            max_dd = dd

    # Beta (covariance with benchmark / variance of benchmark)
    bench_mean = sum(bench_daily) / n
    covariance = sum(
        (port_daily[i] - mean_daily) * (bench_daily[i] - bench_mean)
        for i in range(n)
    ) / (n - 1)
    bench_variance = sum((r - bench_mean) ** 2 for r in bench_daily) / (n - 1)
    beta = covariance / bench_variance if bench_variance > 0 else 1.0

    return {
        "sharpe_ratio": round(sharpe, 2),
        "annualized_volatility": round(annualized_vol * 100, 1),  # as percentage
        "max_drawdown": round(max_dd * 100, 1),  # as percentage
        "beta": round(beta, 2),
        "annualized_return": round(annualized_return * 100, 1),  # as percentage
        "data_points": n,
    }


def _empty_risk() -> dict[str, Any]:
    return {
        "sharpe_ratio": None,
        "annualized_volatility": None,
        "max_drawdown": None,
        "beta": None,
        "annualized_return": None,
        "data_points": 0,
    }
