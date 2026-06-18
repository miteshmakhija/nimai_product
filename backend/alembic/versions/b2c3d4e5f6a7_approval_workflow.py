"""approval workflow — user SSO fields, approval tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14 00:00:00.000000

Adds:
- users: auth_provider, external_id, can_approve; password_hash → nullable
- rfq_runs: approval_state column
- New tables: approval_requests, approval_stages, approval_assignments
- New enums: approval_state, approval_request_status, approval_stage_status, approval_decision
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # ── New enums (Postgres) ──────────────────────────────────────────────────
    if is_pg:
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE approval_state AS ENUM
                    ('none','in_review','approved','rejected','changes_requested');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """)
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE approval_request_status AS ENUM
                    ('in_review','approved','rejected','cancelled');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """)
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE approval_stage_status AS ENUM
                    ('pending','active','approved','rejected','skipped');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """)
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE approval_decision AS ENUM
                    ('pending','approved','rejected');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """)

    # ── users: SSO readiness + approver capability ────────────────────────────
    # Use IF NOT EXISTS guards in case migration partially ran before
    if is_pg:
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false")
        op.execute("CREATE INDEX IF NOT EXISTS ix_users_external_id ON users (external_id)")
        op.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
    else:
        op.add_column('users', sa.Column('auth_provider', sa.String(20), nullable=False, server_default='local'))
        op.add_column('users', sa.Column('external_id', sa.String(255), nullable=True))
        op.add_column('users', sa.Column('can_approve', sa.Boolean(), nullable=False, server_default='false'))
        op.create_index('ix_users_external_id', 'users', ['external_id'], unique=False)
        op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=True)

    # ── rfq_runs: denormalized approval state ─────────────────────────────────
    if is_pg:
        op.execute("""
            DO $$ BEGIN
                ALTER TABLE rfq_runs ADD COLUMN approval_state approval_state NOT NULL DEFAULT 'none';
            EXCEPTION WHEN duplicate_column THEN NULL; END $$
        """)
    else:
        op.add_column('rfq_runs', sa.Column('approval_state', sa.String(30), nullable=False, server_default='none'))

    # ── approval_requests ─────────────────────────────────────────────────────
    # Use raw SQL for Postgres tables so sa.Enum doesn't try to re-create enum types
    # that were already created above via DO $$ BEGIN blocks.
    if is_pg:
        op.execute("""
            CREATE TABLE approval_requests (
                id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                run_id UUID NOT NULL REFERENCES rfq_runs(id),
                submitted_by UUID NOT NULL REFERENCES users(id),
                status approval_request_status NOT NULL DEFAULT 'in_review',
                current_stage_index INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP
            )
        """)
        op.execute("CREATE INDEX ix_approval_requests_run_id ON approval_requests (run_id)")

        op.execute("""
            CREATE TABLE approval_stages (
                id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                request_id UUID NOT NULL REFERENCES approval_requests(id),
                stage_index INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL DEFAULT '',
                required_count INTEGER NOT NULL DEFAULT 1,
                status approval_stage_status NOT NULL DEFAULT 'pending'
            )
        """)
        op.execute("CREATE INDEX ix_approval_stages_request_id ON approval_stages (request_id)")

        op.execute("""
            CREATE TABLE approval_assignments (
                id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                stage_id UUID NOT NULL REFERENCES approval_stages(id),
                approver_id UUID NOT NULL REFERENCES users(id),
                decision approval_decision NOT NULL DEFAULT 'pending',
                comment TEXT,
                decided_at TIMESTAMP
            )
        """)
        op.execute("CREATE INDEX ix_approval_assignments_stage_id ON approval_assignments (stage_id)")
        op.execute("CREATE INDEX ix_approval_assignments_approver_id ON approval_assignments (approver_id)")
    else:
        op.create_table(
            'approval_requests',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('run_id', sa.CHAR(36), nullable=False),
            sa.Column('submitted_by', sa.CHAR(36), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='in_review'),
            sa.Column('current_stage_index', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['run_id'], ['rfq_runs.id']),
            sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_approval_requests_run_id', 'approval_requests', ['run_id'])

        op.create_table(
            'approval_stages',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('request_id', sa.CHAR(36), nullable=False),
            sa.Column('stage_index', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(255), nullable=False, server_default=''),
            sa.Column('required_count', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.ForeignKeyConstraint(['request_id'], ['approval_requests.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_approval_stages_request_id', 'approval_stages', ['request_id'])

        op.create_table(
            'approval_assignments',
            sa.Column('id', sa.CHAR(36), nullable=False),
            sa.Column('stage_id', sa.CHAR(36), nullable=False),
            sa.Column('approver_id', sa.CHAR(36), nullable=False),
            sa.Column('decision', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('comment', sa.Text(), nullable=True),
            sa.Column('decided_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['stage_id'], ['approval_stages.id']),
            sa.ForeignKeyConstraint(['approver_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_approval_assignments_stage_id', 'approval_assignments', ['stage_id'])
        op.create_index('ix_approval_assignments_approver_id', 'approval_assignments', ['approver_id'])


def downgrade() -> None:
    op.drop_index('ix_approval_assignments_approver_id', table_name='approval_assignments')
    op.drop_index('ix_approval_assignments_stage_id', table_name='approval_assignments')
    op.drop_table('approval_assignments')

    op.drop_index('ix_approval_stages_request_id', table_name='approval_stages')
    op.drop_table('approval_stages')

    op.drop_index('ix_approval_requests_run_id', table_name='approval_requests')
    op.drop_table('approval_requests')

    op.drop_column('rfq_runs', 'approval_state')
    op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=False)
    op.drop_index('ix_users_external_id', table_name='users')
    op.drop_column('users', 'can_approve')
    op.drop_column('users', 'external_id')
    op.drop_column('users', 'auth_provider')
