"""
Stock Journey — the per-ticker conviction-vs-reality timeline (Phase 3 signature).

Aggregates everything that happened with one ticker into a single sorted event
stream over a price line: your transactions (buy/sell/dividend), your thesis
entries (the conviction trail), and a computed "state" (on-thesis / drifting /
broken) coloured by assumption-vs-performance.

No new storage — this is a read-only join over existing tables + price history.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import (
    User, Portfolio, Holding, Transaction, ThesisThread, ThesisEntry, DecisionJournalEntry,
)
from app.services import market_data

router = APIRouter(prefix="/journey")


def _norm_ticker(t: str) -> str:
    return t.strip().upper()


def _journey_state(in_profit: bool | None, latest_stance: str | None, has_position: bool):
    """Observational status for the ticker → (state, colour).

    Describes the user's OWN record — their latest logged stance and the factual
    sign of their P&L — never Velnor's verdict on the holding. Labels are kept
    non-directive on purpose ("bear case logged", not "thesis broken"; "in
    profit", not "on thesis"): the app reflects what the user did and what the
    price did, it does not judge the position (no-advice guardrail).

    Colour still carries the assumption-vs-performance nuance:
      gain  = in profit with an active bull/update thesis (or none logged)
      amber = mixed (profit but the thesis has gone quiet, or underwater but the
              user's own conviction is still bullish)
      loss  = a bear case the user logged, or the position is underwater
    """
    if not has_position:
        return ("watching", "neutral")
    if in_profit is None:
        # Position held but no live price available to judge P&L.
        return ("position open", "neutral")
    if latest_stance == "bear":
        return ("bear case logged", "loss")
    if in_profit and latest_stance in ("bull", "update", None):
        return ("in profit", "gain")
    if in_profit is False and latest_stance == "bull":
        return ("conviction tested", "amber")
    if in_profit:
        return ("thesis quiet", "amber")
    return ("underwater", "loss")


_TX_EVENT = {
    "buy": ("buy", "teal"),
    "sell": ("sell", "amber"),
    "dividend": ("dividend", "gain"),
}
_THESIS_COLOUR = {"bull": "gain", "bear": "loss", "update": "teal", "note": "neutral"}
# Decision-journal action → trail colour (win/loss outcome refines it below).
_ACTION_COLOUR = {
    "buy": "teal", "add": "teal",
    "sell": "amber", "trim": "amber",
    "hold": "neutral", "watch": "neutral",
}


@router.get("/{ticker}")
async def get_journey(
    ticker: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tk = _norm_ticker(ticker)

    portfolio = (await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id, Portfolio.is_default.is_(True))
    )).scalar_one_or_none()

    # ── Position (current) ────────────────────────────────────────────────
    holding = None
    if portfolio:
        holding = (await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio.id, Holding.ticker == tk)
        )).scalar_one_or_none()

    quotes = await market_data.get_quotes([tk], ttl=60)
    q = quotes.get(tk, {}) if quotes else {}
    current_price = q.get("price") or q.get("regularMarketPrice") or q.get("current_price")

    position = None
    in_profit: bool | None = None
    if holding:
        avg_cost = float(holding.avg_cost_basis)
        shares = float(holding.quantity)
        price = float(current_price) if current_price is not None else None
        pnl_pct = ((price - avg_cost) / avg_cost * 100) if (price and avg_cost) else None
        if pnl_pct is not None:
            in_profit = pnl_pct >= 0
        position = {
            "shares": shares,
            "avg_cost": round(avg_cost, 2),
            "current_price": round(price, 2) if price else None,
            "market_value": round(price * shares, 2) if price else None,
            "unrealized_pnl_pct": round(pnl_pct, 2) if pnl_pct is not None else None,
        }

    # ── Events: transactions ──────────────────────────────────────────────
    events: list[dict] = []
    if portfolio:
        txs = (await db.execute(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio.id, Transaction.ticker == tk)
            .order_by(Transaction.executed_at)
        )).scalars().all()
        for t in txs:
            kind, colour = _TX_EVENT.get(t.transaction_type, (t.transaction_type, "neutral"))
            qty = float(t.quantity or 0)
            px = float(t.price) if getattr(t, "price", None) is not None else None
            detail = f"{qty:g} @ ${px:,.2f}" if px else f"{qty:g} units"
            events.append({
                "date": t.executed_at.isoformat() if t.executed_at else None,
                "kind": kind,
                "colour": colour,
                "title": kind.capitalize(),
                "detail": detail,
                "price": round(px, 2) if px else None,
            })

    # ── Events: thesis entries (the conviction trail) ─────────────────────
    threads = (await db.execute(
        select(ThesisThread).where(ThesisThread.user_id == user.id, ThesisThread.ticker == tk)
    )).scalars().all()
    latest_stance: str | None = None
    latest_stance_at: datetime | None = None
    for th in threads:
        entries = (await db.execute(
            select(ThesisEntry).where(ThesisEntry.thread_id == th.id).order_by(ThesisEntry.created_at)
        )).scalars().all()
        for e in entries:
            events.append({
                "date": e.created_at.isoformat() if e.created_at else None,
                "kind": "thesis",
                "entry_type": e.entry_type,
                "colour": _THESIS_COLOUR.get(e.entry_type, "neutral"),
                "title": f"Thesis: {th.title}",
                "detail": (e.body or "")[:280],
            })
            if e.created_at and (latest_stance_at is None or e.created_at > latest_stance_at):
                latest_stance_at = e.created_at
                latest_stance = e.entry_type

    # ── Events: decision-journal entries (conviction 1-5 + outcome) ───────
    # Thesis and journal are intertwined per ticker — the journal carries the
    # structured conviction/outcome the thesis narrative doesn't.
    journal = (await db.execute(
        select(DecisionJournalEntry)
        .where(DecisionJournalEntry.user_id == user.id, DecisionJournalEntry.ticker == tk)
        .order_by(DecisionJournalEntry.decided_at)
    )).scalars().all()
    latest_conviction: int | None = None
    latest_conviction_at: datetime | None = None
    for j in journal:
        px = float(j.price_at_decision) if j.price_at_decision is not None else None
        colour = "gain" if j.outcome == "win" else "loss" if j.outcome == "loss" else _ACTION_COLOUR.get(j.action, "neutral")
        events.append({
            "date": j.decided_at.isoformat() if j.decided_at else None,
            "kind": "decision",
            "action": j.action,
            "conviction": j.conviction,
            "outcome": j.outcome,
            "colour": colour,
            "title": f"{(j.action or 'note').capitalize()}",
            "detail": (j.rationale or "")[:280],
            "price": round(px, 2) if px else None,
        })
        if j.decided_at and (latest_conviction_at is None or j.decided_at > latest_conviction_at):
            latest_conviction_at = j.decided_at
            latest_conviction = j.conviction

    events.sort(key=lambda x: x["date"] or "")

    # ── Price line ────────────────────────────────────────────────────────
    price_series = await market_data.get_historical_prices(tk, period="1y", interval="1d")
    price_line = [{"date": r["date"], "close": r["close"]} for r in (price_series or [])]

    state, state_colour = _journey_state(in_profit, latest_stance, holding is not None)

    return {
        "ticker": tk,
        "name": q.get("name") or q.get("shortName") or tk,
        "state": state,
        "state_colour": state_colour,
        "latest_stance": latest_stance,
        "latest_conviction": latest_conviction,
        "position": position,
        "events": events,
        "price_line": price_line,
        "has_thesis": len(threads) > 0,
        "has_journal": len(journal) > 0,
    }
