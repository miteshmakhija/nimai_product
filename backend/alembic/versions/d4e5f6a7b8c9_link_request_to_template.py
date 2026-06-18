"""link approval_requests to template for live stage names

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-15 00:00:00.000000

Adds:
- approval_requests.template_id (nullable UUID FK -> approval_templates.id)
  Used to resolve live stage names from the template at display time.
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute(
            "ALTER TABLE approval_requests "
            "ADD COLUMN IF NOT EXISTS template_id UUID "
            "REFERENCES approval_templates(id) ON DELETE SET NULL"
        )
    else:
        with op.batch_alter_table('approval_requests') as batch:
            batch.add_column(sa.Column('template_id', sa.CHAR(36), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TABLE approval_requests DROP COLUMN IF EXISTS template_id")
    else:
        with op.batch_alter_table('approval_requests') as batch:
            batch.drop_column('template_id')
