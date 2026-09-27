"""users.is_demo — marks one-click anonymous demo accounts

Revision ID: 0008
Revises: 0007
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="false"),
    )
    # The daily purge filters on this column; without an index it is a full scan
    # of the users table on every run.
    op.create_index("idx_users_is_demo", "users", ["is_demo"])


def downgrade() -> None:
    op.drop_index("idx_users_is_demo", table_name="users")
    op.drop_column("users", "is_demo")
