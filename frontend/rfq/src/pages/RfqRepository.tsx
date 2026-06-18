import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Building2,
  Clock,
  Copy,
  CalendarDays,
  ListFilter,
  ChevronDown,
  AlignLeft,
  ShieldCheck,
  Check,
  Plus,
  X,
  ArrowRight,
  FileText,
} from 'lucide-react';

type Tone = 'success' | 'warn' | 'idle';
interface RepoItem {
  initial: string;
  company: string;
  product: string;
  amount: string;
  status: string;
  tone: Tone;
  score: number;
}

interface PreviewItem {
  company: string;
  product: string;
  amount: string;
  by: string;
}

const TONE: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  idle: 'bg-muted text-muted-foreground',
};

const COMPACT_STATS = [
  { label: 'Indexed Quotations', value: '1,284' },
  { label: 'Active companies', value: '96' },
  { label: 'Avg. match score', value: '87%' },
  { label: 'Added this month', value: '142' },
];

const TRENDING = [
  ['EEPL', '38'], ['Reliance Industries', '27'], ['Acme Corp.', '21'],
  ['Tata Chemicals', '19'], ['Beta Industries', '14'], ['L&T Energy', '11'],
];

const SAMPLE_APPROVALS = [
  { company: 'EEPL', product: 'Process Column', amount: '$122,000', by: 'Rahul M.', time: 'Submitted 12m ago' },
  { company: 'Acme Corp.', product: 'Pressure Vessel', amount: '$87,400', by: 'Sara K.', time: 'Submitted 1h ago' },
];

const SAMPLE_SIMILAR = [
  { initial: 'B', company: 'Beta Industries', product: 'Centrifugal Pump', fields: 12, ago: '2d ago', score: 96 },
  { initial: 'E', company: 'EEPL', product: 'Process Column', fields: 18, ago: '4d ago', score: 92 },
  { initial: 'A', company: 'Acme Corp.', product: 'Pressure Vessel', fields: 15, ago: '1w ago', score: 88 },
  { initial: 'H', company: 'Hindustan Petro', product: 'Heat Exchanger', fields: 21, ago: '1w ago', score: 84 },
];

const SAMPLE_RESULTS: RepoItem[] = [
  { initial: 'R', company: 'Reliance Industries', product: 'Centrifugal Pump', amount: '$48,500', status: 'Done', tone: 'success', score: 96 },
  { initial: 'E', company: 'EEPL', product: 'Process Column', amount: '$122,000', status: 'Done', tone: 'success', score: 94 },
  { initial: 'B', company: 'Beta Industries', product: 'Centrifugal Pump', amount: '$51,200', status: 'Awaiting', tone: 'warn', score: 91 },
  { initial: 'A', company: 'Acme Corp.', product: 'Pressure Vessel', amount: '$87,400', status: 'Done', tone: 'success', score: 88 },
  { initial: 'T', company: 'Tata Chemicals', product: 'Heat Exchanger', amount: '$64,900', status: 'Queued', tone: 'idle', score: 85 },
  { initial: 'L', company: 'L&T Energy', product: 'Storage Tank', amount: '$210,000', status: 'Done', tone: 'success', score: 82 },
  { initial: 'H', company: 'Hindustan Petro', product: 'Distillation Column', amount: '$156,300', status: 'Data needed', tone: 'warn', score: 79 },
  { initial: 'B', company: 'BPCL', product: 'Centrifugal Pump', amount: '$39,750', status: 'Done', tone: 'success', score: 74 },
];

const BRAND_GRADIENT = 'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

function scoreClasses(n: number) {
  if (n >= 90) return { text: 'text-success', bar: 'bg-success', soft: 'bg-success/10 text-success' };
  if (n >= 80) return { text: 'text-warning', bar: 'bg-warning', soft: 'bg-warning/10 text-warning' };
  return { text: 'text-muted-foreground', bar: 'bg-muted-foreground', soft: 'bg-muted text-muted-foreground' };
}

const FILTER_PILLS = [
  { label: 'Filter by status', icon: <Clock className="h-3.5 w-3.5" /> },
  { label: 'Date range', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { label: 'Top companies', icon: <Building2 className="h-3.5 w-3.5" /> },
  { label: 'Sort: Best match', icon: <ListFilter className="h-3.5 w-3.5" /> },
];

export default function RfqRepository() {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedTpl, setSelectedTpl] = useState<{ company: string; product: string } | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_RESULTS;
    return SAMPLE_RESULTS.filter(
      (r) => r.company.toLowerCase().includes(q) || r.product.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="px-7 py-9 pb-14">
      <div className="mx-auto max-w-[1180px]">

        {/* Welcome */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-1 text-[13px] font-medium text-muted-foreground">Good afternoon, Super</p>
            <h1 className="text-[27px] font-bold tracking-[-0.03em] text-foreground">
              Welcome to your <span className="text-brand">Quotation Hub</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Search past RFQs, reuse a proven structure, or start fresh.
            </p>
          </div>
          <button
            onClick={() => nav('/generate')}
            className={`inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.4} />
            Generate new Quotation
          </button>
        </div>

        {/* Clone template banner — shown when a template is selected */}
        {selectedTpl && (
          <div className="mb-[18px] flex items-center gap-3 rounded-[14px] border border-brand bg-brand/10 p-[13px]">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white ${BRAND_GRADIENT}`}>
              <Copy className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground">
                Template selected — {selectedTpl.company} · {selectedTpl.product}
              </div>
              <div className="text-[12px] text-muted-foreground">
                Your next generated quote will follow this RFQ's structure and commercial style.
              </div>
            </div>
            <button
              onClick={() => nav('/generate', { state: { template: `${selectedTpl.company} · ${selectedTpl.product}` } })}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-[12.5px] font-bold text-white ${BRAND_GRADIENT}`}
            >
              Continue in Generate Quotation
              <ArrowRight className="h-[15px] w-[15px]" />
            </button>
            <button
              onClick={() => setSelectedTpl(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>
        )}

        {/* Pending approvals banner — above search */}
        {SAMPLE_APPROVALS.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-[11px] border border-warning bg-warning/10 px-4 py-[11px]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-warning" />
            <span className="flex-1 text-[13px] font-semibold text-foreground">
              {SAMPLE_APPROVALS.length} quotes are waiting for your approval
            </span>
            <button
              onClick={() => nav('/approvals')}
              className="whitespace-nowrap text-[12.5px] font-bold text-warning hover:underline"
            >
              Review →
            </button>
          </div>
        )}

        {/* Hero search */}
        <section className="relative mb-3 overflow-hidden rounded-[20px] border border-border bg-card p-6 shadow-[var(--elevated-shadow)]">
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(54,148,252,0.10),transparent_55%)]" />
          <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            <div className="flex h-[58px] items-center gap-3.5 rounded-[15px] border border-border bg-card pl-5 pr-2 shadow-sm transition-shadow focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search quotations by company name, product, or ID…"
                className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand sm:inline-flex">
                <Sparkles className="h-[13px] w-[13px]" />
                Semantic
              </span>
              <button className={`h-[42px] rounded-[11px] px-5 text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}>
                Search
              </button>
            </div>

            {/* Filter pills */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-medium text-muted-foreground">Filters</span>
              {FILTER_PILLS.map((p) => (
                <button
                  key={p.label}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {p.icon}
                  {p.label}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>

            {/* Trending */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Trending</span>
              {TRENDING.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setQuery(name)}
                  className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-input-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
                >
                  {name}
                  <span className="text-[11px] font-semibold text-muted-foreground/70">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Compact stats strip */}
        <div className="mb-[14px] flex overflow-hidden rounded-[12px] border border-border bg-card">
          {COMPACT_STATS.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-1 flex-col gap-px px-[18px] py-[11px] ${i < COMPACT_STATS.length - 1 ? 'border-r border-border' : ''}`}
            >
              <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
              <span className="text-[18px] font-bold tracking-[-0.02em] text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Similar RFQ discovery — only when searching */}
        {query.trim() && (
          <>
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-[18px] w-[18px] text-brand" />
                <h2 className="text-[17px] font-bold tracking-[-0.02em] text-foreground">Similar to your search</h2>
              </div>
              <button className="text-[12.5px] font-semibold text-brand hover:underline">Browse all templates →</button>
            </div>
            <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_SIMILAR.map((c) => {
                const sc = scoreClasses(c.score);
                return (
                  <div key={c.company} className="flex flex-col rounded-2xl border border-border bg-card p-[18px] shadow-[var(--elevated-shadow)] transition-[transform,box-shadow] hover:-translate-y-[3px] hover:shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-input-background text-[13px] font-bold text-muted-foreground">{c.initial}</div>
                      <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${sc.soft}`}>{c.score}% match</span>
                    </div>
                    <div className="text-sm font-bold tracking-[-0.01em] text-foreground">{c.company}</div>
                    <div className="mb-3.5 text-[12.5px] text-muted-foreground">{c.product}</div>
                    <div className="mb-4 flex items-center gap-3.5 text-[11.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><AlignLeft className="h-3 w-3" />{c.fields} fields</span>
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.ago}</span>
                    </div>
                    <button
                      onClick={() => setSelectedTpl({ company: c.company, product: c.product })}
                      className="mt-auto flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand bg-brand/10 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Clone structure
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Search results table */}
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-foreground">
            Search results <span className="text-sm font-medium text-muted-foreground">· {results.length} quotations</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />High match</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warning" />Medium</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground" />Low</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          <div className="grid grid-cols-[1.4fr_1.4fr_130px_150px_170px_230px] border-b border-border px-[22px] py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <span>Company</span><span>Product / Category</span><span>Est. amount</span><span>Status</span><span>Match score</span><span />
          </div>
          {results.length === 0 ? (
            <div className="px-[22px] py-12 text-center">
              <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[13px] bg-input-background text-muted-foreground">
                <Search className="h-[22px] w-[22px]" />
              </div>
              <div className="mb-1 text-sm font-semibold text-foreground">No quotations match "{query}"</div>
              <div className="text-[12.5px] text-muted-foreground">Try a company name, product category, or RFQ ID.</div>
            </div>
          ) : (
            results.map((r, i) => {
              const sc = scoreClasses(r.score);
              return (
                <div key={i} className="grid grid-cols-[1.4fr_1.4fr_130px_150px_170px_230px] items-center border-b border-border px-[22px] py-3.5 text-[13px] last:border-0 hover:bg-accent/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-input-background text-[12px] font-bold text-muted-foreground">{r.initial}</div>
                    <span className="truncate font-semibold text-foreground">{r.company}</span>
                  </div>
                  <span className="text-muted-foreground">{r.product}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.amount}</span>
                  <span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TONE[r.tone]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {r.status}
                    </span>
                  </span>
                  <div className="flex items-center gap-2.5 pr-4">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-input-background">
                      <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${r.score}%` }} />
                    </div>
                    <span className={`w-9 text-right text-[12px] font-bold tabular-nums ${sc.text}`}>{r.score}%</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedTpl({ company: r.company, product: r.product })}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold text-white shadow-[0_6px_14px_-6px_rgba(54,148,252,0.6)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}
                    >
                      <Copy className="h-[13px] w-[13px]" />
                      Use as template
                    </button>
                    <button
                      onClick={() => setPreview({ company: r.company, product: r.product, amount: r.amount, by: 'Submitted by' })}
                      className="inline-flex h-8 items-center rounded-[9px] border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Document preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-[6px]"
          style={{ background: 'rgba(14,19,32,0.45)' }}
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[86vh] w-[720px] max-w-full flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_40px_90px_-24px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
              <div className="flex items-center gap-3">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-brand">
                  <FileText className="h-[17px] w-[17px]" />
                </div>
                <div>
                  <div className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{preview.company} — {preview.product}</div>
                  <div className="text-[12px] text-muted-foreground">Submitted by {preview.by} · {preview.amount}</div>
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto bg-input-background px-[30px] py-[26px]">
              {/* Summary grid */}
              <div className="mb-4 rounded-[12px] border border-border bg-card p-[18px]">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Summary</div>
                <div className="grid grid-cols-3 gap-x-[18px] gap-y-3.5">
                  {[
                    { l: 'Est. amount', v: preview.amount },
                    { l: 'Submitted by', v: preview.by },
                    { l: 'Status', v: 'Awaiting approval', cls: 'text-warning' },
                    { l: 'Delivery', v: '14–16 weeks' },
                    { l: 'Payment', v: '30 / 60 / 10' },
                    { l: 'Quote no.', v: 'ACME/Q/2026/0613' },
                  ].map((f) => (
                    <div key={f.l}>
                      <div className="mb-0.5 text-[11px] text-muted-foreground">{f.l}</div>
                      <div className={`text-[13px] font-semibold ${f.cls ?? 'text-foreground'}`}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document preview */}
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Full document</div>
              <div className="rounded-[12px] border border-border bg-card px-[34px] py-[30px]">
                <div className="mb-[3px] text-[17px] font-bold tracking-[-0.01em] text-foreground">Techno-Commercial Quotation</div>
                <div className="mb-[18px] text-[12px] text-muted-foreground">ACME Process Systems Pvt Ltd · Pune · Quote No. ACME/Q/2026/0613</div>
                <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">
                  Offer for the supply of one (1) {preview.company} — {preview.product} as per the referenced RFQ. Commercial summary below.
                </p>
                <div className="overflow-hidden rounded-[10px] border border-border">
                  <div className="grid grid-cols-[1.4fr_1fr] border-b border-border bg-input-background text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                    <span className="border-r border-border px-[13px] py-2">Line item</span>
                    <span className="px-[13px] py-2">Value</span>
                  </div>
                  {[
                    ['Equipment supply', preview.amount],
                    ['Delivery', '14–16 weeks ex-works'],
                    ['Payment', '30 / 60 / 10'],
                  ].map(([l, v]) => (
                    <div key={l} className="grid grid-cols-[1.4fr_1fr] border-t border-border text-[12.5px]">
                      <span className="border-r border-border px-[13px] py-2 text-muted-foreground">{l}</span>
                      <span className="px-[13px] py-2 text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-[22px] py-4">
              <button
                onClick={() => setPreview(null)}
                className="h-10 rounded-[11px] border border-border bg-card px-4 text-[13px] font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                Close
              </button>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setPreview(null)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[11px] border border-error bg-transparent px-4 text-[13px] font-semibold text-error hover:bg-error/10"
                >
                  Request changes
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-success px-5 text-[13px] font-bold text-white"
                >
                  <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
                  Approve quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
