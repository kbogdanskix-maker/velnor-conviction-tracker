"""
Portfolio CRUD — holdings, transactions, P&L summary.
All computation is delegated to services/portfolio_calc.py.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_current_user, get_db
from datetime import date, timedelta
from app.models.db import User, Portfolio, Transaction, Holding, PortfolioSnapshot
from app.models.schemas import (
    PortfolioCreate, PortfolioOut,
    TransactionCreate, TransactionUpdate, TransactionOut,
    PortfolioSummaryOut,
)
from app.services import portfolio_calc, market_data

router = APIRouter(prefix="/portfolios")


# ── Portfolio CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=list[PortfolioOut])
async def list_portfolios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user.id))
    return result.scalars().all()


@router.post("", response_model=PortfolioOut, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    body: PortfolioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = Portfolio(user_id=user.id, **body.model_dump())
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


@router.get("/{portfolio_id}", response_model=PortfolioOut)
async def get_portfolio(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user.id, db)
    return portfolio


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user.id, db)
    await db.delete(portfolio)
    await db.commit()


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/transactions", response_model=list[TransactionOut])
async def list_transactions(
    portfolio_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user.id, db)
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id)
        .order_by(Transaction.executed_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return result.scalars().all()


@router.post(
    "/{portfolio_id}/transactions",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_transaction(
    portfolio_id: uuid.UUID,
    body: TransactionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user.id, db)
    tx = Transaction(portfolio_id=portfolio_id, source="manual", **body.model_dump())
    db.add(tx)
    await db.flush()
    # Recompute holdings after every transaction change
    await portfolio_calc.recompute_holdings(portfolio_id, db)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.patch(
    "/{portfolio_id}/transactions/{tx_id}",
    response_model=TransactionOut,
)
async def update_transaction(
    portfolio_id: uuid.UUID,
    tx_id: uuid.UUID,
    body: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user.id, db)
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.portfolio_id == portfolio_id,
        )
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tx, field, value)

    await db.flush()
    await portfolio_calc.recompute_holdings(portfolio_id, db)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{portfolio_id}/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    portfolio_id: uuid.UUID,
    tx_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user.id, db)
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.portfolio_id == portfolio_id,
        )
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)
    await portfolio_calc.recompute_holdings(portfolio_id, db)
    await db.commit()


# ── Holdings & Summary ────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/summary", response_model=PortfolioSummaryOut)
async def get_portfolio_summary(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns holdings enriched with live prices plus aggregate P&L.
    Live prices are fetched from yfinance (Redis-cached by tier TTL).
    """
    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return PortfolioSummaryOut(
            total_value=0, total_cost=0, unrealized_pnl=0,
            unrealized_pnl_pct=0, realized_pnl=0, day_change=0, day_change_pct=0,
            holdings=[],
        )

    tickers = [h.ticker for h in holdings]
    quote_ttl = 60  # default Horizon TTL; TODO: use tier-aware TTL
    quotes = await market_data.get_quotes(tickers, ttl=quote_ttl)

    enriched, totals = portfolio_calc.enrich_holdings_with_quotes(holdings, quotes)
    realized = await portfolio_calc.compute_realized_pnl(portfolio_id, db)

    return PortfolioSummaryOut(
        **totals,
        realized_pnl=realized,
        holdings=enriched,
    )


# ── Risk Metrics ──────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/risk")
async def get_portfolio_risk(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Portfolio risk analytics — Sharpe, volatility, drawdown, beta."""
    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return portfolio_calc._empty_risk()

    # Get live quotes to compute current weights
    tickers = [h.ticker for h in holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    holdings_with_values = []
    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = float(q.get("price", 0) or 0)
        mv = price * float(h.quantity)
        holdings_with_values.append({"ticker": h.ticker, "market_value": mv})

    return await portfolio_calc.compute_risk_metrics(holdings_with_values)


# ── Tax Awareness ─────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/tax")
async def get_portfolio_tax(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tax awareness — holding periods, estimated capital gains, and
    tax-loss harvesting opportunities for each holding.
    """
    from datetime import datetime, timezone, timedelta

    await _get_portfolio_or_404(portfolio_id, user.id, db)

    # Get holdings
    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return {
            "holdings": [],
            "total_unrealized_gain": 0,
            "total_short_term": 0,
            "total_long_term": 0,
            "harvesting_opportunities": [],
        }

    tickers = [h.ticker for h in holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    # Get earliest buy date per ticker
    tx_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.portfolio_id == portfolio_id,
            Transaction.transaction_type == "buy",
            Transaction.ticker.in_(tickers),
        )
        .order_by(Transaction.executed_at.asc())
    )
    all_buys = tx_result.scalars().all()

    # Map ticker -> earliest buy date
    earliest_buy: dict[str, datetime] = {}
    for tx in all_buys:
        if tx.ticker not in earliest_buy:
            earliest_buy[tx.ticker] = tx.executed_at

    now = datetime.now(timezone.utc)
    one_year_ago = now - timedelta(days=365)

    tax_holdings = []
    total_unrealized = 0.0
    total_short_term = 0.0
    total_long_term = 0.0
    harvesting = []

    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = float(q.get("price", 0) or 0)
        qty = float(h.quantity)
        cost_basis = float(h.avg_cost_basis)
        total_cost = float(h.total_cost)
        market_value = price * qty
        gain = market_value - total_cost
        gain_pct = (gain / total_cost * 100) if total_cost > 0 else 0

        first_buy = earliest_buy.get(h.ticker)
        is_long_term = first_buy is not None and first_buy < one_year_ago
        days_held = (now - first_buy).days if first_buy else None
        days_until_long = None
        if first_buy and not is_long_term:
            target = first_buy + timedelta(days=365)
            days_until_long = max(0, (target - now).days)

        total_unrealized += gain
        if is_long_term:
            total_long_term += gain
        else:
            total_short_term += gain

        entry = {
            "ticker": h.ticker,
            "quantity": qty,
            "cost_basis": cost_basis,
            "total_cost": round(total_cost, 2),
            "current_price": price,
            "market_value": round(market_value, 2),
            "unrealized_gain": round(gain, 2),
            "unrealized_gain_pct": round(gain_pct, 2),
            "first_buy_date": first_buy.isoformat() if first_buy else None,
            "days_held": days_held,
            "is_long_term": is_long_term,
            "days_until_long_term": days_until_long,
            "tax_status": "long-term" if is_long_term else "short-term",
        }
        tax_holdings.append(entry)

        # Tax-loss harvesting: positions with unrealized losses
        if gain < -50:  # only flag meaningful losses (>$50)
            harvesting.append({
                "ticker": h.ticker,
                "unrealized_loss": round(gain, 2),
                "loss_pct": round(gain_pct, 2),
                "is_long_term": is_long_term,
                "potential_offset": round(abs(gain), 2),
            })

    # Sort holdings by gain desc, harvesting by loss (most negative first)
    tax_holdings.sort(key=lambda x: x["unrealized_gain"], reverse=True)
    harvesting.sort(key=lambda x: x["unrealized_loss"])

    return {
        "holdings": tax_holdings,
        "total_unrealized_gain": round(total_unrealized, 2),
        "total_short_term": round(total_short_term, 2),
        "total_long_term": round(total_long_term, 2),
        "harvesting_opportunities": harvesting,
    }


# ── Dividends ─────────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/dividends")
async def get_portfolio_dividends(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dividend summary for all holdings — yield, income, ex-dates."""
    import asyncio

    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return {
            "holdings": [],
            "total_annual_income": 0,
            "portfolio_yield": 0,
            "total_portfolio_value": 0,
            "next_ex_dates": [],
        }

    tickers = [h.ticker for h in holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    # Fetch ticker info for dividend data (cached 24h)
    info_tasks = [market_data.get_ticker_info(t) for t in tickers]
    infos = await asyncio.gather(*info_tasks, return_exceptions=True)
    info_map = {t: info for t, info in zip(tickers, infos) if info and not isinstance(info, Exception)}

    dividend_holdings = []
    total_annual_income = 0.0
    total_portfolio_value = 0.0
    next_ex_dates = []

    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = float(q.get("price", 0) or 0)
        qty = float(h.quantity)
        market_value = price * qty
        total_portfolio_value += market_value

        info = info_map.get(h.ticker)
        div_rate = info.get("dividend_rate") if info else None
        div_yield = info.get("dividend_yield") if info else None
        # Fallback: calculate yield from rate / price when yield is missing
        if div_yield is None and div_rate and price and price > 0:
            div_yield = round(div_rate / price, 4)
        ex_date = info.get("ex_dividend_date") if info else None
        payout = info.get("payout_ratio") if info else None
        five_yr = info.get("five_year_avg_yield") if info else None
        last_div = info.get("last_dividend_value") if info else None

        annual_income = (div_rate or 0) * qty
        total_annual_income += annual_income

        dividend_holdings.append({
            "ticker": h.ticker,
            "quantity": qty,
            "current_price": price,
            "market_value": round(market_value, 2),
            "dividend_rate": div_rate,
            "dividend_yield": div_yield,
            "annual_income": round(annual_income, 2),
            "ex_dividend_date": ex_date,
            "payout_ratio": payout,
            "five_year_avg_yield": five_yr,
            "last_dividend_value": last_div,
        })

        if ex_date:
            next_ex_dates.append({"ticker": h.ticker, "date": ex_date})

    # Sort ex-dates by date (soonest first) and filter out past dates
    from datetime import date as date_type
    today_str = date_type.today().isoformat()
    next_ex_dates = [ex for ex in next_ex_dates if ex["date"] >= today_str]
    next_ex_dates.sort(key=lambda x: x["date"])

    portfolio_yield = (
        total_annual_income / total_portfolio_value
        if total_portfolio_value > 0
        else 0
    )

    return {
        "holdings": sorted(dividend_holdings, key=lambda x: x["annual_income"], reverse=True),
        "total_annual_income": round(total_annual_income, 2),
        "portfolio_yield": round(portfolio_yield, 4),
        "total_portfolio_value": round(total_portfolio_value, 2),
        "next_ex_dates": next_ex_dates[:10],
    }


# ── Performance History ──────────────────────────────────────────────────────

@router.get("/{portfolio_id}/performance")
async def get_portfolio_performance(
    portfolio_id: uuid.UUID,
    period: str = Query("1y", pattern="^(1mo|3mo|6mo|1y|2y|5y)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Historical portfolio value over time.
    Computes daily weighted sum of holdings * historical close prices.
    Returns [{date, value, cost_basis}] for charting.
    """
    import asyncio

    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return {"period": period, "data": []}

    tickers = [h.ticker for h in holdings]
    quantities = {h.ticker: float(h.quantity) for h in holdings}
    cost_bases = {h.ticker: float(h.total_cost) for h in holdings}
    total_cost = sum(cost_bases.values())

    # Fetch historical prices in parallel
    tasks = [market_data.get_historical_prices(t, period=period) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build date -> {ticker: close} map
    date_prices: dict[str, dict[str, float]] = {}
    for ticker, hist in zip(tickers, results):
        if isinstance(hist, Exception) or not hist:
            continue
        for row in hist:
            d = row["date"]
            if d not in date_prices:
                date_prices[d] = {}
            date_prices[d][ticker] = row["close"]

    # Compute portfolio value per date
    series = []
    for d in sorted(date_prices.keys()):
        prices = date_prices[d]
        # Only include dates where we have prices for most holdings
        if len(prices) < len(tickers) * 0.5:
            continue
        value = sum(prices.get(t, 0) * quantities[t] for t in tickers)
        series.append({
            "date": d,
            "value": round(value, 2),
            "cost_basis": round(total_cost, 2),
        })

    return {"period": period, "data": series}


# ── Correlation Matrix ────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/correlation")
async def get_portfolio_correlation(
    portfolio_id: uuid.UUID,
    period: str = Query("1y", pattern="^(3mo|6mo|1y|2y|5y)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pairwise correlation matrix for portfolio holdings."""
    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if len(holdings) < 2:
        tickers = [h.ticker for h in holdings]
        return {"tickers": tickers, "matrix": [[1.0]] * len(tickers), "period": period}

    tickers = [h.ticker for h in holdings]
    data = await market_data.get_correlation_data(tickers, period=period)
    data["period"] = period
    return data


# ── Sector Breakdown ──────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/sectors")
async def get_portfolio_sectors(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sector & industry breakdown for all holdings."""
    import asyncio

    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return {
            "holdings": [],
            "sectors": [],
            "industries": [],
            "total_value": 0,
        }

    tickers = [h.ticker for h in holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    # Fetch ticker info for sector/industry (cached 24h)
    info_tasks = [market_data.get_ticker_info(t) for t in tickers]
    infos = await asyncio.gather(*info_tasks, return_exceptions=True)
    info_map = {t: info for t, info in zip(tickers, infos) if info and not isinstance(info, Exception)}

    holding_entries = []
    sector_totals: dict[str, float] = {}
    industry_totals: dict[str, tuple[str, float]] = {}  # industry -> (sector, value)
    total_value = 0.0

    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = float(q.get("price", 0) or 0)
        qty = float(h.quantity)
        market_value = price * qty
        total_value += market_value

        info = info_map.get(h.ticker)
        sector = (info.get("sector") if info else None) or "Unknown"
        industry = (info.get("industry") if info else None) or "Unknown"
        quote_type = (info.get("quote_type") if info else None) or "EQUITY"

        # ETFs don't have a meaningful sector — label them
        if quote_type == "ETF":
            sector = "ETF / Fund"
            industry = info.get("name", h.ticker) if info else h.ticker

        holding_entries.append({
            "ticker": h.ticker,
            "name": info.get("name", h.ticker) if info else h.ticker,
            "sector": sector,
            "industry": industry,
            "market_value": round(market_value, 2),
            "weight": 0,  # filled below
        })

        sector_totals[sector] = sector_totals.get(sector, 0) + market_value
        prev = industry_totals.get(industry, (sector, 0))
        industry_totals[industry] = (sector, prev[1] + market_value)

    # Fill weights
    for entry in holding_entries:
        entry["weight"] = round(entry["market_value"] / total_value, 4) if total_value > 0 else 0

    # Build sector list sorted by value
    sectors = [
        {"name": name, "value": round(val, 2), "weight": round(val / total_value, 4) if total_value > 0 else 0}
        for name, val in sector_totals.items()
    ]
    sectors.sort(key=lambda x: x["value"], reverse=True)

    # Build industry list sorted by value
    industries = [
        {"name": name, "sector": sec, "value": round(val, 2), "weight": round(val / total_value, 4) if total_value > 0 else 0}
        for name, (sec, val) in industry_totals.items()
    ]
    industries.sort(key=lambda x: x["value"], reverse=True)

    return {
        "holdings": sorted(holding_entries, key=lambda x: x["market_value"], reverse=True),
        "sectors": sectors,
        "industries": industries,
        "total_value": round(total_value, 2),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_portfolio_or_404(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Portfolio:
    result = await db.execute(
        select(Portfolio).where(
            Portfolio.id == portfolio_id,
            Portfolio.user_id == user_id,
        )
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


# ── Portfolio Snapshots (Performance History) ────────────────────────────────

@router.post("/{portfolio_id}/snapshot")
async def take_portfolio_snapshot(
    portfolio_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Take a snapshot of current portfolio value for performance tracking."""
    await _get_portfolio_or_404(portfolio_id, user.id, db)

    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()

    if not holdings:
        return {"status": "skipped", "reason": "no holdings"}

    tickers = [h.ticker for h in holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60)

    total_value = 0.0
    total_cost = 0.0
    for h in holdings:
        q = quotes.get(h.ticker, {})
        price = float(q.get("price", 0) or 0)
        qty = float(h.quantity)
        total_value += price * qty
        total_cost += float(h.avg_cost_basis) * qty

    today = date.today()

    # Upsert — update if snapshot exists for today, create otherwise
    result = await db.execute(
        select(PortfolioSnapshot).where(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.date == today,
        )
    )
    snap = result.scalar_one_or_none()

    if snap:
        snap.total_value = round(total_value, 4)
        snap.total_cost = round(total_cost, 4)
    else:
        snap = PortfolioSnapshot(
            portfolio_id=portfolio_id,
            date=today,
            total_value=round(total_value, 4),
            total_cost=round(total_cost, 4),
        )
        db.add(snap)

    await db.commit()
    return {
        "status": "ok",
        "date": str(today),
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
    }


@router.get("/{portfolio_id}/history")
async def get_portfolio_history(
    portfolio_id: uuid.UUID,
    days: int = Query(default=365, ge=7, le=3650),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio value history for performance chart."""
    await _get_portfolio_or_404(portfolio_id, user.id, db)

    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(PortfolioSnapshot)
        .where(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.date >= since,
        )
        .order_by(PortfolioSnapshot.date)
    )
    snapshots = result.scalars().all()

    return {
        "portfolio_id": str(portfolio_id),
        "snapshots": [
            {
                "date": str(s.date),
                "total_value": round(float(s.total_value), 2),
                "total_cost": round(float(s.total_cost), 2),
                "pnl": round(float(s.total_value) - float(s.total_cost), 2),
            }
            for s in snapshots
        ],
    }


