"""add metadata datapoints and content

Revision ID: a1b2c3d4e5f6
Revises: 27c9e7a3bfc9
Create Date: 2026-06-13 00:00:00.000000

Adds:
- product_required_fields table
- rfq_data_points table
- 8 new columns on rfq_runs (meta_*, data_confirmed, edited_content, similar_run_ids)
- 2 new enum values on run_status (pending_confirmation, pending_data)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = '27c9e7a3bfc9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new enum values to run_status (Postgres only; SQLite uses string)
    op.execute("ALTER TYPE run_status ADD VALUE IF NOT EXISTS 'pending_confirmation' AFTER 'extracting'")
    op.execute("ALTER TYPE run_status ADD VALUE IF NOT EXISTS 'pending_data' AFTER 'pending_confirmation'")

    # New table: product_required_fields
    op.create_table(
        'product_required_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_name', sa.String(255), nullable=False),
        sa.Column('fields', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_required_fields_product_name', 'product_required_fields', ['product_name'], unique=True)

    # New table: rfq_data_points
    op.create_table(
        'rfq_data_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('field_key', sa.String(100), nullable=False),
        sa.Column('field_label', sa.String(255), nullable=True),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('source', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['rfq_runs.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rfq_data_points_run_id', 'rfq_data_points', ['run_id'], unique=False)

    # New columns on rfq_runs
    op.add_column('rfq_runs', sa.Column('meta_company_name', sa.String(255), nullable=True))
    op.add_column('rfq_runs', sa.Column('meta_product', sa.String(255), nullable=True))
    op.add_column('rfq_runs', sa.Column('meta_rfq_date', sa.String(50), nullable=True))
    op.add_column('rfq_runs', sa.Column('meta_rfq_number', sa.String(100), nullable=True))
    op.add_column('rfq_runs', sa.Column('meta_confirmed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('rfq_runs', sa.Column('data_confirmed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('rfq_runs', sa.Column('edited_content', sa.Text(), nullable=True))
    op.add_column('rfq_runs', sa.Column('similar_run_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.create_index('ix_rfq_runs_meta_company_name', 'rfq_runs', ['meta_company_name'], unique=False)
    op.create_index('ix_rfq_runs_meta_product', 'rfq_runs', ['meta_product'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_rfq_runs_meta_product', table_name='rfq_runs')
    op.drop_index('ix_rfq_runs_meta_company_name', table_name='rfq_runs')
    op.drop_column('rfq_runs', 'similar_run_ids')
    op.drop_column('rfq_runs', 'edited_content')
    op.drop_column('rfq_runs', 'data_confirmed')
    op.drop_column('rfq_runs', 'meta_confirmed')
    op.drop_column('rfq_runs', 'meta_rfq_number')
    op.drop_column('rfq_runs', 'meta_rfq_date')
    op.drop_column('rfq_runs', 'meta_product')
    op.drop_column('rfq_runs', 'meta_company_name')

    op.drop_index('ix_rfq_data_points_run_id', table_name='rfq_data_points')
    op.drop_table('rfq_data_points')

    op.drop_index('ix_product_required_fields_product_name', table_name='product_required_fields')
    op.drop_table('product_required_fields')
    # Note: enum values added to run_status cannot be removed in Postgres without recreation
