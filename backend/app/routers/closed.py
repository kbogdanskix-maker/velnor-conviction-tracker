"""
Closed & Lessons — sold-position post-mortems (Phase 4).

For every ticker the user has sold, compute realized P&L (FIFO lot matching) and
the counterfactual "since you sold" move (live price vs last sell price). This is
the behavioural mirror that completes the conviction loop: you sold X at $Y, it's
$Z now, what did you learn? Lessons themselves are stored as thesis `note` entries
(see the /thesis API) so they join the ticker's conviction trail.

Read-only derivation over existing Transaction rows. v1: buy/sell lots only;
dividends, splits and buy-side fees are ignored in realized P&L (noted).
"""
from collections import defaultdict, deque
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, Transaction
from app.services import market_data

router = APIRouter(prefix="/closed")

_EPS = Decimal("0.0001")


def _realize(txs: list[Transaction]) -> dict | None:
    """FIFO-match sells against buys for one ticker. Returns None if no sells."""
    lots: deque[list[Decimal]] = deque()  # each: [qty_remaining, buy_price]
    realized = Decimal("0")      # sum (sell_price - buy_price) * qty, minus sell fees
    cost_of_sold = Decimal("0")  # cost basis of the shares that were sold
    proceeds = Decimal("0")      # gross sell proceeds
    sells = 0
    last_sell_date = None
    last_sell_price = None
    first_buy_date = None

    for t in txs:  # assumed sorted by executed_at asc
        qty = Decimal(str(t.quantity or 0))
        price = Decimal(str(t.price or 0))
        fees = Decimal(str(t.fees or 0))
        if t.transaction_type == "buy":
            if first_buy_date is None:
                first_buy_date = t.executed_at
            lots.append([qty, price])
        elif t.transaction_type == "sell":
            sells += 1
            last_sell_date = t.executed_at
            last_sell_price = price
            proceeds += qty * price
            realized -= fees
            remaining = qty
            while remaining > _EPS and lots:
                lot = lots[0]
                take = min(remaining, lot[0])
                realized += (price - lot[1]) * take
                cost_of_sold += lot[1] * take
                lot[0] -= take
                remaining -= take
                if lot[0] <= _EPS:
                    lots.popleft()
            # if remaining > 0 here, there were more sells than buys on record
            # (short or missing buy data) — ignore the unmatched remainder for v1.

    if sells == 0:
        return None

    shares_remaining = sum((lot[0] for lot in lots), Decimal("0"))
    realized_pct = float(realized / cost_of_sold * 100) if cost_of_sold > _EPS else None

    return {
        "realized_pnl": round(float(realized), 2),
        "realized_pnl_pct": round(realized_pct, 2) if realized_pct is not None else None,
        "total_proceeds": round(float(proceeds), 2),
        "shares_remaining": round(float(shares_remaining), 4),
        "fully_closed": shares_remaining <= _EPS,
        "still_held": shares_remaining > _EPS,
        "last_sell_date": last_sell_date.isoformat() if last_sell_date else None,
        "last_sell_price": round(float(last_sell_price), 2) if last_sell_price is not None else None,
        "first_buy_date": first_buy_date.isoformat() if first_buy_date else None,
    }


@router.get("")
async def list_closed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = (await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id, Portfolio.is_default.is_(True))
    )).scalar_one_or_none()
    if portfolio is None:
        return []

    txs = (await db.execute(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio.id)
        .order_by(Transaction.executed_at)
    )).scalars().all()

    by_ticker: dict[str, list[Transaction]] = defaultdict(list)
    for t in txs:
        by_ticker[t.ticker].append(t)

    realized_by_ticker: dict[str, dict] = {}
    for ticker, rows in by_ticker.items():
        r = _realize(rows)
        if r is not None:
            realized_by_ticker[ticker] = r

    if not realized_by_ticker:
        return []

    # Live prices for the "since you sold" counterfactual.
    quotes = await market_data.get_quotes(list(realized_by_ticker.keys()), ttl=60)

    out: list[dict] = []
    for ticker, r in realized_by_ticker.items():
        q = quotes.get(ticker, {}) if quotes else {}
        current_price = q.get("price") or q.get("regularMarketPrice") or q.get("current_price")
        since_sold_pct = None
        if current_price and r["last_sell_price"]:
            since_sold_pct = round((float(current_price) - r["last_sell_price"]) / r["last_sell_price"] * 100, 2)
        out.append({
            "ticker": ticker,
            "name": q.get("name") or q.get("shortName") or ticker,
            "current_price": round(float(current_price), 2) if current_price else None,
            "since_sold_pct": since_sold_pct,
            **r,
        })

    # Most recent exits first.
    out.sort(key=lambda x: x["last_sell_date"] or "", reverse=True)
    return out
