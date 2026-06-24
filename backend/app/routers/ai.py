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

from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.core.cache import rate_limit_increment, rate_limit_get
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy import func as sqlfunc

from app.dependencies import get_current_user, get_db
from app.core.tier import require_tier, Tier
from app.models.db import User, Portfolio, Holding, Goal, NetWorthAsset, Transaction, UserKVStore, ThesisThread, ThesisEntry
from app.services import ai_service, portfolio_calc, market_data
from app.services.market_data import cache_get
from app.services.macro_service import get_macro_dashboard

router = APIRouter(prefix="/ai")


# ── Earnings briefing ────────────────────────────────────────────────────────

@router.get("/earnings/{ticker}")
async def earnings_summary(
    ticker: str,
    user: User = Depends(get_current_user),
):
    """Stream an AI-generated earnings intelligence briefing for a stock."""
    sse_headers = await _enforce_insight_quota(user)
    t = ticker.upper()

    return StreamingResponse(
        ai_service.get_earnings_summary(t),
        media_type="text/event-stream",
        headers=sse_headers,
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
    sse_headers = await _enforce_insight_quota(user)
    context = await _build_user_context(user, db)

    return StreamingResponse(
        ai_service.stream_financial_plan(context),
        media_type="text/event-stream",
        headers=sse_headers,
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
    sse_headers = await _enforce_insight_quota(user)
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
                # Enrich with a live quote for this one ticker. (The previous code
                # read a portfolio_summary cache that is never written, so market
                # value never reached the learn analysis.)
                quotes = await market_data.get_quotes([h.ticker], ttl=60)
                price = float((quotes.get(h.ticker) or {}).get("price", 0) or 0)
                if price > 0:
                    mv = price * float(h.quantity)
                    cost = float(h.total_cost)
                    holding_context.update({
                        "market_value": round(mv, 2),
                        "unrealized_pnl": round(mv - cost, 2),
                        "unrealized_pnl_pct": round((mv - cost) / cost * 100, 2) if cost > 0 else None,
                    })
                break

    return StreamingResponse(
        ai_service.stream_learn_analysis(body.concept_id, ticker, ticker_data, holding_context),
        media_type="text/event-stream",
        headers=sse_headers,
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
        # Enrich with live prices (the portfolio_summary cache is never written).
        tickers = [h.ticker for h in holdings]
        quotes = await market_data.get_quotes(tickers, ttl=60) if tickers else {}
        enriched, totals = portfolio_calc.enrich_holdings_with_quotes(holdings, quotes)
        portfolio_ctx = {
            "holdings_count": len(holdings),
            "total_value": float(totals.get("total_value") or 0),
            "unrealized_pnl": float(totals.get("unrealized_pnl") or 0),
            "top_holdings": [
                e["ticker"]
                for e in sorted(enriched, key=lambda x: float(x.get("market_value") or 0), reverse=True)
            ][:5],
        }

    # Investor profile (objective, risk, horizon, philosophy) from the cloud KV store
    prof_result = await db.execute(
        select(UserKVStore).where(
            UserKVStore.user_id == user.id,
            UserKVStore.key == "user_profile",
        )
    )
    prof_row = prof_result.scalar_one_or_none()
    profile = prof_row.data if prof_row and isinstance(prof_row.data, dict) else {}

    return {
        "net_worth": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "net_worth": total_assets - total_liabilities,
        },
        "cash_flow": cf_data,
        "goals": goals,
        "portfolio": portfolio_ctx,
        "profile": profile,
    }


async def _build_holdings_ctx(db: AsyncSession, portfolio) -> list[dict]:
    """Per-holding detail (ticker, weight %, unrealized P&L %, days held) with a
    cost-basis fallback when live prices are unavailable. Shared by Reflect and
    alert insights so both speak in specifics instead of generalities."""
    if portfolio is None:
        return []
    holdings_result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio.id)
    )
    raw_holdings = holdings_result.scalars().all()
    if not raw_holdings:
        return []

    tx_result = await db.execute(
        select(
            Transaction.ticker,
            sqlfunc.min(Transaction.executed_at).label("first_buy"),
        ).where(
            Transaction.portfolio_id == portfolio.id,
            Transaction.transaction_type == "buy",
        ).group_by(Transaction.ticker)
    )
    first_buys: dict[str, datetime] = {row.ticker: row.first_buy for row in tx_result}

    tickers = [h.ticker for h in raw_holdings]
    quotes = await market_data.get_quotes(tickers, ttl=60) if tickers else {}
    enriched, totals = portfolio_calc.enrich_holdings_with_quotes(raw_holdings, quotes)
    enriched_by_ticker = {e["ticker"]: e for e in enriched}

    market_total = float(totals.get("total_value") or 0)
    cost_total = sum(float(h.total_cost) for h in raw_holdings) or 1.0
    use_cost_basis = market_total <= 0  # prices unavailable -> weight by cost

    out: list[dict] = []
    for h in raw_holdings:
        days_held: int | None = None
        if first_buys.get(h.ticker):
            fb = first_buys[h.ticker]
            if fb.tzinfo is None:
                fb = fb.replace(tzinfo=timezone.utc)
            days_held = (datetime.now(timezone.utc) - fb).days

        e = enriched_by_ticker.get(h.ticker, {})
        if use_cost_basis:
            weight_pct = float(h.total_cost) / cost_total * 100
            pnl_pct = None
        else:
            weight_pct = float(e.get("market_value") or 0) / market_total * 100
            raw_pnl = e.get("unrealized_pnl_pct")
            pnl_pct = float(raw_pnl) if raw_pnl is not None else None

        out.append({
            "ticker": h.ticker,
            "days_held": days_held,
            "weight_pct": weight_pct,
            "unrealized_pnl_pct": pnl_pct,
        })
    return out


async def _fetch_thesis_notes(db: AsyncSession, user: User) -> list[dict]:
    """The latest thesis entry per ticker the user has written a thesis on, so AI
    surfaces can engage with the user's actual conviction rather than generic
    advice. Returns [{ticker, stance, title, body}]."""
    threads_result = await db.execute(
        select(ThesisThread).where(ThesisThread.user_id == user.id)
    )
    threads = threads_result.scalars().all()
    notes: list[dict] = []
    for th in threads:
        entry_result = await db.execute(
            select(ThesisEntry)
            .where(ThesisEntry.thread_id == th.id)
            .order_by(ThesisEntry.created_at.desc())
            .limit(1)
        )
        latest = entry_result.scalar_one_or_none()
        if latest:
            notes.append({
                "ticker": th.ticker,
                "stance": latest.entry_type,
                "title": th.title,
                "body": latest.body,
            })
    return notes


# ── Portfolio Reflection ─────────────────────────────────────────────────────

class ThesisNote(BaseModel):
    ticker: str
    stance: str
    title: str
    body: str


class AlertInsightRequest(BaseModel):
    alert_title: str
    alert_description: str
    alert_category: str
    alert_severity: str


# Insight limits per tier (per day). -1 = unlimited.
_INSIGHT_LIMITS: dict[str, int] = {
    "horizon":   0,   # free — no AI insights
    "voyager":   10,  # mid — 10/day
    "navigator": -1,  # pro — unlimited
}


async def _enforce_insight_quota(user: User) -> dict[str, str]:
    """
    Enforce the per-tier AI insight quota for any AI-generating endpoint.

    - Horizon (free): raises 403 — AI is a paid feature.
    - Voyager: increments a shared per-day Redis counter; raises 429 when the
      daily limit is exhausted.
    - Navigator: unlimited.

    Returns the SSE headers (including remaining-quota hints) to attach to the
    StreamingResponse. All AI insight endpoints share one daily counter so the
    "10 insights/day" limit spans plans, earnings briefings, and learn analyses.
    """
    tier = user.tier or "horizon"
    daily_limit = _INSIGHT_LIMITS.get(tier, 0)

    # Block horizon tier entirely
    if daily_limit == 0:
        raise HTTPException(
            status_code=403,
            detail="AI insights are not available on the free plan. Upgrade to Voyager or Navigator.",
        )

    sse_headers: dict[str, str] = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }

    # Rate-limit voyager tier via Redis daily counter
    if daily_limit > 0:
        today = date.today().isoformat()
        rate_key = f"insight_limit:{user.id}:{today}"
        # TTL = 25h so counter always outlives the calendar day
        count, allowed = await rate_limit_increment(rate_key, daily_limit, ttl=90000)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {daily_limit} AI insights reached. Resets at midnight. Upgrade to Navigator for unlimited insights.",
                headers={"X-Insight-Limit": str(daily_limit), "X-Insight-Used": str(count)},
            )
        remaining = daily_limit - count
        sse_headers["X-Insight-Remaining"] = str(remaining)
        sse_headers["X-Insight-Limit"] = str(daily_limit)

    return sse_headers


@router.post("/alert-insight")
async def alert_insight(
    body: AlertInsightRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a personalised AI insight for a specific smart alert."""
    sse_headers = await _enforce_insight_quota(user)

    context = await _build_user_context(user, db)

    # Conviction-aware enrichment: per-holding detail + the user's own thesis, so
    # the insight speaks to their actual positions and convictions rather than
    # defaulting to generic "trim and diversify" advice.
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()
    context["holdings_detail"] = await _build_holdings_ctx(db, portfolio)
    context["thesis_notes"] = await _fetch_thesis_notes(db, user)

    alert = {
        "title": body.alert_title,
        "description": body.alert_description,
        "category": body.alert_category,
        "severity": body.alert_severity,
    }

    return StreamingResponse(
        ai_service.stream_alert_insight(alert, context),
        media_type="text/event-stream",
        headers=sse_headers,
    )


class ThesisReviewRequest(BaseModel):
    ticker: str


@router.post("/thesis-review")
async def thesis_review(
    body: ThesisReviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI read on whether the user's own thesis for a ticker still holds,
    grounded in their thesis trail + live data."""
    sse_headers = await _enforce_insight_quota(user)
    tk = body.ticker.strip().upper()

    # The user's full thesis trail for this ticker
    threads = (await db.execute(
        select(ThesisThread).where(ThesisThread.user_id == user.id, ThesisThread.ticker == tk)
    )).scalars().all()
    thesis_entries: list[dict] = []
    for th in threads:
        entries = (await db.execute(
            select(ThesisEntry).where(ThesisEntry.thread_id == th.id).order_by(ThesisEntry.created_at)
        )).scalars().all()
        thesis_entries.extend(
            {"entry_type": e.entry_type, "body": e.body, "created_at": e.created_at.isoformat() if e.created_at else ""}
            for e in entries
        )

    # Position + profile
    portfolio = (await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id, Portfolio.is_default.is_(True))
    )).scalar_one_or_none()
    holdings = await _build_holdings_ctx(db, portfolio)
    holding = next((h for h in holdings if h["ticker"] == tk), None)

    prof_row = (await db.execute(
        select(UserKVStore).where(UserKVStore.user_id == user.id, UserKVStore.key == "user_profile")
    )).scalar_one_or_none()
    profile = prof_row.data if prof_row and isinstance(prof_row.data, dict) else {}

    news = await market_data.get_ticker_news(tk)
    earnings = await ai_service.get_earnings_raw_data(tk)

    return StreamingResponse(
        ai_service.stream_thesis_review(tk, thesis_entries, holding, profile, news, earnings),
        media_type="text/event-stream",
        headers=sse_headers,
    )


@router.post("/valuation/{ticker}")
async def valuation_coaching(
    ticker: str,
    user: User = Depends(get_current_user),
):
    """Stream coaching on how to value a business: the right framework for its
    type/stage and the assumptions that matter. Not a price target."""
    sse_headers = await _enforce_insight_quota(user)
    tk = ticker.strip().upper()
    data = await ai_service.get_earnings_raw_data(tk)
    return StreamingResponse(
        ai_service.stream_valuation_coaching(tk, data),
        media_type="text/event-stream",
        headers=sse_headers,
    )


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
    _tier: None = Depends(require_tier(Tier.NAVIGATOR)),
):
    """Stream an AI portfolio reflection response. Navigator-only (matches the
    Reflect page's frontend tier gate)."""
    # ── Fetch holdings from DB ──────────────────────────────────────────────
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()

    holdings_ctx: list[dict] = []
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

        # Enrich with live prices the same way the portfolio summary endpoint does.
        # (The previous code read a `portfolio_summary:{id}` cache that is never
        # written, so every weight came back None and rendered as "0.0%" — Claude
        # saw an all-zero portfolio.) Compute fresh from quotes, and fall back to
        # cost-basis weights if prices are unavailable so the context is never zero.
        tickers = [h.ticker for h in raw_holdings]
        quotes = await market_data.get_quotes(tickers, ttl=60) if tickers else {}
        enriched, totals = portfolio_calc.enrich_holdings_with_quotes(raw_holdings, quotes)
        enriched_by_ticker = {e["ticker"]: e for e in enriched}

        market_total = float(totals.get("total_value") or 0)
        cost_total = sum(float(h.total_cost) for h in raw_holdings) or 1.0
        use_cost_basis = market_total <= 0  # prices unavailable -> weight by cost

        for h in raw_holdings:
            days_held: int | None = None
            if h.ticker in first_buys and first_buys[h.ticker]:
                fb = first_buys[h.ticker]
                if fb.tzinfo is None:
                    fb = fb.replace(tzinfo=timezone.utc)
                days_held = (datetime.now(timezone.utc) - fb).days

            e = enriched_by_ticker.get(h.ticker, {})
            if use_cost_basis:
                weight_pct = float(h.total_cost) / cost_total * 100
                pnl_pct = None
            else:
                weight_pct = float(e.get("market_value") or 0) / market_total * 100
                raw_pnl = e.get("unrealized_pnl_pct")
                pnl_pct = float(raw_pnl) if raw_pnl is not None else None

            holdings_ctx.append({
                "ticker": h.ticker,
                "days_held": days_held,
                "weight_pct": weight_pct,
                "unrealized_pnl_pct": pnl_pct,
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
