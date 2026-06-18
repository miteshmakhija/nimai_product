import type { RfqRun } from '../types';

export interface CombinedStatus {
  label: string;
  cls: string;
  pulse: boolean;
}

const PROCESSING = new Set(['queued', 'parsing', 'extracting', 'retrieving', 'generating']);
const ACTION_REQUIRED = new Set(['pending_confirmation', 'pending_data']);

export function getCombinedStatus(run: RfqRun): CombinedStatus {
  if (PROCESSING.has(run.status)) {
    return { label: 'Processing…', cls: 'badge-info', pulse: true };
  }
  if (ACTION_REQUIRED.has(run.status)) {
    return { label: 'Action Required', cls: 'badge-warning', pulse: true };
  }
  if (run.status === 'failed') {
    return { label: 'Failed', cls: 'badge-error', pulse: false };
  }
  const state = run.approval_state ?? 'none';
  if (state === 'in_review') {
    return { label: 'Awaiting Approval', cls: 'badge-warning', pulse: true };
  }
  if (state === 'changes_requested') {
    return { label: 'Changes Requested', cls: 'badge-error', pulse: false };
  }
  if (state === 'approved') {
    return { label: 'Approved', cls: 'badge-success', pulse: false };
  }
  if (state === 'sent_to_customer') {
    return { label: 'Sent to Customer', cls: 'badge-info', pulse: false };
  }
  if (state === 'customer_approved') {
    return { label: 'Customer Approved', cls: 'bg-emerald-500/15 text-emerald-600', pulse: false };
  }
  return { label: 'Quote Ready', cls: 'badge-ghost', pulse: false };
}

export function StatusBadge({ status, run }: { status?: string; run?: RfqRun }) {
  if (run) {
    const { label, cls, pulse } = getCombinedStatus(run);
    const isDaisyUI = cls.startsWith('badge-');
    return (
      <span className={`badge badge-sm gap-1 ${isDaisyUI ? cls : cls}`}>
        {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        {label}
      </span>
    );
  }
  // Legacy fallback for callers that only have a status string
  const label = status?.replace(/_/g, ' ') ?? '';
  return <span className="badge badge-sm badge-ghost capitalize">{label}</span>;
}

export default StatusBadge;
