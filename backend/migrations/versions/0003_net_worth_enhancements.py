"""Add debt-tracking columns to net_worth_assets.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("net_worth_assets", sa.Column("institution", sa.String(100), nullable=True))
    op.add_column("net_worth_assets", sa.Column("interest_rate", sa.Numeric(5, 2), nullable=True))
    op.add_column("net_worth_assets", sa.Column("minimum_payment", sa.Numeric(18, 4), nullable=True))
    op.add_column("net_worth_assets", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("idx_nw_assets_user", "net_worth_assets", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_nw_assets_user")
    op.drop_column("net_worth_assets", "updated_at")
    op.drop_column("net_worth_assets", "minimum_payment")
    op.drop_column("net_worth_assets", "interest_rate")
    op.drop_column("net_worth_assets", "institution")
