"""deep dive reports

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deep_dive_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("report", postgresql.JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("model", sa.String(50), nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=True),
        sa.Column("output_tokens", sa.Integer, nullable=True),
        sa.Column("web_searches", sa.Integer, nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Cooldown lookup: newest run for a user.
    op.create_index(
        "ix_deep_dive_user_requested",
        "deep_dive_reports",
        ["user_id", "requested_at"],
    )
    # "Has this name been dived before?" for citing an existing report.
    op.create_index(
        "ix_deep_dive_user_ticker",
        "deep_dive_reports",
        ["user_id", "ticker"],
    )


def downgrade() -> None:
    op.drop_index("ix_deep_dive_user_ticker", table_name="deep_dive_reports")
    op.drop_index("ix_deep_dive_user_requested", table_name="deep_dive_reports")
    op.drop_table("deep_dive_reports")
