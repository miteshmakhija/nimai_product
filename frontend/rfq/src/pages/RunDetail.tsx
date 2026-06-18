import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download, ChevronDown, Check, Loader2, AlertCircle,
  Send, ShieldCheck, X, Plus, Trash2, Users, LayoutTemplate,
} from 'lucide-react';
import { rfqApi, approvalApi, approvalTemplateApi } from '../api';
import type { RfqRun, ApprovalRequest, Approver, ApprovalTemplate } from '../types';
import StatusBadge from '../components/StatusBadge';
import TipTapEditor from '../components/TipTapEditor';
import { quoteJsonToHtml } from '../utils/quoteJsonToHtml';

const TERMINAL = new Set(['done', 'failed']);
const POLL_INTERVAL_MS = 3000;
const BRAND_GRADIENT = 'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

// ── Stage builder types ────────────────────────────────────────────────────────
interface StageInput {
  name: string;
  required_count: number;
  approver_ids: string[];
}

// ── Stage builder component ────────────────────────────────────────────────────
// Approver role within a stage is determined by position:
//   index 0          → Primary   (must approve unless quorum is satisfied by others)
//   index 1+         → Secondary (backup approvers)
// Quorum controls how many of all assignees must approve for the stage to pass.
// Example: quorum=1, 2 assignees → any one approver (primary OR secondary) is sufficient.

function approverRole(positionInStage: number): 'Primary' | 'Secondary' {
  return positionInStage === 0 ? 'Primary' : 'Secondary';
}

function StageBuilder({
  stages, onChange, approvers, templateApproverIds,
}: {
  stages: StageInput[];
  onChange: (s: StageInput[]) => void;
  approvers: Approver[];
  // Per-stage locked approver pool from template (index matches stages). Empty array = no template, show all.
  templateApproverIds: string[][];
}) {
  function addStage() {
    onChange([...stages, { name: `Stage ${stages.length + 1}`, required_count: 1, approver_ids: [] }]);
  }
  function removeStage(i: number) {
    onChange(stages.filter((_, idx) => idx !== i));
  }
  function updateStage(i: number, patch: Partial<StageInput>) {
    onChange(stages.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function toggleApprover(stageIdx: number, approverId: string) {
    const stage = stages[stageIdx];
    const next = stage.approver_ids.includes(approverId)
      ? stage.approver_ids.filter((id) => id !== approverId)
      : [...stage.approver_ids, approverId];
    // Keep quorum ≤ new assignee count, default to 1 when adding first person
    const newQuorum = Math.min(stage.required_count, Math.max(1, next.length));
    updateStage(stageIdx, { approver_ids: next, required_count: newQuorum });
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, i) => {
        const n = stage.approver_ids.length;
        const quorumLabel = n === 0 ? '' : stage.required_count === n
          ? 'All must approve'
          : stage.required_count === 1
          ? 'Any 1 approver is enough'
          : `Any ${stage.required_count} of ${n} must approve`;

        return (
          <div key={i} className="rounded-[14px] border border-border bg-input-background p-4">
            {/* Stage header */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <input
                value={stage.name}
                onChange={(e) => updateStage(i, { name: e.target.value })}
                placeholder={`Stage ${i + 1} name`}
                className="flex-1 rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
              />
              {stages.length > 1 && (
                <button onClick={() => removeStage(i)} className="text-muted-foreground hover:text-error">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Approver chips — first selected = Primary, rest = Secondary */}
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Approvers <span className="normal-case font-normal">(first selected = Primary)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  // Template-loaded stage: show only the template-assigned approvers (stable pool, not affected by toggle).
                  // Manual stage: show full system approver pool.
                  const lockedIds = templateApproverIds[i] ?? [];
                  const visibleApprovers = lockedIds.length > 0
                    ? approvers.filter((a) => lockedIds.includes(a.id))
                    : approvers;
                  return visibleApprovers.map((a) => {
                    const posInStage = stage.approver_ids.indexOf(a.id);
                    const sel = posInStage !== -1;
                    const role = sel ? approverRole(posInStage) : null;
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleApprover(i, a.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                          sel && role === 'Primary'
                            ? 'bg-brand text-white'
                            : sel
                            ? 'border border-brand/40 bg-brand/10 text-brand'
                            : 'border border-border bg-card text-muted-foreground hover:border-brand hover:text-brand'
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        {a.full_name || a.email}
                        {sel && (
                          <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                            role === 'Primary' ? 'bg-white/25 text-white' : 'bg-brand/20 text-brand'
                          }`}>
                            {role}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
                {approvers.length === 0 && (
                  <span className="text-[12px] text-muted-foreground">No eligible approvers found.</span>
                )}
              </div>
            </div>

            {/* Quorum control */}
            {n > 0 && (
              <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-2">
                <span className="text-[12px] text-muted-foreground">Required approvals:</span>
                <input
                  type="number"
                  min={1}
                  max={n}
                  value={stage.required_count}
                  onChange={(e) => updateStage(i, { required_count: Math.max(1, Math.min(parseInt(e.target.value) || 1, n)) })}
                  className="w-12 rounded-[6px] border border-border bg-input-background px-2 py-1 text-center text-[13px] text-foreground outline-none focus:border-brand"
                />
                <span className="text-[12px] text-muted-foreground">of {n}</span>
                <span className="ml-auto text-[11.5px] italic text-muted-foreground">{quorumLabel}</span>
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={addStage}
        className="inline-flex items-center gap-1.5 self-start rounded-[10px] border border-dashed border-border px-3.5 py-2 text-[12.5px] text-muted-foreground hover:border-brand hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" /> Add stage
      </button>
    </div>
  );
}

// ── Stage tree (read-only in-review view) ──────────────────────────────────────
function StageTree({ req }: { req: ApprovalRequest }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {req.stages.map((stage) => {
        const approved = stage.assignments.filter((a) => a.decision === 'approved').length;
        const isActive = stage.status === 'active';
        const quorumLabel = stage.required_count === stage.assignments.length
          ? 'All must approve'
          : stage.required_count === 1
          ? 'Any 1 approver'
          : `Any ${stage.required_count} of ${stage.assignments.length}`;
        return (
          <div key={stage.id} className={`rounded-[12px] border p-3 text-[12.5px] ${
            isActive ? 'border-brand/40 bg-brand-soft' :
            stage.status === 'approved' ? 'border-success/30 bg-success/5' :
            stage.status === 'rejected' ? 'border-error/30 bg-error/5' :
            'border-border bg-input-background'
          }`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-foreground">{stage.name}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">· {quorumLabel}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isActive ? 'bg-brand/15 text-brand' :
                stage.status === 'approved' ? 'bg-success/15 text-success' :
                stage.status === 'rejected' ? 'bg-error/15 text-error' :
                'bg-muted text-muted-foreground'
              }`}>
                {isActive ? `${approved} / ${stage.required_count} approved` : stage.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stage.assignments.map((a, idx) => {
                const role = approverRole(idx);
                return (
                  <span key={a.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                    a.decision === 'approved' ? 'bg-success/15 text-success' :
                    a.decision === 'rejected' ? 'bg-error/15 text-error' :
                    'bg-muted/60 text-muted-foreground'
                  }`}>
                    {a.decision === 'approved' && <Check className="h-3 w-3" strokeWidth={2.5} />}
                    {a.decision === 'rejected' && <X className="h-3 w-3" />}
                    <span>{a.approver_name ?? a.approver_email ?? a.approver_id.slice(0, 8)}</span>
                    <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                      role === 'Primary'
                        ? 'bg-brand/20 text-brand'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {role}
                    </span>
                    {a.comment && (
                      <span title={a.comment} className="italic">
                        &ldquo;{a.comment.slice(0, 20)}{a.comment.length > 20 ? '…' : ''}&rdquo;
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<RfqRun | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [dpOpen, setDpOpen] = useState(true);
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [stages, setStages] = useState<StageInput[]>([{ name: 'Stage 1', required_count: 1, approver_ids: [] }]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  // Per-stage locked approver IDs from the loaded template (index matches stages array)
  const [templateApproverIds, setTemplateApproverIds] = useState<string[][]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approversError, setApproversError] = useState<string | null>(null);
  const [customerApprovedAt, setCustomerApprovedAt] = useState('');
  const [customerPoRef, setCustomerPoRef] = useState('');
  const [customerSubmitting, setCustomerSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!runId) return;
    const load = () => {
      rfqApi.get(runId).then(({ data }) => {
        setRun(data);
        if (TERMINAL.has(data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.status === 'done') {
            const html = data.edited_content || quoteJsonToHtml(data.result_json ?? undefined);
            setEditorContent(html);
            // Load approval request tree
            approvalApi.requestTree(runId)
              .then((r) => setApprovalReq(r.data))
              .catch(() => setApprovalReq(null));
          }
        }
      });
    };
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runId]);

  // Load approvers + templates when builder opens
  useEffect(() => {
    if (showBuilder) {
      setApproversError(null);
      approvalApi.approvers()
        .then((r) => setApprovers(r.data))
        .catch((e) => {
          const msg = e?.response?.data?.detail ?? e?.message ?? 'Failed to load approvers';
          setApproversError(msg);
        });
      approvalTemplateApi.list()
        .then((r) => setTemplates(r.data))
        .catch(() => {}); // templates are optional; failure is non-fatal
    }
  }, [showBuilder]);

  const handleContentChange = useCallback((html: string) => {
    setEditorContent(html);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!runId) return;
      setSaving(true);
      try {
        await rfqApi.saveContent(runId, html);
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2000);
      } finally { setSaving(false); }
    }, 2000);
  }, [runId]);

  async function handleDownload() {
    if (!runId) return;
    const { data } = await rfqApi.exportDocx(runId);
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote_${runId.slice(0, 8)}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmitApproval() {
    if (!runId) return;
    const invalid = stages.find((s) => s.approver_ids.length === 0);
    if (invalid) { alert('Each stage needs at least one approver.'); return; }
    setSubmitting(true);
    try {
      const { data } = await approvalApi.submit(runId, stages, selectedTemplateId);
      setApprovalReq(data);
      setShowBuilder(false);
      // Re-fetch run so approval_state updates from 'none' → 'in_review'
      rfqApi.get(runId).then(({ data: runData }) => setRun(runData));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : 'Failed to submit for approval.');
    } finally { setSubmitting(false); }
  }

  function applyTemplate(t: ApprovalTemplate) {
    const stageData = (t.stages as { name: string; required_count: number; approver_ids?: string[] }[]);
    setStages(
      stageData.map((s, i) => ({
        name: s.name || `Stage ${i + 1}`,
        required_count: s.required_count,
        approver_ids: s.approver_ids ?? [],
      }))
    );
    setTemplateApproverIds(stageData.map((s) => s.approver_ids ?? []));
    setSelectedTemplateId(t.id);
    setSelectedTemplateName(t.name);
    setShowTemplatePicker(false);
  }

  function handleResubmit() {
    setStages([{ name: 'Stage 1', required_count: 1, approver_ids: [] }]);
    setSelectedTemplateId(null);
    setSelectedTemplateName(null);
    setTemplateApproverIds([]);
    setShowBuilder(true);
  }

  async function handleMarkSent() {
    if (!runId) return;
    try {
      const { data } = await rfqApi.markSent(runId);
      setRun(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : 'Failed to mark as sent.');
    }
  }

  async function handleCustomerApproved() {
    if (!runId || !customerApprovedAt) return;
    setCustomerSubmitting(true);
    try {
      const { data } = await rfqApi.markCustomerApproved(runId, {
        customer_approved_at: customerApprovedAt,
        customer_po_reference: customerPoRef || undefined,
      });
      setRun(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : 'Failed to record customer approval.');
    } finally {
      setCustomerSubmitting(false);
    }
  }

  if (!run) {
    return (
      <div className="mt-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const approvalState = run.approval_state ?? 'none';

  return (
    <div className="px-7 py-9 pb-14">
      <div className="mx-auto max-w-[880px]">
        {/* Header */}
        <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
              {run.meta_company_name ?? 'RFQ'} — {run.meta_product ?? 'Quote'}
            </h1>
            <div className="mt-1 flex flex-wrap gap-3.5 text-[12.5px] text-muted-foreground">
              {run.meta_rfq_number && <span>Ref: {run.meta_rfq_number}</span>}
              {run.meta_rfq_date && <span>Date: {run.meta_rfq_date}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusBadge run={run} />
            {run.status === 'done' && (
              <button
                onClick={handleDownload}
                className={`inline-flex h-10 items-center gap-1.5 rounded-[11px] px-[18px] text-[13px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}
              >
                <Download className="h-4 w-4" />
                Download .docx
              </button>
            )}
          </div>
        </div>

        {/* Approval workflow panel */}
        {run.status === 'done' && (
          <div className="mb-[18px]">

            {/* No request yet — prompt to build one */}
            {approvalState === 'none' && !showBuilder && (
              <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                  <ShieldCheck className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-foreground">Ready to send for approval</div>
                  <div className="text-xs text-muted-foreground">Route this quote to approvers before it&apos;s issued to the customer.</div>
                </div>
                <button
                  onClick={() => setShowBuilder(true)}
                  className={`inline-flex h-[38px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(54,148,252,0.6)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}
                >
                  <Send className="h-[15px] w-[15px]" />
                  Set up approval
                </button>
              </div>
            )}

            {/* Inline stage builder */}
            {(approvalState === 'none' || approvalState === 'changes_requested') && showBuilder && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--elevated-shadow)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-foreground">Build approval workflow</h2>
                  <button onClick={() => setShowBuilder(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Template picker */}
                {templates.length > 0 && (
                  <div className="relative mb-4">
                    <button
                      onClick={() => setShowTemplatePicker((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-brand hover:text-brand ${
                        selectedTemplateName
                          ? 'border-brand/40 bg-brand/10 text-brand'
                          : 'border-border bg-input-background text-muted-foreground'
                      }`}
                    >
                      <LayoutTemplate className="h-3.5 w-3.5" />
                      {selectedTemplateName ?? 'Load template'}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[260px] rounded-[12px] border border-border bg-card shadow-[var(--elevated-shadow)]">
                        <div className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Select a template
                        </div>
                        <div className="max-h-[220px] overflow-y-auto pb-2">
                          {templates.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => applyTemplate(t)}
                              className="flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left hover:bg-input-background"
                            >
                              <span className="text-[13px] font-semibold text-foreground">{t.name}</span>
                              {t.description && (
                                <span className="text-[11.5px] text-muted-foreground">{t.description}</span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {(t.stages as { name: string }[]).map((s, i) => s.name || `Stage ${i + 1}`).join(' → ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {approversError && (
                  <div className="mb-3 rounded-[10px] border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
                    Could not load approvers: {approversError}
                  </div>
                )}
                <StageBuilder stages={stages} onChange={setStages} approvers={approvers} templateApproverIds={templateApproverIds} />
                <div className="mt-4 flex justify-end gap-2.5">
                  <button
                    onClick={() => setShowBuilder(false)}
                    className="h-[38px] rounded-[11px] border border-border px-4 text-[13px] font-semibold text-muted-foreground hover:bg-accent/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitApproval}
                    disabled={submitting}
                    className={`inline-flex h-[38px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white disabled:opacity-60 ${BRAND_GRADIENT}`}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-[15px] w-[15px]" />}
                    Submit for approval
                  </button>
                </div>
              </div>
            )}

            {/* In-review: live stage tree */}
            {approvalState === 'in_review' && approvalReq && (
              <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="mb-2 flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-warning" />
                  <span className="text-[13.5px] font-bold text-foreground">Awaiting approval</span>
                  <span className="text-xs text-muted-foreground">Stage {approvalReq.current_stage_index + 1} of {approvalReq.stages.length} active</span>
                </div>
                <StageTree req={approvalReq} />
              </div>
            )}

            {/* Approved — with Mark as Sent action */}
            {approvalState === 'approved' && (
              <div className="rounded-2xl border border-success/40 bg-success/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-success text-white">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-foreground">Approved</div>
                    <div className="text-xs text-muted-foreground">Cleared for issue to the customer.</div>
                  </div>
                  <button
                    onClick={handleMarkSent}
                    className={`inline-flex h-[38px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white ${BRAND_GRADIENT}`}
                  >
                    <Send className="h-[15px] w-[15px]" />
                    Mark as Sent to Customer
                  </button>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}

            {/* Sent to Customer — with Customer Approved form */}
            {approvalState === 'sent_to_customer' && (
              <div className="rounded-2xl border border-[var(--elevated-border)] bg-card p-4 shadow-[var(--elevated-shadow)]">
                <div className="mb-3 flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                    <Send className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-foreground">Sent to Customer</div>
                    <div className="text-xs text-muted-foreground">Record when the customer accepts the quote.</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approval date *</label>
                    <input
                      type="date"
                      value={customerApprovedAt}
                      onChange={(e) => setCustomerApprovedAt(e.target.value)}
                      className="h-[36px] rounded-[10px] border border-border bg-input-background px-3 text-[13px] text-foreground outline-none focus:border-brand"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PO / ref number</label>
                    <input
                      type="text"
                      value={customerPoRef}
                      onChange={(e) => setCustomerPoRef(e.target.value)}
                      placeholder="Optional"
                      className="h-[36px] rounded-[10px] border border-border bg-input-background px-3 text-[13px] text-foreground outline-none focus:border-brand"
                    />
                  </div>
                  <button
                    onClick={handleCustomerApproved}
                    disabled={!customerApprovedAt || customerSubmitting}
                    className={`inline-flex h-[36px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white disabled:opacity-50 ${BRAND_GRADIENT}`}
                  >
                    {customerSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />}
                    Customer Approved
                  </button>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}

            {/* Customer Approved — read-only summary */}
            {approvalState === 'customer_approved' && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald-500 text-white">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-foreground">Customer Approved</div>
                    <div className="text-xs text-muted-foreground">
                      {run.customer_approved_at
                        ? `Accepted on ${new Date(run.customer_approved_at).toLocaleDateString()}`
                        : 'Customer acceptance recorded.'}
                      {run.customer_po_reference && ` · PO: ${run.customer_po_reference}`}
                    </div>
                  </div>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}

            {/* Changes requested (stage-0 rejection) */}
            {approvalState === 'changes_requested' && (
              <div className="rounded-2xl border border-error/40 bg-error/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex flex-wrap items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-error">
                    <X className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-foreground">Changes requested</div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                      Revise the quote and resubmit for approval.
                      {approvalReq && approvalReq.stages[0]?.assignments.find(a => a.decision === 'rejected')?.comment && (
                        <span className="ml-1 italic">
                          &quot;{approvalReq.stages[0].assignments.find(a => a.decision === 'rejected')?.comment}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                  {!showBuilder && (
                    <button
                      onClick={handleResubmit}
                      className={`h-[38px] rounded-[11px] px-4 text-[13px] font-bold text-white ${BRAND_GRADIENT}`}
                    >
                      Revise &amp; resubmit
                    </button>
                  )}
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}
          </div>
        )}

        {/* Collected data points */}
        {run.data_points && run.data_points.length > 0 && (
          <div className="mb-[18px] rounded-2xl border border-border bg-card p-5 shadow-[var(--elevated-shadow)]">
            <button
              onClick={() => setDpOpen((o) => !o)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-[13px] font-bold text-foreground">
                Collected data points <span className="font-medium text-muted-foreground">· {run.data_points.length}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dpOpen ? '' : '-rotate-90'}`} />
            </button>
            {dpOpen && (
              <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                {run.data_points.map((dp) => (
                  <div key={dp.key}>
                    <div className="mb-0.5 text-[11px] text-muted-foreground">{dp.label ?? dp.key}</div>
                    <div className="text-[13px] font-medium text-foreground">{dp.value ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {!TERMINAL.has(run.status) && (
          <div className="mb-[18px] flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--elevated-shadow)]">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span className="flex items-center gap-2 text-sm text-foreground">
              Processing… <StatusBadge status={run.status} />
            </span>
          </div>
        )}

        {/* Error */}
        {run.status === 'failed' && run.error && (
          <div className="mb-[18px] flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-[13px] text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{run.error}</span>
          </div>
        )}

        {/* Editor */}
        {run.status === 'done' && editorContent && (
          <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3">
              <span className="text-[13px] font-bold text-foreground">Generated quote</span>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-[13px] w-[13px] text-success" strokeWidth={2.4} />
                )}
                {saving ? 'Saving…' : saveMsg || 'Auto-saved'}
              </span>
            </div>
            <div className="p-2">
              <TipTapEditor content={editorContent} onChange={handleContentChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
