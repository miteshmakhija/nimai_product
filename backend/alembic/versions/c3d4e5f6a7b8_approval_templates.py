"""approval_templates — admin-managed workflow templates

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-14 00:00:00.000000

Adds:
- approval_templates table: id, name, description, stages (JSONB), created_by, is_active, timestamps
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("""
            CREATE TABLE IF NOT EXISTS approval_templates (
                id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                description TEXT,
                stages JSONB NOT NULL DEFAULT '[]',
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        op.execute("CREATE INDEX IF NOT EXISTS ix_approval_templates_is_active ON approval_templates (is_active)")
    else:
        op.create_table(
            'approval_templates',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('stages', sa.Text(), nullable=False, server_default='[]'),
            sa.Column('created_by', sa.CHAR(36), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_approval_templates_is_active', 'approval_templates', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_approval_templates_is_active', table_name='approval_templates')
    op.drop_table('approval_templates')
