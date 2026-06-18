import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  ShieldCheck, GripVertical, Save, AlertCircle, X,
} from 'lucide-react';
import { approvalTemplateApi, approvalApi } from '../api';
import type { ApprovalTemplate, TemplateStage, Approver } from '../types';

// ── Local form state ───────────────────────────────────────────────────────────
interface StageForm {
  name: string;
  required_count: number;
  department_hint: string;
  approver_ids: string[];
}

interface TemplateForm {
  name: string;
  description: string;
  is_active: boolean;
  stages: StageForm[];
}

const BLANK_STAGE: StageForm = { name: '', required_count: 1, department_hint: '', approver_ids: [] };
const BLANK_FORM: TemplateForm = {
  name: '',
  description: '',
  is_active: true,
  stages: [{ ...BLANK_STAGE, name: 'Stage 1' }],
};

function stageFormFromTemplate(t: ApprovalTemplate): TemplateForm {
  return {
    name: t.name,
    description: t.description ?? '',
    is_active: t.is_active,
    stages: (t.stages as TemplateStage[]).map((s) => ({
      name: s.name,
      required_count: s.required_count,
      department_hint: s.department_hint ?? '',
      approver_ids: s.approver_ids ?? [],
    })),
  };
}

// ── Stage editor sub-component ────────────────────────────────────────────────
function StageEditor({
  stages, onChange, approvers,
}: {
  stages: StageForm[];
  onChange: (s: StageForm[]) => void;
  approvers: Approver[];
}) {
  function add() {
    onChange([...stages, { ...BLANK_STAGE, name: `Stage ${stages.length + 1}` }]);
  }
  function remove(i: number) {
    onChange(stages.filter((_, idx) => idx !== i));
  }
  function update(i: number, patch: Partial<StageForm>) {
    onChange(stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function toggleApprover(stageIdx: number, approverId: string) {
    const stage = stages[stageIdx];
    const next = stage.approver_ids.includes(approverId)
      ? stage.approver_ids.filter((id) => id !== approverId)
      : [...stage.approver_ids, approverId];
    const newQuorum = Math.min(stage.required_count, Math.max(1, next.length));
    update(stageIdx, { approver_ids: next, required_count: newQuorum });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage, i) => {
        const n = stage.approver_ids.length;
        const quorumLabel =
          n === 0 ? '' :
          stage.required_count === n ? 'All must approve' :
          stage.required_count === 1 ? 'Any 1 approver is enough' :
          `Any ${stage.required_count} of ${n} must approve`;

        return (
          <div key={i} className="rounded-[12px] border border-border bg-input-background p-3.5">
            {/* Stage header */}
            <div className="mb-2.5 flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Stage {i + 1}
              </span>
              {stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="ml-auto text-muted-foreground hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Stage name + quorum */}
            <div className="mb-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-muted-foreground">Stage name</label>
                <input
                  value={stage.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="e.g. Manager Review"
                  className="w-full rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Quorum (min approvals)</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, n)}
                  value={stage.required_count}
                  onChange={(e) => update(i, { required_count: Math.min(Math.max(1, parseInt(e.target.value) || 1), Math.max(1, n)) })}
                  className="w-full rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Department hint <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  value={stage.department_hint}
                  onChange={(e) => update(i, { department_hint: e.target.value })}
                  placeholder="e.g. Finance, Engineering, Sales"
                  className="w-full rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Approver picker */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground">
                  Approvers <span className="text-muted-foreground/60">(first selected = Primary)</span>
                </label>
                {quorumLabel && (
                  <span className="text-[10.5px] text-brand">{quorumLabel}</span>
                )}
              </div>

              {approvers.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground/70 italic">No approvers available</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {approvers.map((a) => {
                    const pos = stage.approver_ids.indexOf(a.id);
                    const selected = pos !== -1;
                    const role = pos === 0 ? 'Primary' : pos > 0 ? 'Secondary' : null;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleApprover(i, a.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors border ${
                          selected && pos === 0
                            ? 'border-brand bg-brand text-white'
                            : selected
                            ? 'border-brand/50 bg-brand/15 text-brand'
                            : 'border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground'
                        }`}
                      >
                        <span>{a.full_name || a.email}</span>
                        {role && (
                          <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                            pos === 0 ? 'bg-white/20 text-white' : 'bg-brand/20 text-brand'
                          }`}>
                            {role}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 self-start rounded-[10px] border border-dashed border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:border-brand hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" /> Add stage
      </button>
    </div>
  );
}

// ── Template form panel ───────────────────────────────────────────────────────
function TemplateFormPanel({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: TemplateForm;
  onSave: (form: TemplateForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<TemplateForm>(initial);
  const [approvers, setApprovers] = useState<Approver[]>([]);

  useEffect(() => {
    approvalApi.approvers().then((r) => setApprovers(r.data)).catch(() => {});
  }, []);

  function patch(p: Partial<TemplateForm>) {
    setForm((f) => ({ ...f, ...p }));
  }

  return (
    <div className="rounded-[16px] border border-brand/30 bg-card p-5 shadow-[var(--elevated-shadow)]">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-foreground">Template name *</label>
          <input
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Standard 2-stage, APAC Region"
            className="w-full rounded-[10px] border border-border bg-input-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-foreground">Description</label>
          <input
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="When to use this template…"
            className="w-full rounded-[10px] border border-border bg-input-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-[12px] font-semibold text-foreground">Stages</label>
        <StageEditor stages={form.stages} onChange={(s) => patch({ stages: s })} approvers={approvers} />
      </div>

      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => patch({ is_active: !form.is_active })}
          className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active ? 'bg-brand' : 'bg-border'}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              form.is_active ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-[12.5px] text-muted-foreground">Active (visible to submitters)</span>
      </div>

      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-[36px] rounded-[10px] border border-border px-4 text-[13px] font-semibold text-muted-foreground hover:bg-accent/50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !form.name.trim() || form.stages.length === 0}
          onClick={() => onSave(form)}
          className="inline-flex h-[36px] items-center gap-1.5 rounded-[10px] bg-gradient-brand px-4 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {saving ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save template
        </button>
      </div>
    </div>
  );
}

// ── Template row ──────────────────────────────────────────────────────────────
function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: ApprovalTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const stages = template.stages as TemplateStage[];

  return (
    <div className={`rounded-[16px] border bg-card shadow-[var(--elevated-shadow)] transition-colors ${
      template.is_active ? 'border-border' : 'border-border/50 opacity-60'
    }`}>
      <div className="flex flex-wrap items-center gap-3 p-4 pl-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-bold text-foreground">{template.name}</span>
            {!template.is_active && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{template.description}</p>
          )}
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {stages.length} stage{stages.length !== 1 ? 's' : ''}
            {stages.length > 0 && (
              <span className="ml-1.5">
                · {stages.map((s) => s.name || `Stage ${stages.indexOf(s) + 1}`).join(' → ')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:bg-input-background"
            title="View stages"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:bg-input-background hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-error/30 text-error/70 hover:bg-error/10 hover:text-error"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && stages.length > 0 && (
        <div className="border-t border-border px-5 pb-4 pt-3.5">
          <div className="flex flex-col gap-2">
            {stages.map((s, i) => (
              <div key={i} className="rounded-[10px] border border-border bg-input-background px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-foreground">{s.name || `Stage ${i + 1}`}</span>
                    {s.department_hint && (
                      <span className="ml-2 text-[12px] text-muted-foreground">· {s.department_hint}</span>
                    )}
                  </div>
                  <span className="text-[11.5px] text-muted-foreground">Quorum: {s.required_count}</span>
                </div>
                {s.approver_ids && s.approver_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.approver_ids.map((id, pos) => (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                          pos === 0 ? 'bg-brand text-white' : 'bg-brand/15 text-brand'
                        }`}
                      >
                        {pos === 0 ? 'Primary' : 'Secondary'}
                        <span className="opacity-80">· {id.slice(0, 8)}…</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApprovalTemplates() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadTemplates() {
    setLoading(true);
    approvalTemplateApi
      .listAll()
      .then((r) => setTemplates(r.data))
      .catch((e) => {
        setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load templates');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate(form: TemplateForm) {
    setSaving(true);
    try {
      await approvalTemplateApi.create({
        name: form.name,
        description: form.description || undefined,
        stages: form.stages.map((s) => ({
          name: s.name,
          required_count: s.required_count,
          department_hint: s.department_hint || undefined,
          approver_ids: s.approver_ids,
        })),
        is_active: form.is_active,
      });
      setCreating(false);
      loadTemplates();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, form: TemplateForm) {
    setSaving(true);
    try {
      await approvalTemplateApi.update(id, {
        name: form.name,
        description: form.description || undefined,
        stages: form.stages.map((s) => ({
          name: s.name,
          required_count: s.required_count,
          department_hint: s.department_hint || undefined,
          approver_ids: s.approver_ids,
        })),
        is_active: form.is_active,
      });
      setEditingId(null);
      loadTemplates();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await approvalTemplateApi.delete(id);
      loadTemplates();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Failed to delete template');
    }
  }

  const activeCount = templates.filter((t) => t.is_active).length;

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[900px]">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">
              Approval Templates
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Define reusable approval workflows with pre-assigned approvers. Submitters select a template and it routes automatically.
              {templates.length > 0 && (
                <span className="ml-1.5 text-muted-foreground">
                  {activeCount} active · {templates.length - activeCount} inactive
                </span>
              )}
            </p>
          </div>
          {!creating && (
            <button
              onClick={() => { setCreating(true); setEditingId(null); }}
              className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-gradient-brand px-[18px] text-[13px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(54,148,252,0.6)] transition-[transform,filter] hover:-translate-y-px"
            >
              <Plus className="h-4 w-4" />
              New template
            </button>
          )}
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-[12px] border border-error/30 bg-error/10 px-4 py-3 text-[13px] text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="mb-5">
            <TemplateFormPanel
              initial={BLANK_FORM}
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              saving={saving}
            />
          </div>
        )}

        {/* Template list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : templates.length === 0 && !creating ? (
          <div className="rounded-[18px] border border-border bg-card p-14 text-center shadow-[var(--elevated-shadow)]">
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[13px] bg-input-background text-muted-foreground">
              <ShieldCheck className="h-[22px] w-[22px]" />
            </div>
            <div className="mb-1 text-sm font-semibold text-foreground">No templates yet</div>
            <div className="mb-5 text-[12.5px] text-muted-foreground">
              Create your first template — e.g. "Standard 2-stage" or "APAC Region approval".
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-gradient-brand px-4 text-[13px] font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Create template
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {templates.map((t) =>
              editingId === t.id ? (
                <div key={t.id} className="mb-1">
                  <TemplateFormPanel
                    initial={stageFormFromTemplate(t)}
                    onSave={(form) => handleUpdate(t.id, form)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onEdit={() => { setEditingId(t.id); setCreating(false); }}
                  onDelete={() => handleDelete(t.id, t.name)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
