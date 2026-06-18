# app/models/db.py
import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, JSON, Integer, Boolean, UniqueConstraint
from sqlalchemy import Enum as SAEnum, types as sa_types
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship


class UUID(sa_types.TypeDecorator):
    """Platform-independent UUID type.
    Stores as CHAR(36) on any DB, but on PostgreSQL delegates to the native
    UUID type so Alembic migrations generate the correct column type.
    """
    impl = sa_types.CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(sa_types.CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


class JSONB(sa_types.TypeDecorator):
    """JSONB on PostgreSQL, JSON text on other DBs."""
    impl = sa_types.Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
            return dialect.type_descriptor(PG_JSONB())
        return dialect.type_descriptor(sa_types.Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        import json
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        import json
        return json.loads(value) if isinstance(value, str) else value

Base = declarative_base()


# ── Existing models (unchanged) ──────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    uploaded_filename = Column(String(255))
    uploaded_file_path = Column(Text)

    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")
    rfqs = relationship("RFQ", back_populates="conversation", cascade="all, delete-orphan")
    quotes = relationship("Quote", back_populates="conversation", cascade="all, delete-orphan")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON)

    conversation = relationship("Conversation", back_populates="messages")


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    raw_text = Column(Text)
    structured_data = Column(JSON)
    completeness_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="rfqs")
    quotes = relationship("Quote", back_populates="rfq", cascade="all, delete-orphan")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    content = Column(Text, nullable=False)
    template_version = Column(String(50))
    similar_docs_used = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="draft")

    rfq = relationship("RFQ", back_populates="quotes")
    conversation = relationship("Conversation", back_populates="quotes")


# ── New enums ─────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    end_user = "end_user"


class RunStatus(str, enum.Enum):
    queued = "queued"
    parsing = "parsing"
    extracting = "extracting"
    pending_confirmation = "pending_confirmation"
    pending_data = "pending_data"
    retrieving = "retrieving"
    generating = "generating"
    done = "done"
    failed = "failed"


class InputType(str, enum.Enum):
    file = "file"
    text = "text"


class ApprovalState(str, enum.Enum):
    """Denormalized approval status on RfqRun for cheap UI reads."""
    none = "none"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    changes_requested = "changes_requested"
    sent_to_customer = "sent_to_customer"
    customer_approved = "customer_approved"


class ApprovalRequestStatus(str, enum.Enum):
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class ApprovalStageStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    approved = "approved"
    rejected = "rejected"
    skipped = "skipped"


class ApprovalDecision(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ── New models ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False, default="")
    # Nullable: SSO users have no local password.
    password_hash = Column(Text, nullable=True)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.end_user)
    is_active = Column(Boolean, nullable=False, default=True)
    # ── SSO readiness + approver capability ──
    auth_provider = Column(String(20), nullable=False, default="local")  # local | oidc | saml
    external_id = Column(String(255), nullable=True, index=True)         # IdP subject claim
    can_approve = Column(Boolean, nullable=False, default=False)         # dedicated approver capability
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(64), nullable=False, index=True)
    product_name = Column(String(255), nullable=True, index=True)  # NULL = default/global
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    active_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_versions.id", use_alter=True, name="fk_prompt_active_version"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship(
        "PromptVersion",
        back_populates="prompt",
        foreign_keys="PromptVersion.prompt_id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("key", "product_name", name="uq_prompt_key_product"),
    )


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    note = Column(Text, default="")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    prompt = relationship("Prompt", back_populates="versions", foreign_keys=[prompt_id])


class RfqRun(Base):
    __tablename__ = "rfq_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(String(255), nullable=True, index=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    input_type = Column(SAEnum(InputType, name="input_type"), nullable=False)
    source_filename = Column(String(255), nullable=True)
    source_text = Column(Text, nullable=True)
    status = Column(SAEnum(RunStatus, name="run_status"), nullable=False, default=RunStatus.queued)
    prompt_version_id = Column(UUID(as_uuid=True), ForeignKey("prompt_versions.id"), nullable=True)
    result_json = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Step 2 metadata fields
    meta_company_name = Column(String(255), nullable=True, index=True)
    meta_product = Column(String(255), nullable=True, index=True)
    meta_rfq_date = Column(String(50), nullable=True)
    meta_rfq_number = Column(String(100), nullable=True)
    meta_confirmed = Column(Boolean, nullable=False, default=False)

    # Step 3 data completeness
    data_confirmed = Column(Boolean, nullable=False, default=False)

    # TipTap edited HTML (saved after user edits)
    edited_content = Column(Text, nullable=True)

    # Similar run IDs saved after FAISS retrieval (for future UI)
    similar_run_ids = Column(JSONB, nullable=True)

    # Denormalized approval status for cheap UI reads (source of truth = approval_requests)
    approval_state = Column(
        SAEnum(ApprovalState, name="approval_state"),
        nullable=False,
        default=ApprovalState.none,
    )

    # Customer lifecycle — set after internal approval
    customer_approved_at = Column(DateTime, nullable=True)
    customer_po_reference = Column(String(120), nullable=True)

    data_points = relationship("RfqDataPoint", back_populates="run", cascade="all, delete-orphan")
    approval_requests = relationship(
        "ApprovalRequest", back_populates="run", cascade="all, delete-orphan"
    )


class ProductRequiredFields(Base):
    __tablename__ = "product_required_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_name = Column(String(255), unique=True, nullable=False, index=True)
    fields = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RfqDataPoint(Base):
    __tablename__ = "rfq_data_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("rfq_runs.id"), nullable=False, index=True)
    field_key = Column(String(100), nullable=False)
    field_label = Column(String(255), nullable=True)
    value = Column(Text, nullable=True)
    source = Column(String(20), nullable=True)  # "extracted" or "user_input"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    run = relationship("RfqRun", back_populates="data_points")


# ── Approval workflow ───────────────────────────────────────────────────────────

class ApprovalRequest(Base):
    """One per 'send for approval' on a run. A run may have several over its life
    (each resubmission creates a new request; old ones are preserved as history).
    """
    __tablename__ = "approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("rfq_runs.id"), nullable=False, index=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(
        SAEnum(ApprovalRequestStatus, name="approval_request_status"),
        nullable=False,
        default=ApprovalRequestStatus.in_review,
    )
    current_stage_index = Column(Integer, nullable=False, default=0)
    template_id = Column(UUID(as_uuid=True), ForeignKey("approval_templates.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    run = relationship("RfqRun", back_populates="approval_requests")
    template = relationship("ApprovalTemplate")
    stages = relationship(
        "ApprovalStage",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ApprovalStage.stage_index",
    )


class ApprovalStage(Base):
    """Ordered sequential stage within a request. Passes on quorum (required_count)."""
    __tablename__ = "approval_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("approval_requests.id"), nullable=False, index=True)
    stage_index = Column(Integer, nullable=False)  # 0,1,2… execution order
    name = Column(String(255), nullable=False, default="")
    required_count = Column(Integer, nullable=False, default=1)  # quorum M (N = len(assignments))
    status = Column(
        SAEnum(ApprovalStageStatus, name="approval_stage_status"),
        nullable=False,
        default=ApprovalStageStatus.pending,
    )

    request = relationship("ApprovalRequest", back_populates="stages")
    assignments = relationship(
        "ApprovalAssignment",
        back_populates="stage",
        cascade="all, delete-orphan",
    )


class ApprovalAssignment(Base):
    """A parallel approver within a stage, and their individual decision."""
    __tablename__ = "approval_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("approval_stages.id"), nullable=False, index=True)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    decision = Column(
        SAEnum(ApprovalDecision, name="approval_decision"),
        nullable=False,
        default=ApprovalDecision.pending,
    )
    comment = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)

    stage = relationship("ApprovalStage", back_populates="assignments")
    approver = relationship("User", foreign_keys=[approver_id])


class ApprovalTemplate(Base):
    """Admin-managed reusable approval workflow template.

    stages is a JSONB list of {name, required_count, department_hint} dicts.
    Approver IDs are NOT stored — templates describe structure, not individuals.
    The submitter picks actual approvers at send-time after loading a template.
    """
    __tablename__ = "approval_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    stages = Column(JSONB, nullable=False, default=list)  # [{name, required_count, department_hint}]
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DocxTemplateRecord(Base):
    """Stores a customer-uploaded .docx template blob. Single active row per installation."""
    __tablename__ = "docx_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    template_blob = Column(sa_types.LargeBinary, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, nullable=False, default=True)


class AppConfig(Base):
    """Per-key company config row. Required rows cannot be deleted."""
    __tablename__ = "app_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), nullable=False, unique=True)
    label = Column(String(255), nullable=False)
    value = Column(Text, nullable=False, default="")
    field_type = Column(String(20), nullable=False, default="text")
    required = Column(Boolean, nullable=False, default=False)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
