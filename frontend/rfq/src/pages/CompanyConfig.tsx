import { useEffect, useState, useRef } from 'react';
import { Building2, Plus, Trash2, GripVertical } from 'lucide-react';
import { configApi, type AppConfigItem, type AppConfigItemUpdate } from '../api';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

function newRow(sortOrder: number): AppConfigItemUpdate {
  return {
    id: null,
    key: '',
    label: '',
    value: '',
    field_type: 'text',
    required: false,
    enabled: true,
    sort_order: sortOrder,
  };
}

function toUpdate(item: AppConfigItem): AppConfigItemUpdate {
  return { ...item };
}

export default function CompanyConfig() {
  const [items, setItems] = useState<AppConfigItemUpdate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    configApi.list().then((r) => setItems(r.data.map(toUpdate))).catch(() => {});
  }, []);

  function addField() {
    setItems((prev) => [...prev, newRow(prev.length)]);
  }

  function updateItem(index: number, patch: Partial<AppConfigItemUpdate>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function removeItem(index: number) {
    const item = items[index];
    if (item.required) return;
    if (item.id) {
      try {
        await configApi.remove(item.id);
      } catch {
        setError('Failed to delete item.');
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const withOrder = items.map((item, i) => ({ ...item, sort_order: i }));
      const r = await configApi.save(withOrder);
      setItems(r.data.map(toUpdate));
    } catch {
      setError('Failed to save. Check values and try again.');
    } finally {
      setSaving(false);
    }
  }

  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      dragIndex.current = index;
      return next;
    });
  }

  function onDragEnd() {
    dragIndex.current = null;
  }

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-foreground">
              Company Config
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Static company details injected into exported quotation documents as{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                {'{{ company.key }}'}
              </code>
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex h-9 items-center gap-2 rounded-[10px] px-5 text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(54,148,252,0.5)] transition-[transform,filter] duration-150 hover:-translate-y-px disabled:opacity-60 ${BRAND_GRADIENT}`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-[10px] bg-red-500/10 px-4 py-3 text-[13px] text-red-500">
            {error}
          </div>
        )}

        {/* Config rows */}
        <div className="rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          {items.length === 0 ? (
            <p className="p-8 text-center text-[13px] text-muted-foreground">
              No config fields yet. Click "Add Field" to create one.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item, index) => (
                <div
                  key={item.id ?? `new-${index}`}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  {/* Drag handle */}
                  <div className="mt-2.5 cursor-grab text-muted-foreground active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" strokeWidth={1.9} />
                  </div>

                  {/* Fields */}
                  <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                    {/* Key */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Key
                      </span>
                      {item.id ? (
                        <span className="flex h-9 items-center rounded-[8px] bg-muted/40 px-3 font-mono text-[12px] text-foreground">
                          {item.key}
                        </span>
                      ) : (
                        <input
                          className="h-9 w-36 rounded-[8px] border border-border bg-input-background px-3 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder="my_key"
                          value={item.key}
                          onChange={(e) => updateItem(index, { key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Label
                      </span>
                      <input
                        className="h-9 w-44 rounded-[8px] border border-border bg-input-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                        placeholder="Display label"
                        value={item.label}
                        onChange={(e) => updateItem(index, { label: e.target.value })}
                      />
                    </div>

                    {/* Type */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Type
                      </span>
                      <select
                        className="h-9 rounded-[8px] border border-border bg-input-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                        value={item.field_type}
                        onChange={(e) => updateItem(index, { field_type: e.target.value as AppConfigItemUpdate['field_type'] })}
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="list">List (JSON)</option>
                      </select>
                    </div>

                    {/* Value */}
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Value
                      </span>
                      {item.field_type === 'textarea' ? (
                        <textarea
                          className="min-h-[72px] w-full rounded-[8px] border border-border bg-input-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder="Enter value…"
                          value={item.value}
                          onChange={(e) => updateItem(index, { value: e.target.value })}
                        />
                      ) : item.field_type === 'list' ? (
                        <input
                          className="h-9 w-full rounded-[8px] border border-border bg-input-background px-3 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder='["value1", "value2"]'
                          value={item.value}
                          onChange={(e) => updateItem(index, { value: e.target.value })}
                        />
                      ) : (
                        <input
                          className="h-9 w-full rounded-[8px] border border-border bg-input-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder="Enter value…"
                          value={item.value}
                          onChange={(e) => updateItem(index, { value: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  {/* Right controls */}
                  <div className="mt-1 flex items-center gap-2">
                    {/* Required badge */}
                    {item.required && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        required
                      </span>
                    )}

                    {/* Enabled toggle */}
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-primary"
                        checked={item.enabled}
                        onChange={(e) => updateItem(index, { enabled: e.target.checked })}
                      />
                      <span className="text-[12px] text-muted-foreground">on</span>
                    </label>

                    {/* Delete */}
                    <button
                      onClick={() => removeItem(index)}
                      disabled={item.required}
                      title={item.required ? 'Required field cannot be deleted' : 'Delete'}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Field */}
          <div className="border-t border-border px-5 py-3">
            <button
              onClick={addField}
              className="flex items-center gap-2 text-[13px] font-medium text-brand transition-colors hover:text-brand/80"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add Field
            </button>
          </div>
        </div>

        {/* Usage hint */}
        <div className="mt-5 rounded-[14px] border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand" strokeWidth={1.9} />
            <span className="text-[13px] font-semibold text-foreground">Template usage</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            In your .docx template, reference these values with{' '}
            <code className="font-mono">{'{{ company.company_name }}'}</code>,{' '}
            <code className="font-mono">{'{{ company.email }}'}</code>, etc. List fields:{' '}
            <code className="font-mono">{'{% for cert in company.certifications %}{{ cert }}{% endfor %}'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
