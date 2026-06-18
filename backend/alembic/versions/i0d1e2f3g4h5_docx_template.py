"""docx template table

Revision ID: i0d1e2f3g4h5
Revises: h9c0d1e2f3g4
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'i0d1e2f3g4h5'
down_revision = 'h9c0d1e2f3g4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("""
            CREATE TABLE IF NOT EXISTS docx_templates (
                id UUID NOT NULL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                template_blob BYTEA NOT NULL,
                uploaded_by UUID NOT NULL REFERENCES users(id),
                uploaded_at TIMESTAMP NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true
            )
        """)
    else:
        op.create_table(
            'docx_templates',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('template_blob', sa.LargeBinary(), nullable=False),
            sa.Column('uploaded_by', sa.CHAR(36), nullable=False),
            sa.Column('uploaded_at', sa.DateTime(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    op.drop_table('docx_templates')
