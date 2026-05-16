"""Goals table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("icon", sa.String(30), nullable=False, server_default="target"),
        sa.Column("target_amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("current_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("monthly_contribution", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("cagr", sa.Numeric(5, 2), nullable=False, server_default="7.00"),
        sa.Column("target_date", sa.Date, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("linked_tickers", JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_goals_user", "goals", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_goals_user")
    op.drop_table("goals")
