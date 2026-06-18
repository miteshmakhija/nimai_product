export type UserRole = 'super_admin' | 'admin' | 'end_user';
export type RunStatus =
  | 'queued'
  | 'parsing'
  | 'extracting'
  | 'pending_confirmation'
  | 'pending_data'
  | 'retrieving'
  | 'generating'
  | 'done'
  | 'failed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  note: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  key: string;
  product_name: string | null;
  name: string;
  description: string;
  active_version_id: string | null;
}

export interface DataPoint {
  key: string;
  label: string | null;
  value: string | null;
  source: string | null;
  required: boolean;
}

export interface RfqRun {
  id: string;
  status: RunStatus;
  input_type: 'file' | 'text';
  source_filename: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  result_json: Record<string, unknown> | null;
  meta_company_name: string | null;
  meta_product: string | null;
  meta_rfq_date: string | null;
  meta_rfq_number: string | null;
  meta_confirmed: boolean;
  data_confirmed: boolean;
  edited_content: string | null;
  similar_run_ids: string[] | null;
  data_points: DataPoint[] | null;
  approval_state?: 'none' | 'in_review' | 'approved' | 'rejected' | 'changes_requested' | 'sent_to_customer' | 'customer_approved';
  customer_approved_at?: string | null;
  customer_po_reference?: string | null;
}

export interface RfqExtractResponse {
  run_id: string;
  status: RunStatus;
  meta_company_name: string | null;
  meta_product: string | null;
  meta_rfq_date: string | null;
  meta_rfq_number: string | null;
  data_points: DataPoint[];
}

export interface Metrics {
  total: number;
  succeeded: number;
  failed: number;
  success_rate: number;
  avg_seconds: number | null;
  volume_by_day: { day: string; count: number }[];
}

export interface ProductFieldDef {
  key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[];
}

export interface ProductField {
  id: string;
  product_name: string;
  fields: ProductFieldDef[];
  created_at: string;
  updated_at: string;
}

// ── Approval workflow ─────────────────────────────────────────────────────────

export interface Approver {
  id: string;
  email: string;
  full_name: string;
}

export interface ApprovalAssignment {
  id: string;
  approver_id: string;
  approver_name?: string | null;
  approver_email?: string | null;
  decision: 'pending' | 'approved' | 'rejected';
  comment?: string | null;
  decided_at?: string | null;
}

export interface ApprovalStage {
  id: string;
  stage_index: number;
  name: string;
  required_count: number;
  status: 'pending' | 'active' | 'approved' | 'rejected' | 'skipped';
  assignments: ApprovalAssignment[];
}

// ── Approval templates ────────────────────────────────────────────────────────

export interface TemplateStage {
  name: string;
  required_count: number;
  department_hint?: string | null;
  approver_ids?: string[];
}

export interface ApprovalTemplate {
  id: string;
  name: string;
  description?: string | null;
  stages: TemplateStage[];
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  run_id: string;
  submitted_by: string;
  status: 'in_review' | 'approved' | 'rejected' | 'cancelled';
  current_stage_index: number;
  created_at: string;
  completed_at?: string | null;
  stages: ApprovalStage[];
}
