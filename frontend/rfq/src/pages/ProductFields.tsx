import { useState, useEffect } from 'react';
import { Plus, Trash2, X, ChevronUp, ChevronDown, FileText, Loader2 } from 'lucide-react';
import { productsApi } from '../api';
import type { ProductField, ProductFieldDef } from '../types';

const FIELD_TYPES = ['text', 'number', 'date', 'select'] as const;
const EMPTY_FIELD: ProductFieldDef = { key: '', label: '', field_type: 'text', required: true };

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

export default function ProductFields() {
  const [products, setProducts] = useState<ProductField[]>([]);
  const [selected, setSelected] = useState<ProductField | null>(null);
  const [newName, setNewName] = useState('');
  const [fields, setFields] = useState<ProductFieldDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await productsApi.list();
    setProducts(data);
  }

  function selectProduct(p: ProductField) {
    setSelected(p);
    setNewName(p.product_name);
    setFields(p.fields ?? []);
    setMsg('');
    setError('');
  }

  function newProduct() {
    setSelected(null);
    setNewName('');
    setFields([{ ...EMPTY_FIELD }]);
    setMsg('');
    setError('');
  }

  const addField = () => setFields((f) => [...f, { ...EMPTY_FIELD }]);
  const removeField = (idx: number) => setFields((f) => f.filter((_, i) => i !== idx));
  const updateField = (idx: number, patch: Partial<ProductFieldDef>) =>
    setFields((f) => f.map((fd, i) => (i === idx ? { ...fd, ...patch } : fd)));

  function moveUp(idx: number) {
    if (idx === 0) return;
    setFields((f) => {
      const arr = [...f];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }
  function moveDown(idx: number) {
    if (idx === fields.length - 1) return;
    setFields((f) => {
      const arr = [...f];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  async function save() {
    if (!newName.trim()) {
      setError('Product name is required');
      return;
    }
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await productsApi.upsert(newName.trim(), fields);
      setMsg('Saved');
      await load();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.product_name}"?`)) return;
    await productsApi.delete(selected.product_name);
    setSelected(null);
    setNewName('');
    setFields([]);
    await load();
  }

  const editing = selected !== null || newName !== '';

  const inputCls =
    'h-[34px] rounded-[9px] border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)]';

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-[22px]">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Product Fields</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Define the data points NimAI extracts for each product.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* Product list */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--elevated-shadow)]">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[13px] font-bold text-foreground">Products</span>
              <button
                onClick={newProduct}
                className="inline-flex items-center gap-1 rounded-[9px] bg-brand/10 px-2.5 py-1.5 text-[12px] font-semibold text-brand"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                New
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {products.map((p) => {
                const active = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left text-[13px] transition-colors ${
                      active
                        ? 'bg-brand/10 font-semibold text-brand'
                        : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    <FileText className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
                    {p.product_name}
                  </button>
                );
              })}
              {products.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">No products yet</p>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-[18px] border border-border bg-card p-6 shadow-[var(--elevated-shadow)]">
            {editing ? (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <input
                    className="h-10 max-w-[320px] flex-1 rounded-[11px] border border-border bg-input-background px-3.5 text-sm font-semibold text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]"
                    placeholder="Product name (e.g. Centrifugal Pump)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  {selected && (
                    <button
                      onClick={deleteProduct}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-error px-3 text-[12.5px] font-semibold text-error transition-colors hover:bg-error/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mb-3 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-[12.5px] text-error">
                    {error}
                  </div>
                )}
                {msg && (
                  <div className="mb-3 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-[12.5px] text-success">
                    {msg}
                  </div>
                )}

                {/* Column headers */}
                <div className="grid grid-cols-[40px_1fr_1fr_150px_90px_40px] px-2 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  <span />
                  <span>Key</span>
                  <span>Label</span>
                  <span>Type</span>
                  <span className="text-center">Required</span>
                  <span />
                </div>

                <div className="flex flex-col gap-2">
                  {fields.map((fd, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[40px_1fr_1fr_150px_90px_40px] items-center gap-3 rounded-xl border border-border bg-input-background p-2"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => moveUp(idx)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveDown(idx)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === fields.length - 1}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        className={`${inputCls} font-mono text-[12.5px]`}
                        value={fd.key}
                        onChange={(e) => updateField(idx, { key: e.target.value })}
                        placeholder="slug_key"
                      />
                      <input
                        className={inputCls}
                        value={fd.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                        placeholder="Human label"
                      />
                      <select
                        className={inputCls}
                        value={fd.field_type}
                        onChange={(e) =>
                          updateField(idx, { field_type: e.target.value as ProductFieldDef['field_type'] })
                        }
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={fd.required}
                          onClick={() => updateField(idx, { required: !fd.required })}
                          className={`flex h-[22px] w-[38px] items-center rounded-full p-0.5 transition-colors ${
                            fd.required ? 'justify-end bg-brand' : 'justify-start bg-border'
                          }`}
                        >
                          <span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                      <div className="flex justify-center">
                        <button onClick={() => removeField(idx)} className="text-error/70 hover:text-error">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-[18px] flex items-center gap-3">
                  <button
                    onClick={addField}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-[11px] border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent/50"
                  >
                    <Plus className="h-[15px] w-[15px]" strokeWidth={2.2} />
                    Add field
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className={`inline-flex h-[38px] items-center gap-2 rounded-[11px] px-5 text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] disabled:opacity-60 ${BRAND_GRADIENT}`}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </button>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Select a product or create a new one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
