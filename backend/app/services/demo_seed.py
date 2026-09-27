"""Persist the demo fixture for one user.

Idempotent: a user who already owns a portfolio is left alone, so a double-click
on "Enter the demo" or a retried request cannot duplicate anything.
"""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    DecisionJournalEntry,
    Portfolio,
    ThesisEntry,
    ThesisThread,
    Transaction,
    User,
    WatchlistItem,
)
from app.services import portfolio_calc
from app.services.demo_seed_data import (
    DEMO_PORTFOLIO_NAME,
    SEED_JOURNAL,
    SEED_THESES,
    SEED_TRANSACTIONS,
    SEED_WATCHLIST,
)

logger = logging.getLogger(__name__)


async def seed_demo_user(user: User, db: AsyncSession) -> uuid.UUID:
    """Create the sample portfolio and history. Returns the portfolio id.

    Safe to call repeatedly — returns the existing portfolio's id if the user
    already has one.
    """
    existing = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id).limit(1)
    )
    portfolio = existing.scalar_one_or_none()
    if portfolio is not None:
        return portfolio.id

    portfolio = Portfolio(
        user_id=user.id,
        name=DEMO_PORTFOLIO_NAME,
        currency="USD",
        is_default=True,
        account_type="brokerage",
    )
    db.add(portfolio)
    await db.flush()  # assigns portfolio.id without committing

    for t in SEED_TRANSACTIONS:
        db.add(
            Transaction(
                portfolio_id=portfolio.id,
                ticker=t.ticker,
                asset_type="stock",
                transaction_type=t.transaction_type,
                quantity=t.quantity,
                price=t.price,
                currency="USD",
                executed_at=t.executed_at,
                notes=t.notes or None,
                source="manual",
            )
        )

    for th in SEED_THESES:
        thread = ThesisThread(user_id=user.id, ticker=th.ticker, title=th.title)
        db.add(thread)
        await db.flush()
        for e in th.entries:
            db.add(
                ThesisEntry(
                    thread_id=thread.id,
                    body=e.body,
                    entry_type=e.entry_type,
                    created_at=e.created_at,
                )
            )

    for j in SEED_JOURNAL:
        db.add(
            DecisionJournalEntry(
                user_id=user.id,
                ticker=j.ticker,
                action=j.action,
                conviction=j.conviction,
                rationale=j.rationale,
                decided_at=j.decided_at,
                outcome=j.outcome,
            )
        )

    for w in SEED_WATCHLIST:
        db.add(WatchlistItem(user_id=user.id, ticker=w.ticker, notes=w.notes))

    await db.commit()

    # Holdings is a materialised table — transactions alone produce no
    # positions, and the dashboard reads holdings. recompute_holdings only
    # stages the delete+insert on the session; it does not commit (matching
    # every other call site in app/routers/portfolio.py), so we must commit
    # again here or the recomputed rows are rolled back when the request's
    # session closes and the demo dashboard comes up empty.
    await portfolio_calc.recompute_holdings(portfolio.id, db)
    await db.commit()

    logger.info("Seeded demo portfolio for user %s", user.id)
    return portfolio.id
