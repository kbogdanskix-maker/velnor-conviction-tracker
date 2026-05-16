"""
Pydantic request/response schemas.
Kept separate from ORM models to keep the API surface clean.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ── Auth / Users ──────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: Optional[str] = None
    tier: str
    tier_expires_at: Optional[datetime] = None
    created_at: datetime


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)


# ── Portfolios ────────────────────────────────────────────────────────────────

class PortfolioCreate(BaseModel):
    name: str = Field(default="My Portfolio", max_length=100)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    account_type: str = Field(default="brokerage")


class PortfolioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    currency: str
    is_default: bool
    account_type: str
    created_at: datetime


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    ticker: str = Field(..., max_length=20)
    asset_type: str = Field(default="stock")
    transaction_type: str  # buy | sell | dividend | split | fee
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)
    fees: float = Field(default=0, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    fx_rate: float = Field(default=1, gt=0)
    executed_at: datetime
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    ticker: Optional[str] = Field(None, max_length=20)
    asset_type: Optional[str] = None
    transaction_type: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0)
    price: Optional[float] = Field(None, gt=0)
    fees: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    fx_rate: Optional[float] = Field(None, gt=0)
    executed_at: Optional[datetime] = None
    notes: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    asset_type: str
    transaction_type: str
    quantity: float
    price: float
    fees: float
    currency: str
    fx_rate: float
    executed_at: datetime
    notes: Optional[str] = None
    source: str
    broker: Optional[str] = None
    created_at: datetime


# ── Holdings ──────────────────────────────────────────────────────────────────

class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    asset_type: str
    quantity: float
    avg_cost_basis: float
    total_cost: float
    currency: str
    # Enriched at API layer (not stored in DB):
    current_price: Optional[float] = None
    market_value: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    unrealized_pnl_pct: Optional[float] = None
    day_change: Optional[float] = None
    day_change_pct: Optional[float] = None


class PortfolioSummaryOut(BaseModel):
    total_value: float
    total_cost: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    realized_pnl: float
    day_change: float
    day_change_pct: float
    holdings: list[HoldingOut]


# ── Watchlist ─────────────────────────────────────────────────────────────────

class WatchlistItemCreate(BaseModel):
    ticker: str = Field(..., max_length=20)
    asset_type: str = Field(default="stock")
    notes: Optional[str] = None


class WatchlistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    asset_type: str
    notes: Optional[str] = None
    added_at: datetime
    # Enriched:
    current_price: Optional[float] = None
    day_change_pct: Optional[float] = None


# ── Price Alerts ──────────────────────────────────────────────────────────────

class PriceAlertCreate(BaseModel):
    ticker: str = Field(..., max_length=20)
    condition: str  # above | below
    target_price: float = Field(..., gt=0)


class PriceAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    condition: str
    target_price: float
    is_active: bool
    triggered_at: Optional[datetime] = None
    created_at: datetime


# ── Import Jobs ───────────────────────────────────────────────────────────────

class ImportJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    filename: Optional[str] = None
    broker: Optional[str] = None
    rows_total: int
    rows_imported: int
    rows_skipped: int
    error_detail: Optional[Any] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


# ── Thesis Threads ────────────────────────────────────────────────────────────

class ThesisThreadCreate(BaseModel):
    ticker: str = Field(..., max_length=20)
    title: str = Field(..., max_length=200)


class ThesisEntryCreate(BaseModel):
    body: str = Field(..., min_length=1)
    entry_type: str = Field(default="note")  # bull | bear | update | note


class ThesisEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    entry_type: str
    created_at: datetime


class ThesisThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    title: str
    created_at: datetime
    updated_at: datetime
    entries: list[ThesisEntryOut] = []


# ── Macro ─────────────────────────────────────────────────────────────────────

class MacroSeriesOut(BaseModel):
    series_id: str
    name: str
    value: Optional[float] = None
    date: Optional[date] = None
    unit: str
    context: str  # human-readable equity implication


class MacroDashboardOut(BaseModel):
    yields: list[MacroSeriesOut]
    inflation: list[MacroSeriesOut]
    fed: list[MacroSeriesOut]
    fed_minutes_summary: Optional[str] = None
    updated_at: Optional[datetime] = None


# ── Net Worth ─────────────────────────────────────────────────────────────────

class NetWorthAssetCreate(BaseModel):
    name: str = Field(..., max_length=100)
    category: str
    value: float
    currency: str = Field(default="USD", min_length=3, max_length=3)
    is_liability: bool = False
    institution: Optional[str] = Field(None, max_length=100)
    interest_rate: Optional[float] = Field(None, ge=0, le=100)
    minimum_payment: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    as_of_date: date


class NetWorthAssetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    is_liability: Optional[bool] = None
    institution: Optional[str] = Field(None, max_length=100)
    interest_rate: Optional[float] = Field(None, ge=0, le=100)
    minimum_payment: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    as_of_date: Optional[date] = None


class NetWorthAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    value: float
    currency: str
    is_liability: bool
    institution: Optional[str] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    notes: Optional[str] = None
    as_of_date: date
    created_at: datetime
    updated_at: datetime


class NetWorthSummaryOut(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    portfolio_value: float
    assets: list[NetWorthAssetOut]


# ── Cash Flow ────────────────────────────────────────────────────────────────

class CashFlowEntryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    entry_type: str  # income | fixed_expense | variable_expense
    category: str
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    notes: Optional[str] = None


class CashFlowEntryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    entry_type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CashFlowEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    entry_type: str
    category: str
    amount: float
    currency: str
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CashFlowSummaryOut(BaseModel):
    total_income: float
    total_fixed: float
    total_variable: float
    total_expenses: float
    savings: float
    savings_rate: float  # 0-100 percentage
    entries: list[CashFlowEntryOut]


# ── Goals ────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    name: str = Field(..., max_length=150)
    icon: str = Field(default="target", max_length=30)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    monthly_contribution: float = Field(default=0, ge=0)
    cagr: float = Field(default=7.00, ge=0, le=30.00)
    target_date: date
    currency: str = Field(default="USD", min_length=3, max_length=3)
    portfolio_id: Optional[uuid.UUID] = None
    linked_tickers: Optional[list[str]] = None
    notes: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    icon: Optional[str] = Field(None, max_length=30)
    target_amount: Optional[float] = Field(None, gt=0)
    current_amount: Optional[float] = Field(None, ge=0)
    monthly_contribution: Optional[float] = Field(None, ge=0)
    cagr: Optional[float] = Field(None, ge=0, le=30.00)
    target_date: Optional[date] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    portfolio_id: Optional[uuid.UUID] = None
    linked_tickers: Optional[list[str]] = None
    notes: Optional[str] = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    icon: str
    target_amount: float
    current_amount: float
    monthly_contribution: float
    cagr: float
    target_date: date
    currency: str
    portfolio_id: Optional[uuid.UUID] = None
    linked_tickers: Optional[list[str]] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Decision Journal ─────────────────────────────────────────────────────────

class JournalEntryCreate(BaseModel):
    ticker: str = Field(..., max_length=20)
    action: str = Field(..., pattern="^(buy|sell|hold|trim|add|watch)$")
    conviction: int = Field(..., ge=1, le=5)
    rationale: str = Field(..., min_length=1)
    price_at_decision: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    time_horizon: Optional[str] = Field(None, max_length=30)
    tags: Optional[str] = Field(None, max_length=500)
    decided_at: Optional[datetime] = None


class JournalEntryUpdate(BaseModel):
    ticker: Optional[str] = Field(None, max_length=20)
    action: Optional[str] = Field(None, pattern="^(buy|sell|hold|trim|add|watch)$")
    conviction: Optional[int] = Field(None, ge=1, le=5)
    rationale: Optional[str] = None
    price_at_decision: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    time_horizon: Optional[str] = Field(None, max_length=30)
    tags: Optional[str] = Field(None, max_length=500)
    outcome: Optional[str] = Field(None, pattern="^(win|loss|breakeven|pending)$")
    outcome_notes: Optional[str] = None
    price_at_review: Optional[float] = None
    reviewed_at: Optional[datetime] = None


class JournalEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    action: str
    conviction: int
    rationale: str
    price_at_decision: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    time_horizon: Optional[str] = None
    tags: Optional[str] = None
    outcome: Optional[str] = None
    outcome_notes: Optional[str] = None
    price_at_review: Optional[float] = None
    reviewed_at: Optional[datetime] = None
    decided_at: datetime
    created_at: datetime
    updated_at: datetime


# ── DCF Models ────────────────────────────────────────────────────────────────

class DCFRequest(BaseModel):
    ticker: Optional[str] = None
    revenue_base: float = Field(..., gt=0, description="LTM revenue in millions")
    growth_rates: list[float] = Field(..., min_length=10, max_length=10)
    ebit_margins: list[float] = Field(..., min_length=10, max_length=10)
    tax_rate: float = Field(default=0.21, ge=0, le=1)
    capex_pct_revenue: float = Field(default=0.05, ge=0, le=1)
    nwc_change_pct_revenue: float = Field(default=0.02)
    wacc: float = Field(default=0.10, gt=0, le=1)
    terminal_growth_rate: float = Field(default=0.025, ge=0, lt=1)
    net_debt: float = Field(default=0.0)
    shares_outstanding: float = Field(..., gt=0)
    current_price: float = Field(..., gt=0)
    save_model: bool = False
    model_name: Optional[str] = None


class ReverseDCFRequest(BaseModel):
    ticker: str
    current_price: float = Field(..., gt=0)
    shares_outstanding: float = Field(..., gt=0)
    revenue_ttm: float = Field(..., gt=0)
    ebit_margin: float = Field(..., ge=-1, le=1)
    tax_rate: float = Field(default=0.21, ge=0, le=1)
    capex_pct_revenue: float = Field(default=0.05, ge=0)
    nwc_change_pct_revenue: float = Field(default=0.02)
    wacc: float = Field(default=0.10, gt=0, le=1)
    terminal_growth_rate: float = Field(default=0.025, ge=0)
    net_debt: float = Field(default=0.0)
    projection_years: int = Field(default=10, ge=5, le=15)


# ── Share Tokens ──────────────────────────────────────────────────────────────

class ShareTokenCreate(BaseModel):
    type: str  # portfolio | dcf_model
    resource_id: uuid.UUID
    settings: dict = Field(default_factory=dict)


class ShareTokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token: str
    type: str
    settings: dict
    created_at: datetime
    share_url: Optional[str] = None  # computed at API layer


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    has_more: bool
