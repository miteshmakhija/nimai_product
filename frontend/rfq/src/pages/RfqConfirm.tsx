import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { rfqApi } from '../api';
import type { RfqExtractResponse, DataPoint } from '../types';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

/** Shared 2-step progress header. step: 1=Extract, 2=Review & Generate */
export function FlowStepper({ step }: { step: 2 | 3 }) {
  const node = (n: number, label: string) => {
    const done = n < step;
    const active = n === step;
    return (
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-bold ${
            done ? 'bg-success text-white' : active ? 'bg-brand text-white' : 'bg-input-background text-muted-foreground'
          }`}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </div>
        <span className={`text-[13px] font-semibold ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>
    );
  };
  return (
    <div className="mb-7 flex items-center">
      {node(1, 'Extract')}
      <div className={`mx-4 h-0.5 flex-1 rounded ${step > 1 ? 'bg-success' : 'bg-border'}`} />
      {node(2, 'Review & generate')}
    </div>
  );
}

export default function RfqConfirm() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as RfqExtractResponse | null;

  // Metadata
  const [companyName, setCompanyName] = useState(state?.meta_company_name ?? '');
  const [product, setProduct] = useState(state?.meta_product ?? '');
  const [rfqDate, setRfqDate] = useState(state?.meta_rfq_date ?? '');
  const [rfqNumber, setRfqNumber] = useState(state?.meta_rfq_number ?? '');

  // Data points — initialise from extraction state passed via navigation
  const initialDps = state?.data_points ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initialDps.forEach((dp: DataPoint) => { m[dp.key] = dp.value ?? ''; });
    return m;
  });
  const [dataPoints] = useState<DataPoint[]>(initialDps);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId) return;
    setLoading(true);
    setError('');
    try {
      // Keep hidden customer__ duplicates in sync with the metadata inputs so
      // the backend overlay doesn't clobber edited customer details.
      const synced: Record<string, string> = {
        ...values,
        customer__customer_name: companyName,
        customer__rfq_number: rfqNumber,
        customer__rfq_date: rfqDate,
      };
      const dpPayload = Object.entries(synced).map(([key, value]) => ({ key, value: value || null }));
      await rfqApi.confirm(runId, {
        meta_company_name: companyName || null,
        meta_product: product || null,
        meta_rfq_date: rfqDate || null,
        meta_rfq_number: rfqNumber || null,
        data_points: dpPayload,
      });
      navigate(`/runs/${runId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  const metaField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[12.5px] font-semibold text-foreground">{label}</label>
        {value && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand">AI extracted</span>
        )}
      </div>
      <input
        className="h-[42px] w-full rounded-[11px] border border-border bg-input-background px-3.5 text-sm text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  // ── Split data points into the three sections ───────────────────────────────
  // Customer duplicates handled by the metadata inputs above — hide them here.
  const CUSTOMER_DUPES = new Set([
    'customer__customer_name',
    'customer__rfq_number',
    'customer__rfq_date',
  ]);
  const customerExtras = dataPoints.filter(
    (d) => d.key.startsWith('customer__') && !CUSTOMER_DUPES.has(d.key),
  );
  const requiredDps = dataPoints.filter((d) => d.key.startsWith('required__'));
  const additionalDps = dataPoints.filter(
    (d) => !d.key.startsWith('customer__') && !d.key.startsWith('required__'),
  );

  const requiredFound = requiredDps.filter((d) => (values[d.key] ?? '').trim()).length;

  /** Editable data-point input with optional required-missing highlight. */
  const dpField = (dp: DataPoint) => {
    const val = values[dp.key] ?? '';
    const missing = dp.required && !val.trim();
    return (
      <div key={dp.key}>
        <div className="mb-1.5 flex items-center gap-2">
          <label className="text-[12px] font-semibold text-foreground">{dp.label ?? dp.key}</label>
          {dp.required ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                missing ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
              }`}
            >
              {missing ? 'Required — not found' : 'Required'}
            </span>
          ) : (
            val && (
              <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                Extracted
              </span>
            )
          )}
        </div>
        <input
          className={`h-[38px] w-full rounded-[10px] border bg-input-background px-3 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)] ${
            missing ? 'border-error' : 'border-border'
          }`}
          value={val}
          onChange={(e) => setValues((v) => ({ ...v, [dp.key]: e.target.value }))}
          placeholder={dp.required ? 'Required' : 'Not found in document'}
        />
      </div>
    );
  };

  const cardClass =
    'mb-6 rounded-[20px] border border-border bg-card p-7 shadow-[var(--elevated-shadow)] sm:p-8';

  return (
    <div className="px-7 py-9 pb-14">
      <div className="mx-auto max-w-[880px]">
        <FlowStepper step={2} />

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-6 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-[12.5px] text-error">{error}</div>
          )}

          {/* ── Section 1: Customer Details ─────────────────────────── */}
          <div className={cardClass}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">Section 1</span>
              <span className="text-[12.5px] text-muted-foreground">Customer Details</span>
            </div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">Customer details</h1>
            <p className="mb-6 mt-1.5 text-[13.5px] text-muted-foreground">
              Extracted in a single pass. Review and edit before generating the quote.
            </p>

            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
              {metaField('Company name', companyName, setCompanyName, 'Customer company name')}
              {metaField('Product / equipment type', product, setProduct, 'e.g. Process Column')}
              {metaField('RFQ date', rfqDate, setRfqDate, 'YYYY-MM-DD')}
              {metaField('RFQ number', rfqNumber, setRfqNumber, 'Customer reference number')}
              {customerExtras.map((dp) => dpField(dp))}
            </div>
          </div>

          {/* ── Section 2: Required Product Details ─────────────────── */}
          <div className={cardClass}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">Section 2</span>
              <span className="text-[12.5px] text-muted-foreground">
                Required Product Details{product ? ` · ${product}` : ''}
              </span>
            </div>
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Required product details</h2>
            {requiredDps.length > 0 ? (
              <>
                <p className="mb-4 mt-1.5 text-[13px] text-muted-foreground">
                  {requiredFound} of {requiredDps.length} required fields found. Fill any missing values.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {requiredDps.map((dp) => dpField(dp))}
                </div>
              </>
            ) : (
              <p className="mb-1 mt-1.5 text-[13px] text-muted-foreground">
                No required-field template configured for this product
                {product ? ` (“${product}”)` : ''}. Configure one under Admin → Product Fields to capture
                product-specific specs here.
              </p>
            )}
          </div>

          {/* ── Section 3: Additional Information ───────────────────── */}
          {additionalDps.length > 0 && (
            <div className={cardClass}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">Section 3</span>
                <span className="text-[12.5px] text-muted-foreground">
                  Additional Information · {additionalDps.length} fields
                </span>
              </div>
              <h2 className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-foreground">Additional information</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {additionalDps.map((dp) => dpField(dp))}
              </div>
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-11 rounded-[11px] border border-border bg-card px-[18px] text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex h-11 items-center gap-2 rounded-[11px] px-[22px] text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] disabled:opacity-60 ${BRAND_GRADIENT}`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Generating…' : 'Confirm & generate quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

