"""add users.updated_at column

Revision ID: h9c0d1e2f3g4
Revises: g8b9c0d1e2f3
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'h9c0d1e2f3g4'
down_revision = 'g8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()"
        )
    else:
        op.add_column('users', sa.Column(
            'updated_at', sa.DateTime(), nullable=False,
            server_default=sa.func.now()
        ))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TABLE users DROP COLUMN IF EXISTS updated_at")
    else:
        op.drop_column('users', 'updated_at')
