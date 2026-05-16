"""Generic user key-value store for cloud-synced JSON data.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_kv_store",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("data", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("user_id", "key", name="uq_user_kv_store_user_key"),
    )
    op.create_index("idx_kv_store_user_key", "user_kv_store", ["user_id", "key"])


def downgrade() -> None:
    op.drop_index("idx_kv_store_user_key")
    op.drop_table("user_kv_store")
