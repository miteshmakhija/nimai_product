"""customer_lifecycle — sent_to_customer + customer_approved states

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-15 00:00:00.000000

Adds:
- Two new approval_state enum values: sent_to_customer, customer_approved
- customer_approved_at (DateTime, nullable) on rfq_runs
- customer_po_reference (String(120), nullable) on rfq_runs
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TYPE approval_state ADD VALUE IF NOT EXISTS 'sent_to_customer'")
        op.execute("ALTER TYPE approval_state ADD VALUE IF NOT EXISTS 'customer_approved'")

    op.add_column('rfq_runs', sa.Column('customer_approved_at', sa.DateTime(), nullable=True))
    op.add_column('rfq_runs', sa.Column('customer_po_reference', sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column('rfq_runs', 'customer_po_reference')
    op.drop_column('rfq_runs', 'customer_approved_at')
    # Postgres enum values cannot be removed without recreation — leave enum as-is on downgrade
