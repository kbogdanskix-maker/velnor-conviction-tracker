"""
Conviction Calibration — the investor-accuracy scorecard.

Deterministic, backward-looking aggregation over the user's OWN record: how their
logged conviction mapped to how decisions actually turned out, and what their sell
timing looks like in hindsight. No AI, no forward projection, no advice — it only
reports what already happened, which is exactly the conviction-tracker USP and sits
well outside the MiFID advice perimeter.

Sources (all existing tables, read-only):
  - DecisionJournalEntry.conviction (1-5) + .outcome (win/loss/breakeven/pending)
  - Transaction (FIFO realized P&L + "since you sold", reused from the closed router)
"""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, Transaction, DecisionJournalEntry
from app.routers.closed import _realize
from app.services import market_data

router = APIRouter(prefix="/calibration")

# Outcomes that count as "reviewed" (i.e. the user recorded how it went).
_DECIDED = {"win", "loss", "breakeven"}


@router.get("")
async def get_calibration(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── Conviction calibration from the decision journal ──────────────────────
    entries = (await db.execute(
        select(DecisionJournalEntry).where(DecisionJournalEntry.user_id == user.id)
    )).scalars().all()

    # Bucket reviewed entries by conviction level (1-5).
    buckets: dict[int, dict[str, int]] = {c: {"reviewed": 0, "wins": 0} for c in range(1, 6)}
    total_reviewed = 0
    total_wins = 0
    for e in entries:
        if e.outcome not in _DECIDED:
            continue
        conv = int(e.conviction) if e.conviction is not None else None
        if conv is None or conv < 1 or conv > 5:
            continue
        buckets[conv]["reviewed"] += 1
        total_reviewed += 1
        if e.outcome == "win":
            buckets[conv]["wins"] += 1
            total_wins += 1

    by_conviction = [
        {
            "conviction": c,
            "reviewed": buckets[c]["reviewed"],
            "wins": buckets[c]["wins"],
            "hit_rate": round(buckets[c]["wins"] / buckets[c]["reviewed"] * 100, 1)
            if buckets[c]["reviewed"] > 0 else None,
        }
        for c in range(1, 6)
    ]

    # "Well calibrated" = higher conviction levels win more often. We report the
    # correlation direction as a plain observation, never a judgement to act on.
    calibrated = None
    rated = [b for b in by_conviction if b["hit_rate"] is not None]
    if len(rated) >= 2:
        lo = rated[0]["hit_rate"]
        hi = rated[-1]["hit_rate"]
        calibrated = hi >= lo  # top conviction bucket beats the lowest

    journal = {
        "total_logged": len(entries),
        "total_reviewed": total_reviewed,
        "overall_hit_rate": round(total_wins / total_reviewed * 100, 1) if total_reviewed else None,
        "by_conviction": by_conviction,
        "higher_conviction_wins_more": calibrated,
    }

    # ── Sell discipline from realized trades (FIFO) ───────────────────────────
    portfolio = (await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id, Portfolio.is_default.is_(True))
    )).scalar_one_or_none()

    sells = {
        "count": 0,
        "avg_since_sold_pct": None,
        "sold_before_gains": 0,   # since_sold > +5% (ran without you)
        "dodged_drops": 0,        # since_sold < -5% (dodged the drop)
        "median_realized_pct": None,
    }
    if portfolio is not None:
        txs = (await db.execute(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio.id)
            .order_by(Transaction.executed_at)
        )).scalars().all()

        by_ticker: dict[str, list] = defaultdict(list)
        for t in txs:
            by_ticker[t.ticker].append(t)

        realized: dict[str, dict] = {}
        for ticker, rows in by_ticker.items():
            r = _realize(rows)
            if r is not None:
                realized[ticker] = r

        if realized:
            quotes = await market_data.get_quotes(list(realized.keys()), ttl=60)
            since_vals: list[float] = []
            realized_pcts: list[float] = []
            for ticker, r in realized.items():
                if r.get("realized_pnl_pct") is not None:
                    realized_pcts.append(r["realized_pnl_pct"])
                q = (quotes or {}).get(ticker, {})
                cur = q.get("price") or q.get("regularMarketPrice") or q.get("current_price")
                last_sell = r.get("last_sell_price")
                if cur and last_sell:
                    since = (float(cur) - last_sell) / last_sell * 100
                    since_vals.append(since)
                    if since > 5:
                        sells["sold_before_gains"] += 1
                    elif since < -5:
                        sells["dodged_drops"] += 1

            sells["count"] = len(realized)
            if since_vals:
                sells["avg_since_sold_pct"] = round(sum(since_vals) / len(since_vals), 1)
            if realized_pcts:
                s = sorted(realized_pcts)
                mid = len(s) // 2
                median = s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2
                sells["median_realized_pct"] = round(median, 1)

    return {"journal": journal, "sells": sells}
