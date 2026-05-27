"""
AI router — streaming endpoints powered by Claude.
  GET  /ai/earnings/{ticker}  → streamed earnings briefing
  GET  /ai/plan               → streamed personalised financial plan
  POST /ai/learn              → streamed concept-applied stock analysis
"""
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy import func as sqlfunc

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, Holding, Goal, NetWorthAsset, Transaction
from app.services import ai_service
from app.services.market_data import cache_get
from app.services.macro_service import get_macro_dashboard

router = APIRouter(prefix="/ai")


# ── Earnings briefing ────────────────────────────────────────────────────────

@router.get("/earnings/{ticker}")
async def earnings_summary(
    ticker: str,
    _: User = Depends(get_current_user),
):
    """Stream an AI-generated earnings intelligence briefing for a stock."""
    t = ticker.upper()

    return StreamingResponse(
        ai_service.get_earnings_summary(t),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/earnings/{ticker}/cached")
async def earnings_summary_cached(
    ticker: str,
    _: User = Depends(get_current_user),
):
    """Return the cached earnings summary text if available, else null."""
    cached = await cache_get(f"earnings_ai:{ticker.upper()}")
    return {"ticker": ticker.upper(), "summary": cached}


# ── Tailored financial plan ──────────────────────────────────────────────────

@router.get("/plan")
async def generate_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a personalised financial plan based on the user's data."""
    context = await _build_user_context(user, db)

    return StreamingResponse(
        ai_service.stream_financial_plan(context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class LearnAnalysisRequest(BaseModel):
    concept_id: str
    ticker: str


@router.post("/learn")
async def learn_analysis(
    body: LearnAnalysisRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a concept-applied stock analysis for the Learn section."""
    ticker = body.ticker.upper()

    # Fetch ticker financial data (reuse earnings raw data)
    ticker_data = await ai_service.get_earnings_raw_data(ticker)

    # Check if the user holds this ticker — enrich prompt with position context
    holding_context: dict | None = None
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()
    if portfolio:
        holdings_result = await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio.id)
        )
        holdings = holdings_result.scalars().all()
        for h in holdings:
            if h.ticker.upper() == ticker:
                holding_context = {
                    "quantity": float(h.quantity),
                    "avg_cost_basis": float(h.avg_cost_basis),
                    "total_cost": float(h.total_cost),
                }
                # Enrich from cached portfolio summary if available
                cached_summary = await cache_get(f"portfolio_summary:{portfolio.id}")
                if cached_summary and "holdings" in cached_summary:
                    for ch in cached_summary["holdings"]:
                        if ch.get("ticker", "").upper() == ticker:
                            holding_context.update({
                                "market_value": ch.get("market_value"),
                                "unrealized_pnl": ch.get("unrealized_pnl"),
                                "unrealized_pnl_pct": ch.get("unrealized_pnl_pct"),
                            })
                break

    return StreamingResponse(
        ai_service.stream_learn_analysis(body.concept_id, ticker, ticker_data, holding_context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _build_user_context(user: User, db: AsyncSession) -> dict:
    """Aggregate user's financial data for the plan prompt."""

    # Net worth
    nw_result = await db.execute(
        select(NetWorthAsset).where(NetWorthAsset.user_id == user.id)
    )
    assets = nw_result.scalars().all()
    total_assets = sum(float(a.value) for a in assets if not a.is_liability)
    total_liabilities = sum(float(a.value) for a in assets if a.is_liability)

    # Cash flow — compute from DB entries
    from app.models.db import CashFlowEntry
    from decimal import Decimal as D
    cf_result = await db.execute(
        select(CashFlowEntry).where(CashFlowEntry.user_id == user.id)
    )
    cf_entries = cf_result.scalars().all()
    total_income = float(sum((e.amount for e in cf_entries if e.entry_type == "income"), D("0")))
    total_expenses = float(sum((e.amount for e in cf_entries if e.entry_type != "income"), D("0")))
    cf_data = {"total_income": total_income, "total_expenses": total_expenses}

    # Goals
    goals_result = await db.execute(
        select(Goal).where(Goal.user_id == user.id)
    )
    goals = [
        {
            "name": g.name,
            "target_amount": str(g.target_amount),
            "current_amount": str(g.current_amount),
            "monthly_contribution": str(g.monthly_contribution),
            "target_date": str(g.target_date),
            "cagr": str(g.cagr),
        }
        for g in goals_result.scalars().all()
    ]

    # Portfolio
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()
    portfolio_ctx: dict = {}
    if portfolio:
        holdings_result = await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio.id)
        )
        holdings = holdings_result.scalars().all()
        portfolio_ctx = {
            "holdings_count": len(holdings),
            "top_holdings": [h.ticker for h in sorted(holdings, key=lambda x: float(x.total_cost), reverse=True)][:5],
        }
        # Try to get enriched portfolio value from cache
        from app.services.market_data import cache_get as cg
        cached_summary = await cg(f"portfolio_summary:{portfolio.id}")
        if cached_summary:
            portfolio_ctx.update(cached_summary)

    return {
        "net_worth": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "net_worth": total_assets - total_liabilities,
        },
        "cash_flow": cf_data,
        "goals": goals,
        "portfolio": portfolio_ctx,
    }


# ── Portfolio Reflection ─────────────────────────────────────────────────────

class ThesisNote(BaseModel):
    ticker: str
    stance: str
    title: str
    body: str


class ReflectMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ReflectNote(BaseModel):
    id: str
    content: str
    created_at: str


class ReflectRequest(BaseModel):
    messages: list[ReflectMessage] = []
    profile: dict = {}
    flagged_notes: list[ReflectNote] = []
    ephemeral_notes: list[ReflectNote] = []
    thesis_notes: list[ThesisNote] = []
    is_opening: bool = False


@router.post("/reflect")
async def portfolio_reflect(
    body: ReflectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI portfolio reflection response."""
    # ── Fetch holdings from DB ──────────────────────────────────────────────
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()

    holdings_ctx: list[dict] = []
    total_value = 1  # avoid division by zero default
    if portfolio:
        holdings_result = await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio.id)
        )
        raw_holdings = holdings_result.scalars().all()

        # Get earliest buy transaction date per ticker for days_held
        tx_result = await db.execute(
            select(
                Transaction.ticker,
                sqlfunc.min(Transaction.executed_at).label("first_buy"),
            ).where(
                Transaction.portfolio_id == portfolio.id,
                Transaction.transaction_type == "buy",
            ).group_by(Transaction.ticker)
        )
        first_buys: dict[str, datetime] = {
            row.ticker: row.first_buy for row in tx_result
        }

        # Try enriched cache for market values and P&L
        cached_summary = await cache_get(f"portfolio_summary:{portfolio.id}")
        cached_by_ticker: dict[str, dict] = {}
        if cached_summary and "holdings" in cached_summary:
            cached_by_ticker = {h["ticker"]: h for h in cached_summary["holdings"]}
            total_value = cached_summary.get("total_value") or 1

        for h in raw_holdings:
            days_held: int | None = None
            if h.ticker in first_buys and first_buys[h.ticker]:
                fb = first_buys[h.ticker]
                if fb.tzinfo is None:
                    fb = fb.replace(tzinfo=timezone.utc)
                days_held = (datetime.now(timezone.utc) - fb).days

            cached = cached_by_ticker.get(h.ticker, {})
            weight_pct = (
                (cached.get("market_value") or 0) / total_value * 100
                if cached_summary and total_value
                else None
            )
            holdings_ctx.append({
                "ticker": h.ticker,
                "days_held": days_held,
                "weight_pct": weight_pct,
                "unrealized_pnl_pct": cached.get("unrealized_pnl_pct"),
            })

    # ── Fetch goals + net worth ──────────────────────────────────────────────
    context = await _build_user_context(user, db)
    goals = context.get("goals", [])
    nw = context.get("net_worth", {})

    # ── Fetch macro data ─────────────────────────────────────────────────────
    macro = await get_macro_dashboard()

    # ── Build system prompt ──────────────────────────────────────────────────
    system_prompt = ai_service._build_reflection_system_prompt(
        profile=body.profile,
        holdings=holdings_ctx,
        goals=goals,
        nw=nw,
        quick_notes_flagged=[n.content for n in body.flagged_notes],
        quick_notes_ephemeral=[n.content for n in body.ephemeral_notes],
        thesis_notes=[t.model_dump() for t in body.thesis_notes],
        macro=macro,
        is_opening=body.is_opening,
    )

    messages = [m.model_dump() for m in body.messages]

    return StreamingResponse(
        ai_service.stream_reflection(messages, system_prompt, body.is_opening),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
