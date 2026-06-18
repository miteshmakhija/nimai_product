"""app_config table

Revision ID: j1e2f3g4h5i6
Revises: i0d1e2f3g4h5
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'j1e2f3g4h5i6'
down_revision = 'i0d1e2f3g4h5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("""
            CREATE TABLE IF NOT EXISTS app_config (
                id UUID NOT NULL PRIMARY KEY,
                key VARCHAR(100) NOT NULL UNIQUE,
                label VARCHAR(255) NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                field_type VARCHAR(20) NOT NULL DEFAULT 'text',
                required BOOLEAN NOT NULL DEFAULT false,
                enabled BOOLEAN NOT NULL DEFAULT true,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        """)
    else:
        op.create_table(
            'app_config',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('key', sa.String(100), nullable=False, unique=True),
            sa.Column('label', sa.String(255), nullable=False),
            sa.Column('value', sa.Text(), nullable=False, server_default=''),
            sa.Column('field_type', sa.String(20), nullable=False, server_default='text'),
            sa.Column('required', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    op.drop_table('app_config')
