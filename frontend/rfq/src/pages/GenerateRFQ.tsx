import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  Type,
  FileUp,
  UploadCloud,
  Info,
  Clock,
  ArrowRight,
  Copy,
  X,
} from 'lucide-react';
import { rfqApi } from '../api';
import type { RfqRun } from '../types';
import StatusBadge from '../components/StatusBadge';
import ProductPicker from '../components/ProductPicker';

type Mode = 'text' | 'file';

/** Brand gradient used for the primary "AI moment" action. */
const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

export default function GenerateRFQ() {
  const nav = useNavigate();
  const location = useLocation();
  // Set when the user clicked "Use as template" / "Clone structure" in the RFQ Library.
  const [template, setTemplate] = useState<string | null>(
    (location.state as { template?: string } | null)?.template ?? null
  );
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<RfqRun[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Recent activity rail — latest five runs.
  useEffect(() => {
    rfqApi
      .list()
      .then((r) => setRecent((r.data as RfqRun[]).slice(0, 5)))
      .catch(() => setRecent([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let resp;
      // NOTE: pass `template` through to the backend so generation reuses that
      // RFQ's structure/commercial style (extend extractText/extract to accept it).
      if (mode === 'text') {
        resp = await rfqApi.extractText(text, selectedProduct ?? undefined);
      } else if (file) {
        resp = await rfqApi.extract(file, selectedProduct ?? undefined);
      } else {
        return;
      }
      const runId: string = resp.data.run_id;
      nav(`/generate/confirm/${runId}`, { state: resp.data });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setError(typeof msg === 'string' ? msg : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  const disabled = busy || (mode === 'file' && !file);

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1140px]">
        {/* Page heading */}
        <header className="mb-6">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">
            Generate Quotation
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Paste RFQ text or upload a document — NimAI extracts the company, product, and
            technical specs into a draft quotation.
          </p>
        </header>

        {/* Cloning-from-template reference banner */}
        {template && (
          <div className="mb-[22px] flex items-center gap-3 rounded-[14px] border border-brand bg-brand-soft px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand text-white">
              <Copy className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground">Cloning from template — {template}</div>
              <div className="text-xs text-muted-foreground">The generated quote will mirror this RFQ&apos;s structure, fields, and commercial style.</div>
            </div>
            <button onClick={() => nav('/')} className="h-[34px] rounded-[9px] border border-brand bg-transparent px-3 text-[12px] font-semibold text-brand">Change</button>
            <button onClick={() => setTemplate(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground hover:text-foreground">
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>
        )}

        {/* Split layout */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_332px]">
          {/* ── Workspace card ── */}
          <section className="rounded-[20px] border border-border bg-card p-6 shadow-[var(--elevated-shadow)] sm:p-7">
            <form onSubmit={handleSubmit}>
              {/* Segmented control + AI flag */}
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="relative inline-flex shrink-0 rounded-xl border border-border bg-input-background p-1">
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[9px] bg-card shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
                    style={{ transform: mode === 'text' ? 'translateX(0)' : 'translateX(100%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setMode('text')}
                    className={`relative z-10 flex items-center gap-2 whitespace-nowrap rounded-[9px] px-[18px] py-2 text-[13px] font-semibold transition-colors ${
                      mode === 'text' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <Type className="h-[15px] w-[15px]" />
                    Paste text
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('file')}
                    className={`relative z-10 flex items-center gap-2 whitespace-nowrap rounded-[9px] px-[18px] py-2 text-[13px] font-semibold transition-colors ${
                      mode === 'file' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <FileUp className="h-[15px] w-[15px]" />
                    Upload file
                  </button>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand">
                  <Sparkles className="h-[13px] w-[13px]" />
                  AI extraction
                </span>
              </div>

              {/* TEXT mode */}
              {mode === 'text' ? (
                <div>
                  <label
                    htmlFor="rfq-text"
                    className="mb-2.5 block text-[12.5px] font-semibold tracking-[-0.01em] text-foreground"
                  >
                    RFQ text
                  </label>
                  <textarea
                    id="rfq-text"
                    required
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your RFQ document text here — include company name, product, quantities and technical specifications…"
                    className="h-[280px] w-full resize-y rounded-[14px] border border-border bg-input-background px-[18px] py-4 text-[13.5px] leading-relaxed text-foreground outline-none transition-[border-color,box-shadow,background] placeholder:text-muted-foreground/70 focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]"
                  />
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-[13px] w-[13px]" />
                      Company, product &amp; specs are auto-detected
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {text.length === 0
                        ? 'No text yet'
                        : `${text.length.toLocaleString()} characters`}
                    </span>
                  </div>
                </div>
              ) : (
                /* FILE mode */
                <div>
                  <label className="mb-2.5 block text-[12.5px] font-semibold tracking-[-0.01em] text-foreground">
                    Upload document
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`cursor-pointer rounded-[14px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors ${
                      dragging
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-input-background hover:border-brand hover:bg-brand/[0.06]'
                    }`}
                  >
                    <div className="mx-auto mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-border bg-card text-brand shadow-sm">
                      <UploadCloud className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    {file ? (
                      <div className="text-sm font-semibold text-foreground">{file.name}</div>
                    ) : (
                      <>
                        <div className="mb-1 text-sm font-semibold text-foreground">
                          Drag &amp; drop, or <span className="text-brand">browse files</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Up to 20&nbsp;MB per document</div>
                      </>
                    )}
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {['PDF', 'DOCX', 'TXT'].map((ext) => (
                        <span
                          key={ext}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* Optional product selection */}
              <div className="mt-5">
                <label className="mb-2 block text-[12.5px] font-semibold tracking-[-0.01em] text-foreground">
                  Product type <span className="font-normal text-muted-foreground">(optional — improves extraction)</span>
                </label>
                <ProductPicker value={selectedProduct} onChange={setSelectedProduct} />
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-[12.5px] text-error">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={disabled}
                className={`mt-[22px] flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[14.5px] font-bold tracking-[-0.01em] text-white shadow-[0_10px_24px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,box-shadow,filter] duration-150 ease-[cubic-bezier(.22,1,.36,1)] ${BRAND_GRADIENT} ${
                  disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:-translate-y-px hover:saturate-[1.06] hover:shadow-[0_14px_30px_-8px_rgba(54,148,252,0.7),inset_0_1px_0_rgba(255,255,255,0.32)] active:translate-y-0'
                }`}
              >
                {busy ? (
                  <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Sparkles className="h-[18px] w-[18px]" />
                )}
                {busy ? 'Extracting…' : 'Submit & Extract'}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Extraction usually takes 10–20 seconds. You'll review before generating.
              </p>
            </form>
          </section>

          {/* ── Right rail ── */}
          <aside className="flex flex-col gap-[18px]">
            {/* Recent activity */}
            <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
              <div className="flex items-center justify-between px-[18px] pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                    Recent activity
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => nav('/runs')}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  View all
                </button>
              </div>

              {recent.length === 0 ? (
                <div className="border-t border-border px-[18px] py-6 text-center text-xs text-muted-foreground">
                  No runs yet — your submissions will appear here.
                </div>
              ) : (
                recent.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => nav(`/runs/${run.id}`)}
                    className="flex w-full items-center gap-3 border-t border-border px-[18px] py-[11px] text-left transition-colors hover:bg-accent/40"
                  >
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-input-background text-xs font-bold text-muted-foreground">
                      {(run.meta_company_name ?? '—').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        {run.meta_company_name ?? 'Untitled RFQ'}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {run.meta_product ?? run.input_type} ·{' '}
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <StatusBadge status={run.status} />
                  </button>
                ))
              )}
            </div>

            {/* How it works */}
            <div className="rounded-[18px] border border-border bg-card p-[18px] shadow-[var(--elevated-shadow)]">
              <div className="mb-3.5 text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                How it works
              </div>
              <ol className="flex flex-col gap-3.5">
                {[
                  ['Paste or upload', 'your RFQ document.'],
                  ['NimAI extracts', 'company, product & specs.'],
                  ['Review & confirm', 'to generate the quotation.'],
                ].map(([strong, rest], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">{strong}</span> {rest}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => nav('/runs')}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-accent/50"
              >
                See all runs
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
