"""initial_schema

Revision ID: 27c9e7a3bfc9
Revises:
Create Date: 2026-06-13 14:26:35.232249

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '27c9e7a3bfc9'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('conversations',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('uploaded_filename', sa.String(length=255), nullable=True),
    sa.Column('uploaded_file_path', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('prompts',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('active_version_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['active_version_id'], ['prompt_versions.id'],
                            name='fk_prompt_active_version', use_alter=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prompts_key'), 'prompts', ['key'], unique=True)
    op.create_table('users',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('role', sa.Enum('super_admin', 'admin', 'end_user', name='user_role'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('conversation_messages',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('message_metadata', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('prompt_versions',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('prompt_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('rfqs',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('raw_text', sa.Text(), nullable=True),
    sa.Column('structured_data', sa.JSON(), nullable=True),
    sa.Column('completeness_score', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('quotes',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('rfq_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('template_version', sa.String(length=50), nullable=True),
    sa.Column('similar_docs_used', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
    sa.ForeignKeyConstraint(['rfq_id'], ['rfqs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('rfq_runs',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('task_id', sa.String(length=255), nullable=True),
    sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('input_type', sa.Enum('file', 'text', name='input_type'), nullable=False),
    sa.Column('source_filename', sa.String(length=255), nullable=True),
    sa.Column('source_text', sa.Text(), nullable=True),
    sa.Column('status', sa.Enum('queued', 'parsing', 'extracting', 'retrieving', 'generating', 'done', 'failed',
                                name='run_status'), nullable=False),
    sa.Column('prompt_version_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('result_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['prompt_version_id'], ['prompt_versions.id'], ),
    sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rfq_runs_task_id'), 'rfq_runs', ['task_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_rfq_runs_task_id'), table_name='rfq_runs')
    op.drop_table('rfq_runs')
    op.drop_table('quotes')
    op.drop_table('rfqs')
    op.drop_table('prompt_versions')
    op.drop_table('conversation_messages')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_prompts_key'), table_name='prompts')
    op.drop_table('prompts')
    op.drop_table('conversations')
