"""Initial schema — all core tables.

Revision ID: 0001
Revises:
Create Date: 2025-03-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("supabase_uid", UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("tier", sa.String(20), nullable=False, server_default="horizon"),
        sa.Column("tier_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_customer_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Portfolios ────────────────────────────────────────────────────────────
    op.create_table(
        "portfolios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, server_default="My Portfolio"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("is_default", sa.Boolean, server_default="true"),
        sa.Column("account_type", sa.String(20), nullable=False, server_default="brokerage"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Transactions ──────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False, server_default="stock"),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 8), nullable=False),
        sa.Column("price", sa.Numeric(18, 4), nullable=False),
        sa.Column("fees", sa.Numeric(18, 4), server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("fx_rate", sa.Numeric(18, 6), server_default="1"),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("source", sa.String(20), server_default="manual"),
        sa.Column("broker", sa.String(50), nullable=True),
        sa.Column("raw_import_data", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_transactions_portfolio", "transactions", ["portfolio_id"])
    op.create_index("idx_transactions_ticker", "transactions", ["ticker"])
    op.create_index("idx_transactions_executed", "transactions", ["executed_at"])

    # ── Holdings ──────────────────────────────────────────────────────────────
    op.create_table(
        "holdings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False, server_default="stock"),
        sa.Column("quantity", sa.Numeric(18, 8), nullable=False),
        sa.Column("avg_cost_basis", sa.Numeric(18, 4), nullable=False),
        sa.Column("total_cost", sa.Numeric(18, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("portfolio_id", "ticker"),
    )

    # ── Price snapshots ───────────────────────────────────────────────────────
    op.create_table(
        "price_snapshots",
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("close", sa.Numeric(18, 4), nullable=False),
        sa.Column("open", sa.Numeric(18, 4), nullable=True),
        sa.Column("high", sa.Numeric(18, 4), nullable=True),
        sa.Column("low", sa.Numeric(18, 4), nullable=True),
        sa.Column("volume", sa.Integer, nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("source", sa.String(20), server_default="yfinance"),
        sa.PrimaryKeyConstraint("ticker", "date"),
    )

    # ── Portfolio snapshots ───────────────────────────────────────────────────
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("total_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("total_cost", sa.Numeric(18, 4), nullable=False),
        sa.Column("cash_balance", sa.Numeric(18, 4), server_default="0"),
        sa.UniqueConstraint("portfolio_id", "date"),
    )

    # ── Watchlist ─────────────────────────────────────────────────────────────
    op.create_table(
        "watchlist_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_type", sa.String(20), server_default="stock"),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
        sa.UniqueConstraint("user_id", "ticker"),
    )

    # ── Price alerts ──────────────────────────────────────────────────────────
    op.create_table(
        "price_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("condition", sa.String(10), nullable=False),
        sa.Column("target_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Import jobs ───────────────────────────────────────────────────────────
    op.create_table(
        "import_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("filename", sa.Text, nullable=True),
        sa.Column("file_url", sa.Text, nullable=True),
        sa.Column("broker", sa.String(50), nullable=True),
        sa.Column("rows_total", sa.Integer, server_default="0"),
        sa.Column("rows_imported", sa.Integer, server_default="0"),
        sa.Column("rows_skipped", sa.Integer, server_default="0"),
        sa.Column("error_detail", JSONB, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Thesis threads ────────────────────────────────────────────────────────
    op.create_table(
        "thesis_threads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "thesis_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_id", UUID(as_uuid=True), sa.ForeignKey("thesis_threads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("entry_type", sa.String(20), nullable=False, server_default="note"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Macro snapshots ───────────────────────────────────────────────────────
    op.create_table(
        "macro_snapshots",
        sa.Column("series_id", sa.String(50), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("value", sa.Numeric(18, 6), nullable=True),
        sa.PrimaryKeyConstraint("series_id", "date"),
    )

    # ── FX rates ──────────────────────────────────────────────────────────────
    op.create_table(
        "fx_rates",
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("from_currency", sa.String(3), nullable=False),
        sa.Column("to_currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(18, 6), nullable=False),
        sa.PrimaryKeyConstraint("date", "from_currency", "to_currency"),
    )

    # ── Options view log ──────────────────────────────────────────────────────
    op.create_table(
        "options_view_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── DCF models ────────────────────────────────────────────────────────────
    op.create_table(
        "dcf_models",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("assumptions", JSONB, nullable=False),
        sa.Column("result", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Net worth assets ──────────────────────────────────────────────────────
    op.create_table(
        "net_worth_assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("value", sa.Numeric(18, 4), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("is_liability", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("as_of_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Share tokens ──────────────────────────────────────────────────────────
    op.create_table(
        "share_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=False),
        sa.Column("settings", JSONB, server_default="{}"),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in [
        "share_tokens", "net_worth_assets", "dcf_models", "options_view_log",
        "fx_rates", "macro_snapshots", "thesis_entries", "thesis_threads",
        "import_jobs", "price_alerts", "watchlist_items", "portfolio_snapshots",
        "price_snapshots", "holdings", "transactions", "portfolios", "users",
    ]:
        op.drop_table(table)
