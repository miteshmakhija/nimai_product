"""Pydantic schemas."""
# app/models/schemas.py
from pydantic import BaseModel, EmailStr, Field
from typing import Any, List, Optional


# ── Existing ──────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: float
    unit: Optional[str] = None


class RFQSchema(BaseModel):
    customer_name: Optional[str] = None
    project_name: Optional[str] = None
    industry: Optional[str] = None
    due_date: Optional[str] = None
    line_items: List[LineItem] = []
    technical_requirements: Optional[str] = None
    commercial_terms: Optional[str] = None
    notes: Optional[str] = None


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    auth_provider: str = "local"
    can_approve: bool = False

    class Config:
        from_attributes = True


# ── Users management ──────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    full_name: str = ""
    role: str = "end_user"
    auth_provider: str = "local"
    external_id: Optional[str] = None
    can_approve: bool = False


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    can_approve: Optional[bool] = None
    auth_provider: Optional[str] = None


# ── Prompts ───────────────────────────────────────────────────────────────────

class PromptVersionOut(BaseModel):
    id: str
    version: int
    content: str
    note: str
    created_at: str

    class Config:
        from_attributes = True


class PromptOut(BaseModel):
    id: str
    key: str
    product_name: Optional[str] = None
    name: str
    description: str
    active_version_id: Optional[str] = None

    class Config:
        from_attributes = True


class NewVersionRequest(BaseModel):
    content: str
    note: str = ""


class SetActiveRequest(BaseModel):
    version_id: str


# ── RFQ runs ──────────────────────────────────────────────────────────────────

class DataPointOut(BaseModel):
    key: str
    label: Optional[str] = None
    value: Optional[str] = None
    source: Optional[str] = None
    required: bool = False

    class Config:
        from_attributes = True


class RfqRunOut(BaseModel):
    id: str
    status: str
    input_type: str
    source_filename: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
    result_json: Optional[Any] = None
    meta_company_name: Optional[str] = None
    meta_product: Optional[str] = None
    meta_rfq_date: Optional[str] = None
    meta_rfq_number: Optional[str] = None
    meta_confirmed: bool = False
    data_confirmed: bool = False
    edited_content: Optional[str] = None
    similar_run_ids: Optional[List[str]] = None
    data_points: Optional[List[DataPointOut]] = None
    approval_state: str = "none"
    customer_approved_at: Optional[str] = None
    customer_po_reference: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerApprovedRequest(BaseModel):
    customer_approved_at: str  # ISO date string e.g. "2026-06-15"
    customer_po_reference: Optional[str] = None


class TextRfqRequest(BaseModel):
    text: str
    product_name: Optional[str] = None


# ── Three-step flow ───────────────────────────────────────────────────────────

class DataPointInput(BaseModel):
    key: str
    value: Optional[str] = None


class RfqExtractResponse(BaseModel):
    run_id: str
    status: str
    meta_company_name: Optional[str] = None
    meta_product: Optional[str] = None
    meta_rfq_date: Optional[str] = None
    meta_rfq_number: Optional[str] = None
    data_points: List[DataPointOut] = []


class RfqConfirmRequest(BaseModel):
    meta_company_name: Optional[str] = None
    meta_product: Optional[str] = None
    meta_rfq_date: Optional[str] = None
    meta_rfq_number: Optional[str] = None
    data_points: List[DataPointInput] = []


class RfqConfirmResponse(BaseModel):
    run_id: str
    status: str
    data_points: List[DataPointOut] = []


class RfqDataSubmitRequest(BaseModel):
    data_points: List[DataPointInput]


class RfqContentUpdate(BaseModel):
    content: str


# ── Products ──────────────────────────────────────────────────────────────────

class ProductFieldDef(BaseModel):
    key: str
    label: str
    field_type: str = "text"
    required: bool = True
    options: Optional[List[str]] = None


class ProductFieldsIn(BaseModel):
    fields: List[ProductFieldDef]


class ProductFieldsOut(BaseModel):
    id: str
    product_name: str
    fields: List[Any]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ── Approval workflow ─────────────────────────────────────────────────────────

class ApproverOut(BaseModel):
    id: str
    email: str
    full_name: str

    class Config:
        from_attributes = True


class ApprovalStageIn(BaseModel):
    name: str = ""
    required_count: int = 1
    approver_ids: List[str]


class SubmitApprovalRequest(BaseModel):
    stages: List[ApprovalStageIn]
    template_id: Optional[str] = None


class AssignmentOut(BaseModel):
    id: str
    approver_id: str
    approver_name: Optional[str] = None
    approver_email: Optional[str] = None
    decision: str
    comment: Optional[str] = None
    decided_at: Optional[str] = None

    class Config:
        from_attributes = True


class StageOut(BaseModel):
    id: str
    stage_index: int
    name: str
    required_count: int
    status: str
    assignments: List[AssignmentOut] = []

    class Config:
        from_attributes = True


class ApprovalRequestOut(BaseModel):
    id: str
    run_id: str
    submitted_by: str
    status: str
    current_stage_index: int
    created_at: str
    completed_at: Optional[str] = None
    stages: List[StageOut] = []

    class Config:
        from_attributes = True


class DecideRequest(BaseModel):
    decision: str  # "approved" | "rejected"
    comment: Optional[str] = None


# ── Approval templates ────────────────────────────────────────────────────────

class TemplateStageIn(BaseModel):
    """One stage in a template — structure + pre-assigned approvers."""
    name: str = ""
    required_count: int = 1
    department_hint: Optional[str] = None  # e.g. "Finance", "Engineering"
    approver_ids: List[str] = []


class ApprovalTemplateIn(BaseModel):
    name: str
    description: Optional[str] = None
    stages: List[TemplateStageIn]
    is_active: bool = True


class ApprovalTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    stages: List[Any]
    is_active: bool
    created_by: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ── App Config ────────────────────────────────────────────────────────────────

class AppConfigItem(BaseModel):
    id: str
    key: str
    label: str
    value: str
    field_type: str
    required: bool
    enabled: bool
    sort_order: int

    class Config:
        from_attributes = True


class AppConfigItemUpdate(BaseModel):
    id: Optional[str] = None   # None = new row
    key: str
    label: str
    value: str
    field_type: str
    required: bool
    enabled: bool
    sort_order: int


class AppConfigIn(BaseModel):
    items: List[AppConfigItemUpdate]


# ── Metrics ───────────────────────────────────────────────────────────────────

class MetricsOut(BaseModel):
    total: int
    succeeded: int
    failed: int
    success_rate: float
    avg_seconds: Optional[float] = None
    volume_by_day: List[Any] = []
