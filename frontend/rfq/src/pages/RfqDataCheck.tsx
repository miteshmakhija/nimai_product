import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { rfqApi } from '../api';
import type { RfqRun, DataPoint } from '../types';
import { FlowStepper } from './RfqConfirm';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

export default function RfqDataCheck() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<RfqRun | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;
    rfqApi.get(runId).then(({ data }) => {
      setRun(data);
      const initial: Record<string, string> = {};
      (data.data_points ?? []).forEach((dp: DataPoint) => {
        initial[dp.key] = dp.value ?? '';
      });
      setValues(initial);
      setLoading(false);
    });
  }, [runId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId) return;
    setSubmitting(true);
    setError('');
    try {
      const dataPoints = Object.entries(values).map(([key, value]) => ({ key, value: value || null }));
      await rfqApi.submitData(runId, dataPoints);
      navigate(`/runs/${runId}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (detail && typeof detail === 'object' && 'missing_keys' in detail) {
        const d = detail as { message: string; missing_keys: string[] };
        setError(`${d.message}: ${d.missing_keys.join(', ')}`);
      } else {
        setError(typeof detail === 'string' ? detail : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const dataPoints: DataPoint[] = run?.data_points ?? [];
  const requiredTotal = dataPoints.filter((d) => d.required).length;
  const requiredFound = dataPoints.filter((d) => d.required && (values[d.key] ?? '')).length;
  const pct = requiredTotal ? Math.round((requiredFound / requiredTotal) * 100) : 100;

  return (
    <div className="px-7 py-9 pb-14">
      <div className="mx-auto max-w-[880px]">
        <FlowStepper step={3} />

        <form onSubmit={handleSubmit} className="rounded-[20px] border border-border bg-card p-7 shadow-[var(--elevated-shadow)] sm:p-8">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">Step 3 of 3</span>
            <span className="text-[12.5px] text-muted-foreground">
              Confirm data points · {run?.meta_product ?? '—'}
            </span>
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">Data completeness check</h1>
          <p className="mb-[18px] mt-1.5 text-[13.5px] text-muted-foreground">
            Review the values NimAI extracted. Fill in any missing required fields before generating.
          </p>

          {/* Progress */}
          <div className="mb-[22px] rounded-[13px] bg-input-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">
                {requiredFound} of {requiredTotal} required fields found
              </span>
              <span className="text-xs text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#3fb6fb,#2f8bf6)]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-[12.5px] text-error">{error}</div>
          )}

          <div className="flex flex-col gap-3.5">
            {dataPoints.map((dp) => {
              const val = values[dp.key] ?? '';
              const isMissing = dp.required && !val;
              return (
                <div key={dp.key}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <label className="text-[12.5px] font-semibold text-foreground">{dp.label ?? dp.key}</label>
                    {dp.required ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          isMissing ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                        }`}
                      >
                        {isMissing ? 'Required — not found' : 'Extracted'}
                      </span>
                    ) : (
                      dp.value && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Extracted</span>
                    )}
                  </div>
                  <input
                    className={`h-10 w-full rounded-[10px] border bg-input-background px-3 text-[13.5px] text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)] ${
                      isMissing ? 'border-error' : 'border-border'
                    }`}
                    value={val}
                    onChange={(e) => setValues((v) => ({ ...v, [dp.key]: e.target.value }))}
                    placeholder={dp.required ? 'Required' : 'Optional'}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-11 rounded-[11px] border border-border bg-card px-[18px] text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex h-11 items-center gap-2 rounded-[11px] px-[22px] text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] disabled:opacity-60 ${BRAND_GRADIENT}`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Submit &amp; generate quote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
