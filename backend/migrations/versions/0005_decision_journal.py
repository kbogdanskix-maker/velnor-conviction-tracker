"""Decision journal table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "decision_journal_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),  # buy | sell | hold | trim | add | watch
        sa.Column("conviction", sa.Integer, nullable=False),  # 1-5 scale
        sa.Column("rationale", sa.Text, nullable=False),
        sa.Column("price_at_decision", sa.Numeric(18, 4), nullable=True),
        sa.Column("target_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("stop_loss", sa.Numeric(18, 4), nullable=True),
        sa.Column("time_horizon", sa.String(30), nullable=True),  # days | weeks | months | years
        sa.Column("tags", sa.String(500), nullable=True),  # comma-separated
        # Outcome fields (filled in later when reviewing)
        sa.Column("outcome", sa.String(20), nullable=True),  # win | loss | breakeven | pending
        sa.Column("outcome_notes", sa.Text, nullable=True),
        sa.Column("price_at_review", sa.Numeric(18, 4), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_journal_user", "decision_journal_entries", ["user_id"])
    op.create_index("idx_journal_ticker", "decision_journal_entries", ["ticker"])


def downgrade() -> None:
    op.drop_index("idx_journal_ticker")
    op.drop_index("idx_journal_user")
    op.drop_table("decision_journal_entries")
