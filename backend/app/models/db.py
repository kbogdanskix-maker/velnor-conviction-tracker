"""
SQLAlchemy 2.0 ORM models.
These map directly to the database schema defined in the plan.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String, Boolean, Integer, Numeric, Text, DateTime, Date,
    ForeignKey, UniqueConstraint, Index, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Users & Auth ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_uid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="horizon")
    tier_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    portfolios: Mapped[list["Portfolio"]] = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    watchlist_items: Mapped[list["WatchlistItem"]] = relationship("WatchlistItem", back_populates="user", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    price_alerts: Mapped[list["PriceAlert"]] = relationship("PriceAlert", back_populates="user", cascade="all, delete-orphan")
    thesis_threads: Mapped[list["ThesisThread"]] = relationship("ThesisThread", back_populates="user", cascade="all, delete-orphan")
    net_worth_assets: Mapped[list["NetWorthAsset"]] = relationship("NetWorthAsset", back_populates="user", cascade="all, delete-orphan")
    cash_flow_entries: Mapped[list["CashFlowEntry"]] = relationship("CashFlowEntry", back_populates="user", cascade="all, delete-orphan")
    journal_entries: Mapped[list["DecisionJournalEntry"]] = relationship("DecisionJournalEntry", back_populates="user", cascade="all, delete-orphan")


# ── Portfolios & Transactions ─────────────────────────────────────────────────

class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="My Portfolio")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False, default="brokerage")  # brokerage | retirement_401k | ira
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="portfolios")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")
    holdings: Mapped[list["Holding"]] = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    snapshots: Mapped[list["PortfolioSnapshot"]] = relationship("PortfolioSnapshot", back_populates="portfolio", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("idx_transactions_portfolio", "portfolio_id"),
        Index("idx_transactions_ticker", "ticker"),
        Index("idx_transactions_executed", "executed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False, default="stock")  # stock | etf | crypto | bond | cash
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)  # buy | sell | dividend | split | fee
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    fees: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("1"))
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | import | api
    broker: Mapped[Optional[str]] = mapped_column(String(50))
    raw_import_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="transactions")


class Holding(Base):
    """Materialised current position — recomputed whenever transactions change."""
    __tablename__ = "holdings"
    __table_args__ = (UniqueConstraint("portfolio_id", "ticker"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False, default="stock")
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    avg_cost_basis: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="holdings")


# ── Price Data ────────────────────────────────────────────────────────────────

class PriceSnapshot(Base):
    """Daily OHLCV — used for performance charts and TWR calculation."""
    __tablename__ = "price_snapshots"
    __table_args__ = (
        Index("idx_prices_ticker_date", "ticker", "date"),
    )

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    close: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    open: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    high: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    low: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    volume: Mapped[Optional[int]] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    source: Mapped[str] = mapped_column(String(20), default="yfinance")


class PortfolioSnapshot(Base):
    """Daily portfolio valuation — drives the performance chart."""
    __tablename__ = "portfolio_snapshots"
    __table_args__ = (UniqueConstraint("portfolio_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))

    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="snapshots")


# ── Watchlist & Alerts ────────────────────────────────────────────────────────

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("user_id", "ticker"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), default="stock")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="watchlist_items")


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    condition: Mapped[str] = mapped_column(String(10), nullable=False)  # above | below
    target_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="price_alerts")


# ── Broker Imports ────────────────────────────────────────────────────────────

class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | processing | completed | failed
    filename: Mapped[Optional[str]] = mapped_column(Text)
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    broker: Mapped[Optional[str]] = mapped_column(String(50))  # detected broker name or 'manual'
    rows_total: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0)
    error_detail: Mapped[Optional[dict]] = mapped_column(JSONB)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Thesis Threads ────────────────────────────────────────────────────────────

class ThesisThread(Base):
    __tablename__ = "thesis_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="thesis_threads")
    entries: Mapped[list["ThesisEntry"]] = relationship("ThesisEntry", back_populates="thread", cascade="all, delete-orphan", order_by="ThesisEntry.created_at")


class ThesisEntry(Base):
    __tablename__ = "thesis_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("thesis_threads.id", ondelete="CASCADE"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False, default="note")  # bull | bear | update | note
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    thread: Mapped["ThesisThread"] = relationship("ThesisThread", back_populates="entries")


# ── Macro Data ────────────────────────────────────────────────────────────────

class MacroSnapshot(Base):
    """Daily FRED series values — cached to avoid hitting the API repeatedly."""
    __tablename__ = "macro_snapshots"

    series_id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. 'DGS10'
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6))


# ── FX Rates ──────────────────────────────────────────────────────────────────

class FxRate(Base):
    __tablename__ = "fx_rates"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    from_currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    to_currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)


# ── Options Views (rate limiting) ─────────────────────────────────────────────

class OptionsViewLog(Base):
    __tablename__ = "options_view_log"
    __table_args__ = (Index("idx_options_view_user_week", "user_id", "viewed_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── DCF Models ────────────────────────────────────────────────────────────────

class DcfModel(Base):
    __tablename__ = "dcf_models"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[Optional[str]] = mapped_column(String(20))
    name: Mapped[Optional[str]] = mapped_column(String(100))
    assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── Net Worth ─────────────────────────────────────────────────────────────────

class NetWorthAsset(Base):
    __tablename__ = "net_worth_assets"
    __table_args__ = (Index("idx_nw_assets_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Assets: checking | savings | hysa | money_market | cd | real_estate | vehicle | business | retirement_401k | ira | hsa | crypto | other_asset
    # Liabilities: credit_card | student_loan | auto_loan | mortgage | personal_loan | medical_debt | other_debt
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_liability: Mapped[bool] = mapped_column(Boolean, default=False)
    institution: Mapped[Optional[str]] = mapped_column(String(100))  # bank or lender name
    interest_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))  # APR/APY as percentage (e.g. 4.50)
    minimum_payment: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))  # monthly min for debts
    notes: Mapped[Optional[str]] = mapped_column(Text)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="net_worth_assets")


# ── Cash Flow ────────────────────────────────────────────────────────────────

class CashFlowEntry(Base):
    """Recurring income or expense line item."""
    __tablename__ = "cash_flow_entries"
    __table_args__ = (Index("idx_cf_entries_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # income | fixed_expense | variable_expense
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # salary | freelance | rental | dividends | other_income
    # rent | mortgage_pmt | utilities | insurance | subscriptions | transport | groceries | dining | entertainment | other_expense
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)  # monthly amount
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="cash_flow_entries")


# ── Decision Journal ─────────────────────────────────────────────────────────

class DecisionJournalEntry(Base):
    """Investment decision log with rationale and outcome tracking."""
    __tablename__ = "decision_journal_entries"
    __table_args__ = (
        Index("idx_journal_user", "user_id"),
        Index("idx_journal_ticker", "ticker"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # buy | sell | hold | trim | add | watch
    conviction: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    price_at_decision: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    target_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    stop_loss: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    time_horizon: Mapped[Optional[str]] = mapped_column(String(30))
    tags: Mapped[Optional[str]] = mapped_column(String(500))
    # Outcome (filled when reviewing)
    outcome: Mapped[Optional[str]] = mapped_column(String(20))  # win | loss | breakeven | pending
    outcome_notes: Mapped[Optional[str]] = mapped_column(Text)
    price_at_review: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Timestamps
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="journal_entries")


# ── User KV Store (cloud-synced JSON blobs) ──────────────────────────────────

class UserKVStore(Base):
    """Generic JSON storage per user per key — replaces localStorage."""
    __tablename__ = "user_kv_store"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_kv_store_user_key"),
        Index("idx_kv_store_user_key", "user_id", "key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[dict | list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── Goals ────────────────────────────────────────────────────────────────────

class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (Index("idx_goals_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    icon: Mapped[str] = mapped_column(String(30), nullable=False, default="target")
    target_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    monthly_contribution: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    cagr: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("7.00"))
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    portfolio_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="SET NULL"), nullable=True)
    linked_tickers: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="goals")


# ── Share Tokens ──────────────────────────────────────────────────────────

class ShareToken(Base):
    __tablename__ = "share_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # portfolio | dcf_model
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)  # privacy controls
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Deep Dive Reports ─────────────────────────────────────────────────────

class DeepDiveReport(Base):
    """An equity-research-style report on one ticker, generated on request.

    Rate limited per user (see deep_dive.COOLDOWN_DAYS) because each run is an
    Opus call with live web search. The rendered report is stored as structured
    JSON so the page renders from Postgres instead of re-running the model, and
    so later AI surfaces can cite an existing dive rather than re-researching
    the same ground.

    `report` follows the schema in services/deep_dive.REPORT_SCHEMA: sourced
    facts first, the comparison against the user's own recorded thesis last.
    """
    __tablename__ = "deep_dive_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)

    # queued | running | complete | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    report: Mapped[Optional[dict]] = mapped_column(JSONB)
    error: Mapped[Optional[str]] = mapped_column(Text)

    # Cost/provenance accounting — one row per paid run.
    model: Mapped[Optional[str]] = mapped_column(String(50))
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    web_searches: Mapped[Optional[int]] = mapped_column(Integer)

    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_deep_dive_user_requested", "user_id", "requested_at"),
        Index("ix_deep_dive_user_ticker", "user_id", "ticker"),
    )
