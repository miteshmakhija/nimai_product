import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Sparkles, Loader2, Plus, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { promptApi } from '../api';
import type { Prompt, PromptVersion } from '../types';
import ProductPicker from '../components/ProductPicker';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

interface Selection {
  key: string;
  productName: string | null;
}

export default function PromptsEditor() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [sel, setSel] = useState<Selection | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Right-pane state
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // New variant state
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(null);
  const [newVariantProduct, setNewVariantProduct] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      const r = await promptApi.list();
      const data: Prompt[] = r.data;
      setPrompts(data);
      if (!sel && data.length > 0) {
        const first = data[0];
        setSel({ key: first.key, productName: first.product_name });
        setExpandedKeys(new Set([first.key]));
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!sel) return;
    setVersions([]);
    setContent('');
    setMsg('');
    promptApi
      .versions(sel.key, sel.productName ?? undefined)
      .then((r) => {
        setVersions(r.data);
        if (r.data.length > 0) setContent(r.data[0].content);
      })
      .catch(() => {});
  }, [sel?.key, sel?.productName]);

  // Group prompts by key
  const grouped = prompts.reduce<Record<string, Prompt[]>>((acc, p) => {
    if (!acc[p.key]) acc[p.key] = [];
    acc[p.key].push(p);
    return acc;
  }, {});

  // Sort each group: default (null product_name) first
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      if (a.product_name === null) return -1;
      if (b.product_name === null) return 1;
      return (a.product_name ?? '').localeCompare(b.product_name ?? '');
    });
  }

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function select(key: string, productName: string | null) {
    setSel({ key, productName });
    setMsg('');
    setAddingVariantFor(null);
  }

  const currentPrompt = sel
    ? prompts.find((p) => p.key === sel.key && p.product_name === sel.productName)
    : null;
  const activeVersion = versions.find((v) => v.id === currentPrompt?.active_version_id);

  async function saveVersion(e: FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setBusy(true);
    setMsg('');
    try {
      const { data } = await promptApi.addVersion(sel.key, content, note, sel.productName ?? undefined);
      await promptApi.activate(sel.key, data.id, sel.productName ?? undefined);
      setNote('');
      setMsg('Saved and activated');
      const [pvRes, plRes] = await Promise.all([
        promptApi.versions(sel.key, sel.productName ?? undefined),
        promptApi.list(),
      ]);
      setVersions(pvRes.data);
      setPrompts(plRes.data);
    } catch {
      setMsg('Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function activateVersion(versionId: string) {
    if (!sel) return;
    try {
      await promptApi.activate(sel.key, versionId, sel.productName ?? undefined);
      const [pvRes, plRes] = await Promise.all([
        promptApi.versions(sel.key, sel.productName ?? undefined),
        promptApi.list(),
      ]);
      setVersions(pvRes.data);
      setPrompts(plRes.data);
      setMsg('Activated');
    } catch {
      setMsg('Activation failed');
    }
  }

  async function confirmAddVariant(key: string) {
    if (!newVariantProduct) return;
    // Navigate to new prompt — it'll be created on first save
    setSel({ key, productName: newVariantProduct });
    setContent('');
    setVersions([]);
    setAddingVariantFor(null);
    setNewVariantProduct(null);
    setExpandedKeys((prev) => new Set([...prev, key]));
    setMsg('');
  }

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-[22px]">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Prompt Editor</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage versioned prompts. Add product-specific overrides — the default is used when no product matches.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Left pane — prompt tree */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--elevated-shadow)]">
            <p className="px-1 pb-2.5 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Prompts
            </p>
            <div className="flex flex-col gap-0.5">
              {Object.entries(grouped).map(([key, group]) => {
                const expanded = expandedKeys.has(key);
                const defaultPrompt = group.find((p) => p.product_name === null);
                const variants = group.filter((p) => p.product_name !== null);
                const isKeySel = sel?.key === key;

                return (
                  <div key={key}>
                    {/* Key row */}
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleExpand(key)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        {expanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </button>
                      <button
                        onClick={() => { select(key, null); toggleExpand(key); }}
                        className={`flex flex-1 items-center gap-2 rounded-[10px] px-2 py-2 text-left text-[13px] transition-colors ${
                          isKeySel && sel?.productName === null
                            ? 'bg-brand/10 font-semibold text-brand'
                            : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      >
                        <FileText className="h-[14px] w-[14px] shrink-0" strokeWidth={1.9} />
                        <span className="truncate">{defaultPrompt?.name ?? key}</span>
                        {defaultPrompt?.active_version_id && (
                          <Globe className="ml-auto h-3 w-3 shrink-0 text-success" />
                        )}
                      </button>
                    </div>

                    {/* Product variants */}
                    {expanded && (
                      <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2.5 pb-1">
                        {variants.map((p) => {
                          const active = sel?.key === key && sel?.productName === p.product_name;
                          return (
                            <button
                              key={p.id}
                              onClick={() => select(key, p.product_name)}
                              className={`flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                                active
                                  ? 'bg-brand/10 font-semibold text-brand'
                                  : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                              }`}
                            >
                              <span className="truncate">{p.product_name}</span>
                              {p.active_version_id && (
                                <Globe className="ml-auto h-3 w-3 shrink-0 text-success" />
                              )}
                            </button>
                          );
                        })}

                        {/* Add variant */}
                        {addingVariantFor === key ? (
                          <div className="mt-1 space-y-1.5 rounded-[10px] border border-border bg-input-background p-2">
                            <ProductPicker value={newVariantProduct} onChange={setNewVariantProduct} allowNone={false} placeholder="Pick product…" />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => confirmAddVariant(key)}
                                disabled={!newVariantProduct}
                                className="flex-1 rounded-[8px] bg-brand/10 py-1 text-[12px] font-semibold text-brand disabled:opacity-40"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setAddingVariantFor(null); setNewVariantProduct(null); }}
                                className="flex-1 rounded-[8px] border border-border py-1 text-[12px] text-muted-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingVariantFor(key); setNewVariantProduct(null); }}
                            className="flex items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                            Add product variant
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right pane — editor + history */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            {sel ? (
              <>
                {/* Scope badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-muted-foreground">Editing:</span>
                  <span className="rounded-full border border-brand bg-brand/10 px-2.5 py-0.5 text-[12px] font-semibold text-brand">
                    {sel.productName ?? 'Default (all products)'}
                  </span>
                  {sel.productName && (
                    <span className="text-[11.5px] text-muted-foreground">— overrides default for this product</span>
                  )}
                </div>

                {/* Editor */}
                <form
                  onSubmit={saveVersion}
                  className="rounded-[18px] border border-border bg-card p-5 shadow-[var(--elevated-shadow)]"
                >
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground">Edit content</span>
                      {activeVersion && (
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                          active · v{activeVersion.version}
                        </span>
                      )}
                    </div>
                    {msg && (
                      <span className={`text-[11.5px] ${msg.includes('fail') ? 'text-error' : 'text-success'}`}>
                        {msg}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="System prompt content…"
                    className="w-full resize-y rounded-[14px] border border-border bg-input-background px-[18px] py-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-[border-color,box-shadow,background] focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]"
                  />

                  <div className="mt-3.5 flex gap-3">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Change note (optional)"
                      className="h-[42px] flex-1 rounded-[11px] border border-border bg-input-background px-3.5 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)]"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className={`inline-flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[11px] px-5 text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] disabled:opacity-60 ${BRAND_GRADIENT}`}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {busy ? 'Saving…' : 'Save & Activate'}
                    </button>
                  </div>
                </form>

                {/* Version history */}
                {versions.length > 0 && (
                  <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
                    <div className="border-b border-border px-[22px] py-4 text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                      Version history
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                          <th className="px-[22px] py-3 font-semibold">Version</th>
                          <th className="px-[22px] py-3 font-semibold">Note</th>
                          <th className="px-[22px] py-3 font-semibold">Created</th>
                          <th className="px-[22px] py-3 font-semibold">Active</th>
                          <th className="px-[22px] py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => {
                          const isActive = currentPrompt?.active_version_id === v.id;
                          return (
                            <tr key={v.id} className="border-b border-border text-[13px] last:border-0 hover:bg-accent/40">
                              <td className="px-[22px] py-3.5 font-mono font-medium text-foreground">v{v.version}</td>
                              <td className="px-[22px] py-3.5 text-foreground">{v.note || <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-[22px] py-3.5 text-[12.5px] text-muted-foreground">{new Date(v.created_at).toLocaleString()}</td>
                              <td className="px-[22px] py-3.5">
                                {isActive && (
                                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-[22px] py-3.5">
                                <div className="flex gap-3.5">
                                  {!isActive && (
                                    <button onClick={() => activateVersion(v.id)} className="text-[12px] font-semibold text-brand hover:underline">
                                      Activate
                                    </button>
                                  )}
                                  <button onClick={() => setContent(v.content)} className="text-[12px] text-muted-foreground hover:text-foreground">
                                    Load
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[18px] border border-border bg-card p-6 py-20 text-center text-sm text-muted-foreground shadow-[var(--elevated-shadow)]">
                Select a prompt from the left panel.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
