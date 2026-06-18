"""fix users schema drift — rename display_name→full_name, add SSO/approver columns

Revision ID: g8b9c0d1e2f3
Revises: f6a7b8c9d0e1
Create Date: 2026-06-18

Fixes:
- users.display_name renamed to full_name (model uses full_name)
- users: add auth_provider, external_id, can_approve (from b2c3d4e5f6a7, missed in this env)
- users.password_hash made nullable (SSO readiness)
"""
from alembic import op
import sqlalchemy as sa

revision = 'g8b9c0d1e2f3'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        # Rename display_name → full_name if display_name exists
        row = bind.execute(sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='display_name'"
        )).fetchone()
        if row:
            op.execute("ALTER TABLE users RENAME COLUMN display_name TO full_name")

        # Add SSO / approver columns if missing
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false")
        op.execute("CREATE INDEX IF NOT EXISTS ix_users_external_id ON users (external_id)")
        op.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
    else:
        with op.batch_alter_table('users') as batch:
            batch.alter_column('display_name', new_column_name='full_name')
            batch.add_column(sa.Column('auth_provider', sa.String(20), nullable=False, server_default='local'))
            batch.add_column(sa.Column('external_id', sa.String(255), nullable=True))
            batch.add_column(sa.Column('can_approve', sa.Boolean(), nullable=False, server_default='false'))
            batch.alter_column('password_hash', existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL")
        op.execute("DROP INDEX IF EXISTS ix_users_external_id")
        op.execute("ALTER TABLE users DROP COLUMN IF EXISTS can_approve")
        op.execute("ALTER TABLE users DROP COLUMN IF EXISTS external_id")
        op.execute("ALTER TABLE users DROP COLUMN IF EXISTS auth_provider")
        op.execute("ALTER TABLE users RENAME COLUMN full_name TO display_name")
    else:
        with op.batch_alter_table('users') as batch:
            batch.alter_column('password_hash', existing_type=sa.Text(), nullable=False)
            batch.drop_column('can_approve')
            batch.drop_column('external_id')
            batch.drop_column('auth_provider')
            batch.alter_column('full_name', new_column_name='display_name')
