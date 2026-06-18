"""prompt product scope

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prompts', sa.Column('product_name', sa.String(length=255), nullable=True))
    op.create_index('ix_prompts_product_name', 'prompts', ['product_name'])
    # Drop old unique(key) only if it exists (may not exist in all envs)
    conn = op.get_bind()
    row = conn.execute(text(
        "SELECT conname FROM pg_constraint "
        "WHERE conrelid='prompts'::regclass AND contype='u' AND conname='prompts_key_key'"
    )).fetchone()
    if row:
        with op.batch_alter_table('prompts') as batch:
            batch.drop_constraint('prompts_key_key', type_='unique')
    op.create_unique_constraint('uq_prompt_key_product', 'prompts', ['key', 'product_name'])


def downgrade():
    op.drop_constraint('uq_prompt_key_product', 'prompts', type_='unique')
    op.drop_index('ix_prompts_product_name', table_name='prompts')
    op.create_unique_constraint('prompts_key_key', 'prompts', ['key'])
    op.drop_column('prompts', 'product_name')
